require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mqtt = require('mqtt');
const fs = require('fs');
const path = require('path');

const certPath = path.resolve(__dirname, '../backend/certs/Device_certificate.crt');
const keyPath = path.resolve(__dirname, '../backend/certs/Private_key.key');
const caPath = path.resolve(__dirname, '../backend/certs/AmazonRootCA1.pem');

const caCert = fs.readFileSync(caPath);
const deviceCert = fs.readFileSync(certPath);
const privateKey = fs.readFileSync(keyPath);

const AWS_ENDPOINT = process.env.AWS_ENDPOINT || 'a3jn1jb4u5t66x-ats.iot.ap-south-1.amazonaws.com';
const CLIENT_ID = 'DASHBOARD_BACKEND_TEST_' + Math.random().toString(36).substring(2, 10);

const mqttOptions = {
  host: AWS_ENDPOINT,
  port: 8883,
  protocol: 'mqtts',
  clientId: CLIENT_ID,
  ca: caCert,
  cert: deviceCert,
  key: privateKey,
  rejectUnauthorized: true,
  keepalive: 30,
  reconnectPeriod: 0 // Do not auto-reconnect so we can see the single failure clearly
};

console.log("MQTT Connect Options:", {
  host: mqttOptions.host,
  port: mqttOptions.port,
  protocol: mqttOptions.protocol,
  clientId: mqttOptions.clientId,
  caLen: mqttOptions.ca.length,
  certLen: mqttOptions.cert.length,
  keyLen: mqttOptions.key.length
});

const client = mqtt.connect(mqttOptions);

client.on('connect', () => {
  console.log("✅ Successfully connected to AWS IoT Core!");
  
  const topicsToSubscribe = [
    'esp32/pub',
    'tenants/+/devices/+/pub'
  ];

  topicsToSubscribe.forEach(topic => {
    console.log(`Subscribing to topic: ${topic}`);
    client.subscribe(topic, (err) => {
      if (err) {
        console.error(`Error subscribing to ${topic}:`, err);
      } else {
        console.log(`Successfully subscribed to: ${topic}`);
      }
    });
  });

  console.log("Keeping connection alive for 10 seconds to verify stability...");
  setTimeout(() => {
    console.log("10 seconds elapsed. Closing connection cleanly.");
    client.end();
  }, 10000);
});

client.on('reconnect', () => {
  console.log("Reconnecting...");
});

client.on('close', () => {
  console.log("❌ Connection closed by broker.");
});

client.on('disconnect', (packet) => {
  console.log("Disconnected packet:", packet);
});

client.on('offline', () => {
  console.log("Client went offline.");
});

client.on('error', (err) => {
  console.error("🔥 MQTT Connection Error:", err);
});
