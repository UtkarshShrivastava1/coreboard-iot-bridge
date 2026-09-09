require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mqtt = require('mqtt');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Active MQTT connection pool: thingName -> { mqttClient, autoInterval, deviceType, tenantId, lastData }
const connectionPool = new Map();

// Helper: Build multi-tenant topic structure
function getPublishTopic(tenantId, thingName) {
  const cleanTenant = (tenantId || 'default-tenant').trim().toLowerCase();
  const cleanThing = thingName.trim();
  return `tenants/${cleanTenant}/devices/${cleanThing}/pub`;
}

io.on('connection', (socket) => {
  console.log(`[Simulator WS] Web client connected: ${socket.id}`);

  // Send list of currently active simulated devices to newly connected UI client
  // Note: we can map connectionPool keys to array
  const formattedActive = Array.from(connectionPool.entries()).map(([thingName, val]) => ({
    thingName,
    deviceType: val.deviceType,
    tenantId: val.tenantId,
    status: val.mqttClient.connected ? 'connected' : 'disconnected',
    isAuto: !!val.autoInterval,
    lastData: val.lastData
  }));
  socket.emit('active_devices_list', formattedActive);

  // 1. Connect Device over AWS mTLS MQTT
  socket.on('connect_device', (payload) => {
    const { endpoint, tenantId, thingName, deviceType, certPem, keyPem, rootCaPem } = payload;
    const cleanThing = thingName.trim();

    console.log(`[Simulator WS] Request to connect device: ${cleanThing} under tenant: ${tenantId}`);

    // If already connected, disconnect it first
    if (connectionPool.has(cleanThing)) {
      const existing = connectionPool.get(cleanThing);
      if (existing.autoInterval) clearInterval(existing.autoInterval);
      existing.mqttClient.end();
      connectionPool.delete(cleanThing);
    }

    // Use uploaded Root CA or read AmazonRootCA1.pem fallback
    let caCert = rootCaPem;
    if (!caCert) {
      try {
        caCert = require('fs').readFileSync(
          require('path').resolve(__dirname, '../backend/certs/AmazonRootCA1.pem')
        );
      } catch (e) {
        console.warn(`[Simulator Server] Failed to read Root CA file. Falling back to default root CA string.`);
        caCert = process.env.AMAZON_CA_PEM; // fallback in case certs directory is missing
      }
    }

    const mqttOptions = {
      host: endpoint || process.env.AWS_ENDPOINT || 'a3jn1jb4u5t66x-ats.iot.ap-south-1.amazonaws.com',
      port: 8883,
      protocol: 'mqtts',
      clientId: cleanThing,
      ca: caCert,
      cert: certPem,
      key: keyPem,
      rejectUnauthorized: true,
      keepalive: 30,
      reconnectPeriod: 0 // Do not auto-reconnect if it fails initial handshake to make errors obvious
    };

    try {
      const mqttClient = mqtt.connect(mqttOptions);

      mqttClient.on('connect', () => {
        console.log(`[AWS MQTT] Device ${cleanThing} connected successfully to AWS IoT Core.`);
        
        connectionPool.set(cleanThing, {
          mqttClient,
          deviceType: deviceType || 'pump',
          tenantId: tenantId || 'default-tenant',
          autoInterval: null,
          lastData: {}
        });

        // Simulator is a publish-only client — no sub topic subscription needed
        // (subscribing caused SUBACK rejections that killed the connection)

        io.emit('device_status', {
          thingName: cleanThing,
          status: 'connected',
          message: 'Connected to AWS IoT Core successfully.'
        });
      });

      mqttClient.on('message', (topic, message) => {
        console.log(`[AWS MQTT] Simulated Device ${cleanThing} received message on topic: ${topic}`);
        try {
          const payload = JSON.parse(message.toString());
          // Forward received actuation commands to the Web client via Socket.io
          io.emit('actuator_command', {
            thingName: cleanThing,
            topic,
            payload
          });
        } catch (e) {
          console.error(`[AWS MQTT] Failed to parse message for simulated device ${cleanThing}:`, e.message);
        }
      });

      mqttClient.on('error', (err) => {
        console.error(`[AWS MQTT] Device ${cleanThing} connection error:`, err.message);
        socket.emit('device_status', {
          thingName: cleanThing,
          status: 'error',
          error: err.message
        });
        mqttClient.end();
        connectionPool.delete(cleanThing);
      });

      mqttClient.on('close', () => {
        console.log(`[AWS MQTT] Device ${cleanThing} connection closed.`);
        // Clean up pool on unexpected close to stop stale auto-intervals
        if (connectionPool.has(cleanThing)) {
          const dev = connectionPool.get(cleanThing);
          if (dev.autoInterval) {
            clearInterval(dev.autoInterval);
            dev.autoInterval = null;
          }
          connectionPool.delete(cleanThing);
        }
        io.emit('device_status', {
          thingName: cleanThing,
          status: 'disconnected'
        });
      });

    } catch (err) {
      console.error(`[Simulator Server] Connect exception:`, err);
      socket.emit('device_status', {
        thingName: cleanThing,
        status: 'error',
        error: err.message
      });
    }
  });

  // 2. Publish Telemetry Payload (Sliders or Fault button triggers)
  socket.on('publish_telemetry', (payload) => {
    const { thingName, data } = payload;
    const cleanThing = thingName.trim();

    if (!connectionPool.has(cleanThing)) {
      return socket.emit('log_message', {
        thingName: cleanThing,
        type: 'error',
        text: 'Cannot publish telemetry: device is not connected.'
      });
    }

    const dev = connectionPool.get(cleanThing);
    const publishTopic = getPublishTopic(dev.tenantId, cleanThing);

    const messagePayload = {
      device_id: cleanThing,
      device_type: dev.deviceType,
      timestamp: new Date().toISOString(),
      ...data
    };

    dev.lastData = data;

    dev.mqttClient.publish(publishTopic, JSON.stringify(messagePayload), (err) => {
      if (err) {
        console.error(`[Simulator MQTT] Publish failed for ${cleanThing}:`, err);
        socket.emit('log_message', {
          thingName: cleanThing,
          type: 'error',
          text: `Publish failed: ${err.message}`
        });
      } else {
        socket.emit('log_message', {
          thingName: cleanThing,
          type: 'publish',
          topic: publishTopic,
          payload: messagePayload
        });
      }
    });
  });

  // 3. Toggle Auto-Simulation Mode
  socket.on('toggle_auto', (payload) => {
    const { thingName, isAuto, baselineData } = payload;
    const cleanThing = thingName.trim();

    if (!connectionPool.has(cleanThing)) return;

    const dev = connectionPool.get(cleanThing);

    if (isAuto) {
      // Clear any existing interval
      if (dev.autoInterval) clearInterval(dev.autoInterval);

      console.log(`[Simulator Engine] Auto-simulation started for device: ${cleanThing}`);
      
      // Keep baseline values in memory to add random noise to
      dev.lastData = baselineData || dev.lastData;

      // Start periodic publisher
      dev.autoInterval = setInterval(() => {
        const publishTopic = getPublishTopic(dev.tenantId, cleanThing);
        
        // Generate simulated telemetry based on device type or freeform payload with noise
        const simulated = { ...dev.lastData };
        
        // Dynamically add noise to all numeric keys in the payload (Device-Agnostic Engine)
        Object.keys(simulated).forEach(key => {
          if (key !== 'device_id' && key !== 'device_type' && key !== 'timestamp' && key !== 'status') {
            const val = Number(simulated[key]);
            if (!isNaN(val) && typeof simulated[key] !== 'boolean') {
              const noiseScale = val !== 0 ? Math.abs(val) * 0.02 : 0.5;
              const delta = (Math.random() - 0.5) * noiseScale;
              simulated[key] = parseFloat((val + delta).toFixed(2));
            }
          }
        });

        // Ensure default telemetry fields exist if empty
        if (Object.keys(simulated).length === 0) {
          if (dev.deviceType === 'pump') {
            simulated.flow_rate = parseFloat((25.0 + (Math.random() - 0.5)).toFixed(1));
            simulated.temperature = parseFloat((32.0 + (Math.random() - 0.5) * 0.4).toFixed(1));
          } else {
            simulated.s1 = parseFloat((42.5 + (Math.random() - 0.5)).toFixed(1));
            simulated.temp_c = parseFloat((24.0 + (Math.random() - 0.5) * 0.4).toFixed(1));
          }
        }

        const messagePayload = {
          device_id: cleanThing,
          device_type: dev.deviceType,
          timestamp: new Date().toISOString(),
          ...simulated
        };

        dev.mqttClient.publish(publishTopic, JSON.stringify(messagePayload), (err) => {
          if (err) {
            console.error(`[Auto Publish Error] ${cleanThing}:`, err.message);
          } else {
            socket.emit('log_message', {
              thingName: cleanThing,
              type: 'publish',
              topic: publishTopic,
              payload: messagePayload
            });
          }
        });
      }, 3000); // Send data every 3 seconds

      socket.emit('auto_status', { thingName: cleanThing, isAuto: true });

    } else {
      // Disable auto mode
      if (dev.autoInterval) {
        clearInterval(dev.autoInterval);
        dev.autoInterval = null;
      }
      console.log(`[Simulator Engine] Auto-simulation stopped for device: ${cleanThing}`);
      socket.emit('auto_status', { thingName: cleanThing, isAuto: false });
    }
  });

  // 4. Disconnect Device
  socket.on('disconnect_device', (payload) => {
    const { thingName } = payload;
    const cleanThing = thingName.trim();

    if (connectionPool.has(cleanThing)) {
      const dev = connectionPool.get(cleanThing);
      if (dev.autoInterval) clearInterval(dev.autoInterval);
      dev.mqttClient.end();
      connectionPool.delete(cleanThing);
      console.log(`[Simulator Server] Disconnected device: ${cleanThing}`);
      socket.emit('device_status', {
        thingName: cleanThing,
        status: 'disconnected'
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Simulator WS] Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.SIMULATOR_PORT || 5000;
server.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`⚡ Universal Simulator Backend Engine ⚡`);
  console.log(`Listening on http://localhost:${PORT}`);
  console.log(`========================================`);
});
