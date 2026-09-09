require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mqtt = require('mqtt');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

// AWS SDK v3 Imports
const { 
  IoTClient, 
  CreateThingCommand, 
  CreateKeysAndCertificateCommand, 
  AttachThingPrincipalCommand, 
  AttachPolicyCommand,
  CreatePolicyCommand,
  UpdateThingCommand,
  DeleteThingCommand,
  DetachThingPrincipalCommand,
  UpdateCertificateCommand,
  DeleteCertificateCommand,
  ListThingPrincipalsCommand
} = require('@aws-sdk/client-iot');
const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const JWT_SECRET = process.env.JWT_SECRET || 'coreboard-secret-super-key';

function generateUUID() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'alarm-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now().toString(36);
}


const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware: Authenticate JWT Token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
    req.user = user;
    next();
  });
}

// Middleware: Authorize by Role
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized. Token verification required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden. Insufficient permissions.' });
    }
    next();
  };
}


// Rules evaluation and Alarm state machine
async function evaluateRulesAndManageAlarms(tenantId, deviceId, payload) {
  const deviceType = payload.device_type;
  const data = payload.data || payload; // handle flat payloads or nested objects
  
  // Rule triggers list
  const triggers = [];

  if (deviceType === 'pump') {
    if (data.temperature > 70) {
      triggers.push({ type: 'high_temperature', severity: 'CRITICAL', val: data.temperature, msg: `Critical: Pump core temperature is extremely high (${data.temperature}°C).` });
    } else if (data.temperature > 60) {
      triggers.push({ type: 'high_temperature', severity: 'WARNING', val: data.temperature, msg: `Warning: Pump core temperature is elevated (${data.temperature}°C).` });
    }
    if (data.flow_rate < 15) {
      triggers.push({ type: 'low_flow', severity: 'WARNING', val: data.flow_rate, msg: `Warning: Pump flow rate is below normal threshold (${data.flow_rate} L/min).` });
    }
  } else if (deviceType === 'temp_sensor') {
    if (data.temperature > 38) {
      triggers.push({ type: 'high_temp_ambient', severity: 'WARNING', val: data.temperature, msg: `Warning: Ambient temperature is high (${data.temperature}°C).` });
    }
    if (data.humidity > 90) {
      triggers.push({ type: 'high_humidity', severity: 'WARNING', val: data.humidity, msg: `Warning: Ambient humidity is high (${data.humidity}%).` });
    }
  } else if (deviceType === 'pressure_sensor') {
    if (data.pressure > 5.0) {
      triggers.push({ type: 'high_pressure', severity: 'CRITICAL', val: data.pressure, msg: `Critical: Pipeline pressure exceeds safe threshold (${data.pressure} Bar).` });
    } else if (data.pressure > 4.5) {
      triggers.push({ type: 'high_pressure', severity: 'WARNING', val: data.pressure, msg: `Warning: Pipeline pressure is elevated (${data.pressure} Bar).` });
    }
  } else if (deviceType === 'power_meter') {
    if (data.power > 1.5) {
      triggers.push({ type: 'power_overload', severity: 'CRITICAL', val: data.power, msg: `Critical: Smart load draw overload (${data.power} kW).` });
    } else if (data.power > 1.2) {
      triggers.push({ type: 'power_overload', severity: 'WARNING', val: data.power, msg: `Warning: High load draw detected (${data.power} kW).` });
    }
  }

  // Fetch current alarms for this tenant to check state
  const pk = `TENANT#${tenantId}`;
  try {
    const response = await ddbDocClient.send(new QueryCommand({
      TableName: DYNAMODB_TABLE,
      KeyConditionExpression: 'device_id = :pk AND begins_with(#ts, :sk_prefix)',
      ExpressionAttributeNames: { '#ts': 'timestamp' },
      ExpressionAttributeValues: {
        ':pk': pk,
        ':sk_prefix': 'ALARM#'
      }
    }));

    const existingAlarms = response.Items || [];

    // 1. Process Triggers: raise or update active alarms
    for (const t of triggers) {
      const activeAlarm = existingAlarms.find(a => 
        a.actual_device_id === deviceId && 
        a.alarm_type === t.type && 
        (a.status === 'ACTIVE' || a.status === 'ACKNOWLEDGED')
      );

      if (activeAlarm) {
        // Update existing active alarm if values or severity changes
        const updatedAlarm = {
          ...activeAlarm,
          trigger_value: t.val,
          message: t.msg,
          severity: t.severity, // update severity if it escalated
          updated_at: Date.now()
        };
        await ddbDocClient.send(new PutCommand({
          TableName: DYNAMODB_TABLE,
          Item: updatedAlarm
        }));
        io.to('tenant_' + tenantId).emit('alarm_updated', {
          alarm_id: activeAlarm.alarm_id,
          actual_device_id: deviceId,
          alarm_type: t.type,
          severity: t.severity,
          status: activeAlarm.status,
          trigger_value: t.val,
          message: t.msg,
          tenant_id: tenantId
        });
      } else {
        // Raise a new alarm
        const alarmId = generateUUID();
        const alarmItem = {
          device_id: pk,
          timestamp: `ALARM#${alarmId}`,
          alarm_id: alarmId,
          actual_device_id: deviceId,
          alarm_type: t.type,
          severity: t.severity,
          status: 'ACTIVE',
          trigger_value: t.val,
          message: t.msg,
          created_at: Date.now(),
          updated_at: Date.now(),
          acknowledged_at: null,
          cleared_at: null
        };
        await ddbDocClient.send(new PutCommand({
          TableName: DYNAMODB_TABLE,
          Item: alarmItem
        }));
        io.to('tenant_' + tenantId).emit('alarm_triggered', {
          alarm_id: alarmId,
          actual_device_id: deviceId,
          alarm_type: t.type,
          severity: t.severity,
          status: 'ACTIVE',
          trigger_value: t.val,
          message: t.msg,
          tenant_id: tenantId
        });
        console.log(`[Alarm Engine] Raised ${t.severity} Alarm for device ${deviceId}: ${t.msg}`);
      }
    }

    // 2. Process Auto-Clearing: clear active alarms that are no longer triggered
    const activeOrAckAlarmsForDevice = existingAlarms.filter(a => 
      a.actual_device_id === deviceId && 
      (a.status === 'ACTIVE' || a.status === 'ACKNOWLEDGED')
    );

    for (const activeAlarm of activeOrAckAlarmsForDevice) {
      const isStillTriggered = triggers.some(t => t.type === activeAlarm.alarm_type);
      if (!isStillTriggered) {
        // Auto-clear the alarm
        const updatedAlarm = {
          ...activeAlarm,
          status: 'CLEARED',
          cleared_at: Date.now(),
          updated_at: Date.now()
        };
        await ddbDocClient.send(new PutCommand({
          TableName: DYNAMODB_TABLE,
          Item: updatedAlarm
        }));
        io.to('tenant_' + tenantId).emit('alarm_resolved', {
          alarm_id: activeAlarm.alarm_id,
          actual_device_id: deviceId,
          alarm_type: activeAlarm.alarm_type,
          status: 'CLEARED',
          tenant_id: tenantId
        });
        console.log(`[Alarm Engine] Auto-cleared Alarm ${activeAlarm.alarm_id} for device ${deviceId} (values normal)`);
      }
    }

  } catch (error) {
    console.error('[Alarm Engine Error]:', error);
  }
}

const PORT = process.env.PORT || 4000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Initialize AWS Clients
const awsCredentials = {
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  },
  region: process.env.AWS_REGION || 'ap-south-1',
  useDualstackEndpoint: true
};

const iotClient = new IoTClient(awsCredentials);
const ddbClient = new DynamoDBClient(awsCredentials);
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE_NAME || 'ESP32_IoT_Data';

// Helper: Ensure Single-Table DynamoDB Table Exists on Startup
async function ensureDynamoDBTableExists() {
  try {
    await ddbClient.send(new DescribeTableCommand({ TableName: DYNAMODB_TABLE }));
    console.log(`[DynamoDB] Master table '${DYNAMODB_TABLE}' verified successfully.`);
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      console.log(`[DynamoDB] Table '${DYNAMODB_TABLE}' not found. Creating table with single-table design keys (PK, SK)...`);
      try {
        await ddbClient.send(new CreateTableCommand({
          TableName: DYNAMODB_TABLE,
          AttributeDefinitions: [
            { AttributeName: 'device_id', AttributeType: 'S' },
            { AttributeName: 'timestamp', AttributeType: 'S' }
          ],
          KeySchema: [
            { AttributeName: 'device_id', KeyType: 'HASH' },
            { AttributeName: 'timestamp', KeyType: 'RANGE' }
          ],
          BillingMode: 'PAY_PER_REQUEST'
        }));
        console.log(`[DynamoDB] Table '${DYNAMODB_TABLE}' created successfully.`);
      } catch (createError) {
        console.error('[DynamoDB] Failed to create table:', createError);
      }
    } else {
      console.error('[DynamoDB] Error checking table schema:', error);
    }
  }
}

// Helper: Ensure Dynamic Multi-Tenant IoT Policy Exists on Startup
async function ensureIoTPolicyExists() {
  const POLICY_NAME = 'MultiTenantDevicePolicy';
  const BACKEND_POLICY_NAME = 'MultiTenantBackendPolicy';
  const region = process.env.AWS_REGION || 'ap-south-1';
  try {
    const policyDocument = {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: ["iot:Connect"],
          // Wildcard clientId allows simulator to connect as any device
          Resource: [`arn:aws:iot:${region}:*:client/*`]
        },
        {
          Effect: "Allow",
          Action: ["iot:Publish"],
          Resource: [`arn:aws:iot:${region}:*:topic/tenants/*/devices/*/pub`]
        },
        {
          Effect: "Allow",
          Action: ["iot:Subscribe"],
          // IMPORTANT: subscribe must use topicfilter/ not topic/
          Resource: [`arn:aws:iot:${region}:*:topicfilter/tenants/*/devices/*/sub`]
        },
        {
          Effect: "Allow",
          Action: ["iot:Receive"],
          Resource: [`arn:aws:iot:${region}:*:topic/tenants/*/devices/*/sub`]
        }
      ]
    };

    await iotClient.send(new CreatePolicyCommand({
      policyName: POLICY_NAME,
      policyDocument: JSON.stringify(policyDocument)
    }));
    console.log(`[AWS IoT] Dynamic multi-tenant policy '${POLICY_NAME}' created successfully.`);
  } catch (error) {
    if (error.name === 'ResourceAlreadyExistsException' || (error.message && error.message.includes('already exists'))) {
      console.log(`[AWS IoT] Dynamic multi-tenant policy '${POLICY_NAME}' verified successfully.`);
    } else {
      console.error(`[AWS IoT] Error verifying/creating policy '${POLICY_NAME}':`, error.message);
    }
  }

  try {
    const backendPolicyDoc = {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: ["iot:Connect"],
          Resource: [`arn:aws:iot:${region}:*:client/*`]
        },
        {
          Effect: "Allow",
          Action: ["iot:Subscribe", "iot:Receive"],
          Resource: [
            `arn:aws:iot:${region}:*:topicfilter/esp32/pub`,
            `arn:aws:iot:${region}:*:topic/esp32/pub`,
            `arn:aws:iot:${region}:*:topicfilter/tenants/+/devices/+/pub`,
            `arn:aws:iot:${region}:*:topic/tenants/*/devices/*/pub`
          ]
        },
        {
          Effect: "Allow",
          Action: ["iot:Publish"],
          Resource: [`arn:aws:iot:${region}:*:topic/*`]
        }
      ]
    };
    await iotClient.send(new CreatePolicyCommand({
      policyName: BACKEND_POLICY_NAME,
      policyDocument: JSON.stringify(backendPolicyDoc)
    }));
    console.log(`[AWS IoT] Multi-tenant backend policy '${BACKEND_POLICY_NAME}' created successfully.`);
  } catch (error) {
    if (error.name === 'ResourceAlreadyExistsException' || (error.message && error.message.includes('already exists'))) {
      console.log(`[AWS IoT] Multi-tenant backend policy '${BACKEND_POLICY_NAME}' verified successfully.`);
    } else {
      console.error(`[AWS IoT] Error verifying/creating policy '${BACKEND_POLICY_NAME}':`, error.message);
    }
  }
}

// Trigger table and policy verification
ensureDynamoDBTableExists();
ensureIoTPolicyExists();

// Read certificate files for MQTT connection (fallback to local files if env vars are not set)
const caCert = process.env.AWS_CA_CERT 
  ? Buffer.from(process.env.AWS_CA_CERT, 'utf-8')
  : fs.readFileSync(path.join(__dirname, 'certs', 'AmazonRootCA1.pem'));

const deviceCert = process.env.AWS_DEVICE_CERT
  ? Buffer.from(process.env.AWS_DEVICE_CERT, 'utf-8')
  : fs.readFileSync(path.join(__dirname, 'certs', 'Device_certificate.crt'));

const privateKey = process.env.AWS_PRIVATE_KEY
  ? Buffer.from(process.env.AWS_PRIVATE_KEY, 'utf-8')
  : fs.readFileSync(path.join(__dirname, 'certs', 'Private_key.key'));

const AWS_ENDPOINT = process.env.AWS_ENDPOINT || 'a3jn1jb4u5t66x-ats.iot.ap-south-1.amazonaws.com';
const CLIENT_ID = 'DASHBOARD_BACKEND_' + Math.random().toString(36).substring(2, 10);

const mqttOptions = {
  host: AWS_ENDPOINT,
  port: 8883,
  protocol: 'mqtts',
  clientId: CLIENT_ID,
  ca: caCert,
  cert: deviceCert,
  key: privateKey,
  rejectUnauthorized: true,
  keepalive: 30
};

console.log('[Bridge Server] Connecting to AWS IoT Core MQTT Broker...');
const mqttClient = mqtt.connect(mqttOptions);

mqttClient.on('connect', () => {
  console.log('[AWS MQTT] Connected to AWS IoT Core successfully.');
  
  // Subscribe to both legacy topic and multi-tenant wildcard topics
  const topicsToSubscribe = [
    'esp32/pub',
    'tenants/+/devices/+/pub'
  ];

  topicsToSubscribe.forEach(topic => {
    mqttClient.subscribe(topic, (err) => {
      if (err) {
        console.error(`[AWS MQTT] Failed to subscribe to topic ${topic}:`, err);
      } else {
        console.log(`[AWS MQTT] Subscribed to topic: ${topic}`);
      }
    });
  });
});

mqttClient.on('message', async (topic, message) => {
  console.log(`[AWS MQTT] Received message on topic: ${topic}`);
  try {
    const rawPayload = message.toString();
    const payload = JSON.parse(rawPayload);
    console.log('[AWS MQTT] Message Payload:', payload);
    
    // Resolve Tenant ID and Device ID from topic or payload
    let tenantId = 'default-tenant';
    let deviceId = payload.device_id || payload.pump_id || 'unknown-device';

    // Parse tenants/+/devices/+/pub
    const topicParts = topic.split('/');
    if (topicParts[0] === 'tenants' && topicParts[2] === 'devices') {
      tenantId = topicParts[1];
      deviceId = topicParts[3];
    }

    const timestamp = Date.now();

    // Construct dynamic schema-less data dictionary
    let telemetryData = {};
    if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
      telemetryData = { ...payload.data };
    } else {
      const reservedKeys = ['device_id', 'pump_id', 'device_type', 'timestamp', 'status', 'tenant_id'];
      Object.keys(payload).forEach(key => {
        if (!reservedKeys.includes(key) && payload[key] !== undefined) {
          telemetryData[key] = payload[key];
        }
      });
    }

    // Construct Single-Table DynamoDB item using existing table schema (device_id=PK, timestamp=SK)
    const dbItem = {
      device_id: `TENANT#${tenantId}`,
      timestamp: `DEVICE#${deviceId}#TIMESTAMP#${timestamp}`,
      actual_device_id: deviceId,
      raw_timestamp: timestamp,
      device_type: payload.device_type || 'custom',
      status: payload.status || 'optimal',
      data: telemetryData
    };

    // Write to DynamoDB Table
    try {
      await ddbDocClient.send(new PutCommand({
        TableName: DYNAMODB_TABLE,
        Item: dbItem
      }));
      console.log(`[DynamoDB] Logged telemetry for ${deviceId} under tenant ${tenantId}`);
    } catch (dbError) {
      console.error('[DynamoDB Ingestion Error]:', dbError);
    }

    // Broadcast locally to Socket.io UI Clients
    const uiPayload = {
      device_id: deviceId,
      device_type: payload.device_type || 'unknown',
      timestamp: new Date(timestamp).toLocaleTimeString(),
      status: payload.status || 'optimal',
      tenant_id: tenantId,
      ...payload
    };
    io.to('tenant_' + tenantId).emit('telemetry', uiPayload);

    // Evaluate rules and manage alarms asynchronously
    evaluateRulesAndManageAlarms(tenantId, deviceId, payload).catch(err => {
      console.error('[AWS MQTT] Rules Engine error:', err);
    });

  } catch (err) {
    console.error('[AWS MQTT] Error processing message:', err.message);
  }
});

mqttClient.on('error', (err) => {
  console.error('[AWS MQTT] MQTT Client Error:', err);
});

mqttClient.on('offline', () => {
  console.log('[AWS MQTT] Client is offline.');
});

mqttClient.on('close', () => {
  console.log('[AWS MQTT] Connection closed.');
});

mqttClient.on('reconnect', () => {
  console.log('[AWS MQTT] Attempting to reconnect...');
});

// Socket.io JWT Authentication Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.query.token;
  if (!token) {
    return next(new Error('Authentication error: Token required.'));
  }
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error('Authentication error: Invalid or expired token.'));
    socket.user = decoded;
    next();
  });
});

// Socket.io Client Connection handler
io.on('connection', (socket) => {
  const tenantId = socket.user.tenantId;
  const role = socket.user.role;
  console.log(`[Socket.io] Local dashboard client connected: ${socket.id} (Tenant: ${tenantId}, Role: ${role})`);
  
  // Join tenant-isolated room
  socket.join(`tenant_${tenantId}`);

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Local dashboard client disconnected: ${socket.id}`);
  });
});

// ── REST API ROUTES ──────────────────────────────────────────────────────────

// 1. Health Status Route
app.get('/health', (req, res) => {
  res.json({ 
    status: 'UP', 
    mqttConnected: mqttClient.connected,
    dynamoTable: DYNAMODB_TABLE 
  });
});

// 2. Auth Routes
// A. Signup
app.post('/api/auth/signup', async (req, res) => {
  const { tenantId, companyName, email, password, role, signupSecret } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  let finalRole = role || 'ADMIN';
  let finalTenantId = tenantId;
  let finalCompanyName = companyName;

  if (finalRole === 'SUPERADMIN') {
    const expectedSecret = process.env.SUPERADMIN_SIGNUP_SECRET || 'coreboard-superadmin-secret-key-2026';
    if (signupSecret !== expectedSecret) {
      return res.status(401).json({ error: 'Invalid signup secret for Superadmin creation.' });
    }
    finalTenantId = 'superadmin';
    finalCompanyName = 'Coreboard';
  } else {
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required for registration.' });
    }
  }

  const cleanTenantId = finalTenantId.trim().toLowerCase();
  const cleanEmail = email.trim().toLowerCase();
  const userPK = `TENANT#${cleanTenantId}`;
  const userSK = `USER#${cleanEmail}`;

  try {
    // Check if user already exists
    const checkRes = await ddbDocClient.send(new QueryCommand({
      TableName: DYNAMODB_TABLE,
      KeyConditionExpression: 'device_id = :pk AND #ts = :sk',
      ExpressionAttributeNames: {
        '#ts': 'timestamp'
      },
      ExpressionAttributeValues: {
        ':pk': userPK,
        ':sk': userSK
      }
    }));

    if (checkRes.Items && checkRes.Items.length > 0) {
      return res.status(400).json({ error: 'User email already exists under this tenant ID.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userItem = {
      device_id: userPK,
      timestamp: userSK,
      company_name: finalCompanyName || cleanTenantId,
      email: cleanEmail,
      password_hash: passwordHash,
      role: finalRole,
      created_at: Date.now()
    };

    await ddbDocClient.send(new PutCommand({
      TableName: DYNAMODB_TABLE,
      Item: userItem
    }));

    console.log(`[Auth] Registered account: ${cleanEmail} (role: ${finalRole}) under ${cleanTenantId}`);
    res.status(201).json({ success: true, message: 'Account registered successfully.' });
  } catch (err) {
    console.error('[Signup Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// B. Login
app.post('/api/auth/login', async (req, res) => {
  const { tenantId, email, password } = req.body;
  if (!tenantId || !email || !password) {
    return res.status(400).json({ error: 'tenantId, email, and password are required.' });
  }

  const cleanTenantId = tenantId.trim().toLowerCase();
  const cleanEmail = email.trim().toLowerCase();
  const userPK = `TENANT#${cleanTenantId}`;
  const userSK = `USER#${cleanEmail}`;

  try {
    const userRes = await ddbDocClient.send(new QueryCommand({
      TableName: DYNAMODB_TABLE,
      KeyConditionExpression: 'device_id = :pk AND #ts = :sk',
      ExpressionAttributeNames: {
        '#ts': 'timestamp'
      },
      ExpressionAttributeValues: {
        ':pk': userPK,
        ':sk': userSK
      }
    }));

    if (!userRes.Items || userRes.Items.length === 0) {
      return res.status(401).json({ error: 'Invalid Tenant ID, Email, or Password.' });
    }

    const userItem = userRes.Items[0];
    const passwordMatch = await bcrypt.compare(password, userItem.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid Tenant ID, Email, or Password.' });
    }

    const token = jwt.sign(
      { tenantId: cleanTenantId, email: userItem.email, role: userItem.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log(`[Auth] User logged in: ${cleanEmail} under ${cleanTenantId}`);
    res.json({
      success: true,
      token,
      tenant: {
        tenantId: cleanTenantId,
        companyName: userItem.company_name,
        email: userItem.email,
        role: userItem.role
      }
    });
  } catch (err) {
    console.error('[Login Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// C. SuperAdmin Signup
app.post('/api/superadmin/signup', async (req, res) => {
  const { email, password, secretKey } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const expectedSecret = process.env.SUPERADMIN_SIGNUP_SECRET || 'coreboard-superadmin-secret-key-2026';
  if (secretKey !== expectedSecret) {
    return res.status(401).json({ error: 'Invalid SuperAdmin Secret Key.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const userPK = 'TENANT#superadmin';
  const userSK = `USER#${cleanEmail}`;

  try {
    const checkRes = await ddbDocClient.send(new QueryCommand({
      TableName: DYNAMODB_TABLE,
      KeyConditionExpression: 'device_id = :pk AND #ts = :sk',
      ExpressionAttributeNames: { '#ts': 'timestamp' },
      ExpressionAttributeValues: { ':pk': userPK, ':sk': userSK }
    }));

    if (checkRes.Items && checkRes.Items.length > 0) {
      return res.status(400).json({ error: 'SuperAdmin account already exists with this email.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userItem = {
      device_id: userPK,
      timestamp: userSK,
      company_name: 'Coreboard',
      email: cleanEmail,
      password_hash: passwordHash,
      role: 'SUPERADMIN',
      created_at: Date.now()
    };

    await ddbDocClient.send(new PutCommand({
      TableName: DYNAMODB_TABLE,
      Item: userItem
    }));

    console.log(`[SuperAdmin Auth] Registered SuperAdmin: ${cleanEmail}`);
    res.status(201).json({ success: true, message: 'SuperAdmin registered successfully.' });
  } catch (err) {
    console.error('[SuperAdmin Signup Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// D. SuperAdmin Login
app.post('/api/superadmin/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const userPK = 'TENANT#superadmin';
  const userSK = `USER#${cleanEmail}`;

  try {
    const userRes = await ddbDocClient.send(new QueryCommand({
      TableName: DYNAMODB_TABLE,
      KeyConditionExpression: 'device_id = :pk AND #ts = :sk',
      ExpressionAttributeNames: { '#ts': 'timestamp' },
      ExpressionAttributeValues: { ':pk': userPK, ':sk': userSK }
    }));

    if (!userRes.Items || userRes.Items.length === 0) {
      return res.status(401).json({ error: 'Invalid SuperAdmin email or password.' });
    }

    const userItem = userRes.Items[0];
    const passwordMatch = await bcrypt.compare(password, userItem.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid SuperAdmin email or password.' });
    }

    const token = jwt.sign(
      { tenantId: 'superadmin', email: userItem.email, role: 'SUPERADMIN' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log(`[SuperAdmin Auth] SuperAdmin logged in: ${cleanEmail}`);
    res.json({
      success: true,
      token,
      superadmin: {
        email: userItem.email,
        role: 'SUPERADMIN'
      }
    });
  } catch (err) {
    console.error('[SuperAdmin Login Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3. Programmatic Device Provisioning Endpoint (Secured)
// 3. Request Device Setup Endpoint (Tenant Admins)
app.post('/api/tenants/:tenantId/devices/request', authenticateToken, requireRole(['ADMIN', 'SUPERADMIN']), async (req, res) => {
  const { tenantId } = req.params;
  const { deviceId, deviceType } = req.body;

  if (req.user.tenantId !== tenantId.trim().toLowerCase() && req.user.role !== 'SUPERADMIN') {
    return res.status(403).json({ error: 'Unauthorized tenant scope.' });
  }

  if (!deviceId || !deviceType) {
    return res.status(400).json({ error: 'deviceId and deviceType are required.' });
  }

  const cleanTenantId = tenantId.trim().toLowerCase();
  const cleanDeviceId = deviceId.trim();

  try {
    // Save Device Setup Request in DynamoDB using REQUEST#DEVICE# Prefix
    const requestItem = {
      device_id: `TENANT#${cleanTenantId}`,
      timestamp: `REQUEST#DEVICE#${cleanDeviceId}`,
      actual_device_id: cleanDeviceId,
      device_type: deviceType,
      created_at: Date.now(),
      status: 'PENDING'
    };

    await ddbDocClient.send(new PutCommand({
      TableName: DYNAMODB_TABLE,
      Item: requestItem
    }));

    console.log(`[Device Request] Tenant ${cleanTenantId} requested setup for ${cleanDeviceId}`);
    res.json({
      success: true,
      message: `Device addition request for ${cleanDeviceId} initiated successfully.`
    });
  } catch (error) {
    console.error('[Device Request Error]:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3b. List All Pending Device Requests (Superadmin only)
app.get('/api/superadmin/requests', authenticateToken, requireRole(['SUPERADMIN']), async (req, res) => {
  try {
    const response = await ddbDocClient.send(new ScanCommand({
      TableName: DYNAMODB_TABLE,
      FilterExpression: 'begins_with(#sk, :sk_prefix)',
      ExpressionAttributeNames: { '#sk': 'timestamp' },
      ExpressionAttributeValues: { ':sk_prefix': 'REQUEST#DEVICE#' }
    }));

    const requests = (response.Items || []).map(item => {
      const tenantId = item.device_id.replace('TENANT#', '');
      return {
        tenantId,
        deviceId: item.actual_device_id,
        deviceType: item.device_type,
        status: item.status,
        created_at: item.created_at
      };
    });

    res.json(requests);
  } catch (error) {
    console.error('[Get Requests Error]:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3c. Approve Device Request & Provision (Superadmin only)
app.post('/api/superadmin/requests/approve', authenticateToken, requireRole(['SUPERADMIN']), async (req, res) => {
  const { tenantId, deviceId, deviceType } = req.body;

  if (!tenantId || !deviceId || !deviceType) {
    return res.status(400).json({ error: 'tenantId, deviceId, and deviceType are required.' });
  }

  const cleanTenantId = tenantId.trim().toLowerCase();
  const cleanDeviceId = deviceId.trim();

  console.log(`[Superadmin Provisioning] Approving and creating Thing ${cleanDeviceId} for Tenant ${cleanTenantId}`);

  try {
    // A. Create Thing (Asset registration)
    try {
      await iotClient.send(new CreateThingCommand({
        thingName: cleanDeviceId,
        attributePayload: {
          attributes: {
            tenantId: cleanTenantId,
            deviceType: deviceType
          }
        }
      }));
      console.log(`[AWS IoT] Registered Thing successfully: ${cleanDeviceId}`);
    } catch (createError) {
      if (createError.name === 'ResourceAlreadyExistsException' || (createError.message && createError.message.includes('already exists'))) {
        console.log(`[AWS IoT] Thing ${cleanDeviceId} already exists in account with different attributes. Updating attributes...`);
        await iotClient.send(new UpdateThingCommand({
          thingName: cleanDeviceId,
          attributePayload: {
            attributes: {
              tenantId: cleanTenantId,
              deviceType: deviceType
            },
            merge: true
          }
        }));
        console.log(`[AWS IoT] Thing attributes updated successfully for: ${cleanDeviceId}`);
      } else {
        throw createError;
      }
    }

    // B. Create X.509 Cryptographic Key Pair and Certificate
    const certResponse = await iotClient.send(new CreateKeysAndCertificateCommand({
      setAsActive: true
    }));
    const certArn = certResponse.certificateArn;
    const certPem = certResponse.certificatePem;
    const privateKeyPem = certResponse.keyPair.PrivateKey;
    console.log(`[AWS IoT] Generated certificate for Thing: ${cleanDeviceId}`);

    // C. Attach Certificate to Thing Principal
    await iotClient.send(new AttachThingPrincipalCommand({
      thingName: cleanDeviceId,
      principal: certArn
    }));
    console.log(`[AWS IoT] Bound Certificate to Thing successfully.`);

    // D. Attach Multi-Tenant Policies to Certificate
    const POLICY_NAME = 'MultiTenantDevicePolicy';
    await iotClient.send(new AttachPolicyCommand({
      policyName: POLICY_NAME,
      target: certArn
    }));
    await iotClient.send(new AttachPolicyCommand({
      policyName: 'MultiTenantBackendPolicy',
      target: certArn
    }));
    console.log(`[AWS IoT] Associated Policies '${POLICY_NAME}' and 'MultiTenantBackendPolicy' with device certificate.`);

    // E. Save Device Metadata in DynamoDB using METADATA#DEVICE# Prefix
    const deviceItem = {
      device_id: `TENANT#${cleanTenantId}`,
      timestamp: `METADATA#DEVICE#${cleanDeviceId}`,
      actual_device_id: cleanDeviceId,
      device_type: deviceType,
      created_at: Date.now(),
      status: 'inactive'
    };

    await ddbDocClient.send(new PutCommand({
      TableName: DYNAMODB_TABLE,
      Item: deviceItem
    }));
    console.log(`[DynamoDB] Device metadata logged under Tenant: ${cleanTenantId}`);

    // F. Delete the Setup Request from DynamoDB
    await ddbDocClient.send(new DeleteCommand({
      TableName: DYNAMODB_TABLE,
      Key: {
        device_id: `TENANT#${cleanTenantId}`,
        timestamp: `REQUEST#DEVICE#${cleanDeviceId}`
      }
    }));
    console.log(`[DynamoDB] Deleted setup request for ${cleanDeviceId}`);

    res.json({
      success: true,
      message: `Device ${cleanDeviceId} has been provisioned successfully under Tenant ${cleanTenantId}.`,
      credentials: {
        certificatePem: certPem,
        privateKeyPem: privateKeyPem,
        certificateArn: certArn,
        rootCaPem: caCert ? caCert.toString('utf-8') : ''
      }
    });

  } catch (error) {
    console.error(`[Provisioning Error] Failed to provision device ${cleanDeviceId}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Public Endpoints for Simulator Helpers (CORS-enabled, read-only)
app.get('/api/public/tenants', async (req, res) => {
  try {
    const response = await ddbDocClient.send(new ScanCommand({
      TableName: DYNAMODB_TABLE,
      FilterExpression: 'begins_with(#sk, :sk_prefix)',
      ExpressionAttributeNames: { '#sk': 'timestamp' },
      ExpressionAttributeValues: { ':sk_prefix': 'USER#' }
    }));

    const tenantsMap = new Map();
    (response.Items || []).forEach(item => {
      const tenantId = item.device_id.replace('TENANT#', '');
      if (tenantId !== 'superadmin' && !tenantsMap.has(tenantId)) {
        tenantsMap.set(tenantId, {
          tenantId,
          companyName: item.company_name || tenantId
        });
      }
    });

    res.json(Array.from(tenantsMap.values()));
  } catch (error) {
    console.error('[Public Get Tenants Error]:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/public/tenants/:tenantId/devices', async (req, res) => {
  const { tenantId } = req.params;
  const cleanTenantId = tenantId.trim().toLowerCase();

  try {
    const response = await ddbDocClient.send(new QueryCommand({
      TableName: DYNAMODB_TABLE,
      KeyConditionExpression: 'device_id = :pk AND begins_with(#ts, :sk_prefix)',
      ExpressionAttributeNames: {
        '#ts': 'timestamp'
      },
      ExpressionAttributeValues: {
        ':pk': `TENANT#${cleanTenantId}`,
        ':sk_prefix': 'METADATA#DEVICE#'
      }
    }));

    const devices = (response.Items || []).map(item => ({
      deviceId: item.timestamp.replace('METADATA#DEVICE#', ''),
      deviceType: item.device_type || 'pump'
    }));

    res.json(devices);
  } catch (error) {
    console.error('[Public Get Tenant Devices Error]:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3d. List All Onboarded Tenants (Superadmin only)
app.get('/api/superadmin/tenants', authenticateToken, requireRole(['SUPERADMIN']), async (req, res) => {
  try {
    const response = await ddbDocClient.send(new ScanCommand({
      TableName: DYNAMODB_TABLE,
      FilterExpression: 'begins_with(#sk, :sk_prefix)',
      ExpressionAttributeNames: { '#sk': 'timestamp' },
      ExpressionAttributeValues: { ':sk_prefix': 'USER#' }
    }));

    const tenantsMap = new Map();
    (response.Items || []).forEach(item => {
      const tenantId = item.device_id.replace('TENANT#', '');
      if (tenantId !== 'superadmin' && !tenantsMap.has(tenantId)) {
        tenantsMap.set(tenantId, {
          tenantId,
          companyName: item.company_name || tenantId,
          adminEmail: item.email,
          created_at: item.created_at
        });
      }
    });

    res.json(Array.from(tenantsMap.values()));
  } catch (error) {
    console.error('[Get Tenants Error]:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3d-2. Onboard New Tenant (Superadmin only)
app.post('/api/superadmin/tenants/onboard', authenticateToken, requireRole(['SUPERADMIN']), async (req, res) => {
  const { tenantId, companyName, email, password } = req.body;
  if (!tenantId || !companyName || !email || !password) {
    return res.status(400).json({ error: 'tenantId, companyName, email, and password are required.' });
  }

  const cleanTenantId = tenantId.trim().toLowerCase();
  const cleanEmail = email.trim().toLowerCase();
  const userPK = `TENANT#${cleanTenantId}`;
  const userSK = `USER#${cleanEmail}`;

  try {
    const checkRes = await ddbDocClient.send(new QueryCommand({
      TableName: DYNAMODB_TABLE,
      KeyConditionExpression: 'device_id = :pk AND #ts = :sk',
      ExpressionAttributeNames: { '#ts': 'timestamp' },
      ExpressionAttributeValues: { ':pk': userPK, ':sk': userSK }
    }));

    if (checkRes.Items && checkRes.Items.length > 0) {
      return res.status(400).json({ error: 'Tenant admin already exists for this tenant ID.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userItem = {
      device_id: userPK,
      timestamp: userSK,
      company_name: companyName.trim(),
      email: cleanEmail,
      password_hash: passwordHash,
      role: 'ADMIN',
      created_at: Date.now()
    };

    const metadataItem = {
      device_id: userPK,
      timestamp: 'METADATA',
      company_name: companyName.trim(),
      tenant_id: cleanTenantId,
      admin_email: cleanEmail,
      created_at: Date.now(),
      status: 'ACTIVE'
    };

    await ddbDocClient.send(new PutCommand({
      TableName: DYNAMODB_TABLE,
      Item: userItem
    }));

    await ddbDocClient.send(new PutCommand({
      TableName: DYNAMODB_TABLE,
      Item: metadataItem
    }));

    console.log(`[Superadmin] Onboarded new tenant: ${companyName} (${cleanTenantId}) with admin ${cleanEmail}`);
    res.status(201).json({ success: true, message: `Tenant ${companyName} onboarded successfully.` });
  } catch (err) {
    console.error('[Onboard Tenant Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3d-3. Permanently Delete Tenant Partition (Superadmin only)
app.delete('/api/superadmin/tenants/:tenantId', authenticateToken, requireRole(['SUPERADMIN']), async (req, res) => {
  const { tenantId } = req.params;
  const cleanTenantId = tenantId.trim().toLowerCase();

  if (cleanTenantId === 'superadmin') {
    return res.status(400).json({ error: 'Cannot delete system superadmin tenant partition.' });
  }

  const pk = `TENANT#${cleanTenantId}`;

  try {
    // 1. Query all items belonging to this tenant partition
    const tenantItemsRes = await ddbDocClient.send(new QueryCommand({
      TableName: DYNAMODB_TABLE,
      KeyConditionExpression: 'device_id = :pk',
      ExpressionAttributeValues: { ':pk': pk }
    }));

    const items = tenantItemsRes.Items || [];

    // 2. Cleanup AWS IoT Core Things & Certificates for any registered devices
    for (const item of items) {
      if (item.timestamp && item.timestamp.startsWith('METADATA#DEVICE#')) {
        const deviceId = item.timestamp.replace('METADATA#DEVICE#', '');
        try {
          const principals = await iotClient.send(new ListThingPrincipalsCommand({
            thingName: deviceId
          }));
          for (const principal of (principals.principals || [])) {
            const certId = principal.split('/').pop();
            console.log(`[Superadmin Tenant Delete] Detaching principal ${principal} from Thing ${deviceId}...`);
            await iotClient.send(new DetachThingPrincipalCommand({
              thingName: deviceId,
              principal: principal
            }));
            await iotClient.send(new UpdateCertificateCommand({
              certificateId: certId,
              newStatus: 'INACTIVE'
            }));
            await iotClient.send(new DeleteCertificateCommand({
              certificateId: certId
            }));
            console.log(`[Superadmin Tenant Delete] Deleted cert ${certId}`);
          }
        } catch (err) {
          console.warn(`[Superadmin Tenant Delete Warning] Failed clearing principals for ${deviceId}:`, err.message);
        }

        try {
          await iotClient.send(new DeleteThingCommand({
            thingName: deviceId
          }));
          console.log(`[Superadmin Tenant Delete] Deleted Thing: ${deviceId}`);
        } catch (err) {
          console.warn(`[Superadmin Tenant Delete Warning] Failed deleting Thing ${deviceId}:`, err.message);
        }
      }
    }

    // 3. Delete all DynamoDB partition items
    for (const item of items) {
      await ddbDocClient.send(new DeleteCommand({
        TableName: DYNAMODB_TABLE,
        Key: {
          device_id: pk,
          timestamp: item.timestamp
        }
      }));
    }

    console.log(`[Superadmin Tenant Delete] Tenant ${cleanTenantId} and ${items.length} items permanently deleted.`);
    res.json({ success: true, message: `Tenant ${cleanTenantId} and all associated items permanently deleted.` });
  } catch (error) {
    console.error('[Delete Tenant Error]:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3e. Direct Device Provisioning Without Request (Superadmin only)
app.post('/api/superadmin/tenants/:tenantId/devices/provision', authenticateToken, requireRole(['SUPERADMIN']), async (req, res) => {
  const { tenantId } = req.params;
  const { deviceId, deviceType } = req.body;

  if (!tenantId || !deviceId || !deviceType) {
    return res.status(400).json({ error: 'tenantId, deviceId, and deviceType are required.' });
  }

  const cleanTenantId = tenantId.trim().toLowerCase();
  const cleanDeviceId = deviceId.trim();

  console.log(`[Superadmin Direct Provisioning] Creating Thing ${cleanDeviceId} for Tenant ${cleanTenantId}`);

  try {
    // 1. Create Thing dynamically in AWS IoT
    try {
      await iotClient.send(new CreateThingCommand({
        thingName: cleanDeviceId,
        attributePayload: {
          attributes: {
            tenantId: cleanTenantId,
            deviceType: deviceType
          }
        }
      }));
      console.log(`[AWS IoT] Registered Thing successfully: ${cleanDeviceId}`);
    } catch (createError) {
      if (createError.name === 'ResourceAlreadyExistsException' || (createError.message && createError.message.includes('already exists'))) {
        console.log(`[AWS IoT] Thing ${cleanDeviceId} already exists in account with different attributes. Updating attributes...`);
        await iotClient.send(new UpdateThingCommand({
          thingName: cleanDeviceId,
          attributePayload: {
            attributes: {
              tenantId: cleanTenantId,
              deviceType: deviceType
            },
            merge: true
          }
        }));
        console.log(`[AWS IoT] Thing attributes updated successfully for: ${cleanDeviceId}`);
      } else {
        throw createError;
      }
    }

    // 2. Generate unique X.509 Cryptographic Client Credentials
    const certResponse = await iotClient.send(new CreateKeysAndCertificateCommand({
      setAsActive: true
    }));
    const certArn = certResponse.certificateArn;
    const certPem = certResponse.certificatePem;
    const privateKeyPem = certResponse.keyPair.PrivateKey;
    console.log(`[AWS IoT] Generated certificate for Thing: ${cleanDeviceId}`);

    // 3. Bind certificate to Thing principal and attach connection policies
    await iotClient.send(new AttachThingPrincipalCommand({
      thingName: cleanDeviceId,
      principal: certArn
    }));
    await iotClient.send(new AttachPolicyCommand({
      policyName: 'MultiTenantDevicePolicy',
      target: certArn
    }));
    await iotClient.send(new AttachPolicyCommand({
      policyName: 'MultiTenantBackendPolicy',
      target: certArn
    }));
    console.log(`[AWS IoT] Associated connection policies with device certificate.`);

    // 4. Save Configuration Metadata in DynamoDB using METADATA#DEVICE#
    const deviceItem = {
      device_id: `TENANT#${cleanTenantId}`,
      timestamp: `METADATA#DEVICE#${cleanDeviceId}`,
      actual_device_id: cleanDeviceId,
      device_type: deviceType,
      created_at: Date.now(),
      status: 'inactive'
    };

    await ddbDocClient.send(new PutCommand({
      TableName: DYNAMODB_TABLE,
      Item: deviceItem
    }));
    console.log(`[DynamoDB] Device metadata logged under Tenant: ${cleanTenantId}`);

    // F. Clean up any redundant setup requests for this device ID if it exists
    try {
      await ddbDocClient.send(new DeleteCommand({
        TableName: DYNAMODB_TABLE,
        Key: {
          device_id: `TENANT#${cleanTenantId}`,
          timestamp: `REQUEST#DEVICE#${cleanDeviceId}`
        }
      }));
    } catch (_) {}

    res.json({
      success: true,
      message: `Device ${cleanDeviceId} has been provisioned successfully under Tenant ${cleanTenantId}.`,
      credentials: {
        certificatePem: certPem,
        privateKeyPem: privateKeyPem,
        certificateArn: certArn,
        rootCaPem: caCert ? caCert.toString('utf-8') : ''
      }
    });

  } catch (error) {
    console.error(`[Provisioning Error] Failed to provision device ${cleanDeviceId}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// 3f. Get Tenant Devices (Superadmin only)
app.get('/api/superadmin/tenants/:tenantId/devices', authenticateToken, requireRole(['SUPERADMIN']), async (req, res) => {
  const { tenantId } = req.params;
  const cleanTenantId = tenantId.trim().toLowerCase();

  try {
    const response = await ddbDocClient.send(new QueryCommand({
      TableName: DYNAMODB_TABLE,
      KeyConditionExpression: 'device_id = :pk AND begins_with(#ts, :sk_prefix)',
      ExpressionAttributeNames: {
        '#ts': 'timestamp'
      },
      ExpressionAttributeValues: {
        ':pk': `TENANT#${cleanTenantId}`,
        ':sk_prefix': 'METADATA#DEVICE#'
      }
    }));

    const devices = (response.Items || []).map(item => {
      const devId = item.actual_device_id || (item.timestamp ? item.timestamp.replace('METADATA#DEVICE#', '') : 'unknown-device');
      return {
        device_id: devId,
        actual_device_id: devId,
        device_type: item.device_type || 'unknown',
        status: item.status || 'active',
        created_at: item.created_at || Date.now(),
        certArn: item.certArn || ''
      };
    });

    res.json(devices);
  } catch (error) {
    console.error('[Superadmin Get Tenant Devices Error]:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3g. Regenerate Device Credentials / Re-Setup (Superadmin only)
app.post(['/api/superadmin/tenants/:tenantId/devices/:deviceId/reset', '/api/superadmin/tenants/:tenantId/devices/:deviceId/regenerate-keys'], authenticateToken, requireRole(['SUPERADMIN']), async (req, res) => {
  const { tenantId, deviceId } = req.params;
  const cleanTenantId = tenantId.trim().toLowerCase();
  const cleanDeviceId = deviceId.trim();

  try {
    // 1. Query current metadata to verify device exists
    const queryRes = await ddbDocClient.send(new QueryCommand({
      TableName: DYNAMODB_TABLE,
      KeyConditionExpression: 'device_id = :pk AND #ts = :sk',
      ExpressionAttributeNames: { '#ts': 'timestamp' },
      ExpressionAttributeValues: {
        ':pk': `TENANT#${cleanTenantId}`,
        ':sk': `METADATA#DEVICE#${cleanDeviceId}`
      }
    }));

    if (!queryRes.Items || queryRes.Items.length === 0) {
      return res.status(404).json({ error: `Device ${cleanDeviceId} not found under tenant ${cleanTenantId}.` });
    }

    const deviceMetadata = queryRes.Items[0];

    // 2. Detach and delete any old certificates connected to this Thing
    try {
      const principals = await iotClient.send(new ListThingPrincipalsCommand({
        thingName: cleanDeviceId
      }));
      for (const principal of (principals.principals || [])) {
        const certId = principal.split('/').pop();
        console.log(`[AWS IoT Reset] Detaching old principal ${principal} from Thing ${cleanDeviceId}...`);
        await iotClient.send(new DetachThingPrincipalCommand({
          thingName: cleanDeviceId,
          principal: principal
        }));
        await iotClient.send(new UpdateCertificateCommand({
          certificateId: certId,
          newStatus: 'INACTIVE'
        }));
        await iotClient.send(new DeleteCertificateCommand({
          certificateId: certId
        }));
        console.log(`[AWS IoT Reset] Successfully deleted old cert ${certId}`);
      }
    } catch (detachError) {
      console.warn(`[AWS IoT Reset Warning] Failed detaching old principals for ${cleanDeviceId}:`, detachError.message);
    }

    // 3. Generate new X.509 Cryptographic Key Pair and Certificate
    const certResponse = await iotClient.send(new CreateKeysAndCertificateCommand({
      setAsActive: true
    }));
    const certArn = certResponse.certificateArn;
    const certPem = certResponse.certificatePem;
    const privateKeyPem = certResponse.keyPair.PrivateKey;

    // 4. Attach new principal & policies to Thing
    await iotClient.send(new AttachThingPrincipalCommand({
      thingName: cleanDeviceId,
      principal: certArn
    }));

    const policyName = 'MultiTenantDevicePolicy';
    await iotClient.send(new AttachPolicyCommand({
      policyName: policyName,
      target: certArn
    }));
    await iotClient.send(new AttachPolicyCommand({
      policyName: 'MultiTenantBackendPolicy',
      target: certArn
    }));

    // 5. Update DynamoDB metadata
    await ddbDocClient.send(new PutCommand({
      TableName: DYNAMODB_TABLE,
      Item: {
        ...deviceMetadata,
        certArn: certArn,
        updated_at: Date.now()
      }
    }));

    res.json({
      success: true,
      message: `Credentials regenerated successfully for device ${cleanDeviceId}.`,
      credentials: {
        certificatePem: certPem,
        privateKeyPem: privateKeyPem,
        certificateArn: certArn,
        rootCaPem: caCert ? caCert.toString('utf-8') : ''
      }
    });

  } catch (error) {
    console.error('[Superadmin Device Reset Error]:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3h. Delete Device Registry (Superadmin only)
app.delete('/api/superadmin/tenants/:tenantId/devices/:deviceId', authenticateToken, requireRole(['SUPERADMIN']), async (req, res) => {
  const { tenantId, deviceId } = req.params;
  const cleanTenantId = tenantId.trim().toLowerCase();
  const cleanDeviceId = deviceId.trim();

  try {
    // 1. Detach and delete certificates from AWS IoT Core
    try {
      const principals = await iotClient.send(new ListThingPrincipalsCommand({
        thingName: cleanDeviceId
      }));
      for (const principal of (principals.principals || [])) {
        const certId = principal.split('/').pop();
        console.log(`[AWS IoT Delete] Detaching principal ${principal} from Thing ${cleanDeviceId}...`);
        await iotClient.send(new DetachThingPrincipalCommand({
          thingName: cleanDeviceId,
          principal: principal
        }));
        await iotClient.send(new UpdateCertificateCommand({
          certificateId: certId,
          newStatus: 'INACTIVE'
        }));
        await iotClient.send(new DeleteCertificateCommand({
          certificateId: certId
        }));
        console.log(`[AWS IoT Delete] Successfully deleted cert ${certId}`);
      }
    } catch (err) {
      console.warn(`[AWS IoT Delete Warning] Failed clearing principals:`, err.message);
    }

    // 2. Delete Thing from AWS IoT Core
    try {
      await iotClient.send(new DeleteThingCommand({
        thingName: cleanDeviceId
      }));
      console.log(`[AWS IoT Delete] Thing deleted: ${cleanDeviceId}`);
    } catch (err) {
      console.warn(`[AWS IoT Delete Warning] Failed deleting Thing:`, err.message);
    }

    // 3. Delete from DynamoDB
    await ddbDocClient.send(new DeleteCommand({
      TableName: DYNAMODB_TABLE,
      Key: {
        device_id: `TENANT#${cleanTenantId}`,
        timestamp: `METADATA#DEVICE#${cleanDeviceId}`
      }
    }));

    res.json({
      success: true,
      message: `Device ${cleanDeviceId} deleted successfully from DynamoDB and AWS IoT.`
    });
  } catch (error) {
    console.error('[Superadmin Delete Device Error]:', error);
    res.status(500).json({ error: error.message });
  }
});

// 4. List Tenant Devices Endpoint (Secured)
app.get('/api/tenants/:tenantId/devices', authenticateToken, async (req, res) => {
  const { tenantId } = req.params;
  const cleanTenantId = tenantId.trim().toLowerCase();

  if (req.user.tenantId !== cleanTenantId) {
    return res.status(403).json({ error: 'Unauthorized tenant scope.' });
  }

  try {
    const response = await ddbDocClient.send(new QueryCommand({
      TableName: DYNAMODB_TABLE,
      KeyConditionExpression: 'device_id = :pk AND begins_with(#ts, :sk_prefix)',
      ExpressionAttributeNames: {
        '#ts': 'timestamp'
      },
      ExpressionAttributeValues: {
        ':pk': `TENANT#${cleanTenantId}`,
        ':sk_prefix': 'METADATA#DEVICE#'
      }
    }));

    const devices = (response.Items || []).map(item => {
      const devId = item.actual_device_id || (item.timestamp ? item.timestamp.replace('METADATA#DEVICE#', '') : 'unknown-device');
      return {
        device_id: devId,
        actual_device_id: devId,
        device_type: item.device_type || 'unknown',
        created_at: item.created_at || Date.now(),
        status: item.status || 'inactive'
      };
    });

    res.json(devices);
  } catch (error) {
    console.error('[Get Devices Error]:', error);
    res.status(500).json({ error: error.message });
  }
});

// 5. Multi-Tenant Isolated Telemetry Query Route (Secured & Filtered)
app.get('/api/tenants/:tenantId/telemetry', authenticateToken, async (req, res) => {
  const { tenantId } = req.params;
  const cleanTenantId = tenantId.trim().toLowerCase();

  if (req.user.tenantId !== cleanTenantId) {
    return res.status(403).json({ error: 'Unauthorized tenant scope.' });
  }

  console.log(`[Admin Telemetry Query] Querying DB for Tenant: ${cleanTenantId}`);

  try {
    const response = await ddbDocClient.send(new QueryCommand({
      TableName: DYNAMODB_TABLE,
      KeyConditionExpression: 'device_id = :pk',
      ExpressionAttributeValues: {
        ':pk': `TENANT#${cleanTenantId}`
      },
      ScanIndexForward: false, // Latest first
      Limit: 200
    }));

    // Filter out users and metadata, parsing only telemetry records (SK begins with DEVICE#)
    const telemetryRecords = response.Items.filter(item => item.timestamp.startsWith('DEVICE#'));

    // Transform Single-Table items back to flat list for dashboard UI
    const mappedTelemetry = telemetryRecords.map(item => {
      // Decode SK format: DEVICE#<deviceId>#TIMESTAMP#<unix_ms>
      const skParts = item.timestamp.split('#');
      const deviceId = skParts[1];
      const rawTimestamp = Number(skParts[3]);

      return {
        device_id: deviceId,
        device_type: item.device_type,
        timestamp: new Date(rawTimestamp).toLocaleTimeString(),
        status: item.status || 'optimal',
        ...item.data
      };
    });

    res.json(mappedTelemetry);
  } catch (error) {
    console.error(`[Query Error] Failed to query telemetry for tenant ${cleanTenantId}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// 6. Simulate Telemetry Endpoint (For Testing Harness)
app.post('/api/tenants/:tenantId/devices/:deviceId/telemetry/simulate', authenticateToken, async (req, res) => {
  const { tenantId, deviceId } = req.params;
  const cleanTenantId = tenantId.trim().toLowerCase();
  const cleanDeviceId = deviceId.trim();

  if (req.user.tenantId !== cleanTenantId) {
    return res.status(403).json({ error: 'Unauthorized tenant scope.' });
  }

  const payload = req.body;
  const timestamp = Date.now();

  try {
    // 100% Device-Agnostic: Extract all non-metadata fields as custom device data
    const { device_id, device_type, timestamp: rawTs, status, tenant_id, ...customData } = payload;

    const dbItem = {
      device_id: `TENANT#${cleanTenantId}`,
      timestamp: `DEVICE#${cleanDeviceId}#TIMESTAMP#${timestamp}`,
      actual_device_id: cleanDeviceId,
      raw_timestamp: timestamp,
      device_type: payload.device_type || 'unknown',
      status: payload.status || 'optimal',
      data: Object.keys(customData).length > 0 ? customData : {
        flow_rate: payload.flow_rate,
        temperature: payload.temperature,
        humidity: payload.humidity,
        pressure: payload.pressure,
        voltage: payload.voltage,
        current: payload.current,
        power: payload.power
      }
    };

    // Remove undefined fields
    Object.keys(dbItem.data).forEach(key => {
      if (dbItem.data[key] === undefined) {
        delete dbItem.data[key];
      }
    });

    await ddbDocClient.send(new PutCommand({
      TableName: DYNAMODB_TABLE,
      Item: dbItem
    }));

    const uiPayload = {
      device_id: cleanDeviceId,
      device_type: payload.device_type || 'unknown',
      timestamp: new Date(timestamp).toLocaleTimeString(),
      status: payload.status || 'optimal',
      tenant_id: cleanTenantId,
      ...payload
    };

    io.emit('telemetry', uiPayload);
    console.log(`[Simulator API] Ingested simulated telemetry for ${cleanDeviceId}`);

    // Evaluate rules and manage alarms asynchronously
    evaluateRulesAndManageAlarms(cleanTenantId, cleanDeviceId, payload).catch(err => {
      console.error('[Simulator API] Rules Engine error:', err);
    });

    res.json({ success: true, message: 'Simulated telemetry ingested successfully.', data: uiPayload });
  } catch (error) {
    console.error('[Telemetry Simulation Error]:', error);
    res.status(500).json({ error: error.message });
  }
});

// 6c. Public Simulator Helper Endpoints (Unauthenticated for standalone Simulator UI)
app.get('/api/public/tenants', async (req, res) => {
  try {
    const response = await ddbDocClient.send(new ScanCommand({
      TableName: DYNAMODB_TABLE,
      FilterExpression: 'begins_with(#sk, :sk_prefix)',
      ExpressionAttributeNames: { '#sk': 'timestamp' },
      ExpressionAttributeValues: { ':sk_prefix': 'USER#' }
    }));
    
    const tenantMap = new Map();
    (response.Items || []).forEach(item => {
      const tid = item.device_id.replace('TENANT#', '');
      if (tid !== 'superadmin' && !tenantMap.has(tid)) {
        tenantMap.set(tid, {
          tenantId: tid,
          companyName: item.company_name || tid
        });
      }
    });
    
    res.json(Array.from(tenantMap.values()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/public/tenants/:tenantId/devices', async (req, res) => {
  const { tenantId } = req.params;
  const cleanTenantId = tenantId.trim().toLowerCase();
  try {
    const response = await ddbDocClient.send(new QueryCommand({
      TableName: DYNAMODB_TABLE,
      KeyConditionExpression: 'device_id = :pk AND begins_with(#sk, :sk_prefix)',
      ExpressionAttributeNames: { '#sk': 'timestamp' },
      ExpressionAttributeValues: {
        ':pk': `TENANT#${cleanTenantId}`,
        ':sk_prefix': 'METADATA#DEVICE#'
      }
    }));
    
    const devices = (response.Items || []).map(item => {
      const devId = item.actual_device_id || (item.timestamp ? item.timestamp.replace('METADATA#DEVICE#', '') : 'unknown-device');
      return {
        deviceId: devId,
        device_id: devId,
        actual_device_id: devId,
        deviceType: item.device_type || 'unknown',
        device_type: item.device_type || 'unknown',
        status: item.status || 'inactive'
      };
    });
    
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6b. Actuate Device Control Endpoint (Downlink actuator trigger)
app.post('/api/tenants/:tenantId/devices/:deviceId/actuate', authenticateToken, async (req, res) => {
  const { tenantId, deviceId } = req.params;
  const cleanTenantId = tenantId.trim().toLowerCase();
  const cleanDeviceId = deviceId.trim();

  // Allow tenant members or global SuperAdmin to actuate controls
  if (req.user.tenantId !== cleanTenantId && req.user.role !== 'SUPERADMIN') {
    return res.status(403).json({ error: 'Unauthorized tenant scope.' });
  }

  const { command, field, value } = req.body;
  if (!field || value === undefined) {
    return res.status(400).json({ error: 'field and value are required.' });
  }

  const targetTopic = `tenants/${cleanTenantId}/devices/${cleanDeviceId}/sub`;
  const actuationPayload = {
    command: command || 'actuate',
    field,
    value,
    timestamp: new Date().toISOString()
  };

  try {
    if (!mqttClient.connected) {
      throw new Error('MQTT Broker not connected.');
    }

    mqttClient.publish(targetTopic, JSON.stringify(actuationPayload), { qos: 1 }, (err) => {
      if (err) {
        console.error(`[AWS MQTT] Failed to publish actuation command to ${cleanDeviceId}:`, err);
        return res.status(500).json({ error: 'Failed to deliver actuation payload to device broker.' });
      }
      
      console.log(`[Actuation Control] Published command to ${targetTopic}:`, actuationPayload);
      res.json({ 
        success: true, 
        message: 'Actuation command published successfully.', 
        payload: actuationPayload 
      });
    });
  } catch (error) {
    console.error('[Actuation Control Error]:', error);
    res.status(500).json({ error: error.message });
  }
});

// 7. Get Alarms Route (Secured)
app.get('/api/tenants/:tenantId/alarms', authenticateToken, async (req, res) => {
  const { tenantId } = req.params;
  const cleanTenantId = tenantId.trim().toLowerCase();

  if (req.user.tenantId !== cleanTenantId) {
    return res.status(403).json({ error: 'Unauthorized tenant scope.' });
  }

  try {
    const response = await ddbDocClient.send(new QueryCommand({
      TableName: DYNAMODB_TABLE,
      KeyConditionExpression: 'device_id = :pk AND begins_with(#ts, :sk_prefix)',
      ExpressionAttributeNames: { '#ts': 'timestamp' },
      ExpressionAttributeValues: {
        ':pk': `TENANT#${cleanTenantId}`,
        ':sk_prefix': 'ALARM#'
      }
    }));

    // Map back to a clean list
    const alarms = (response.Items || []).map(item => ({
      alarm_id: item.alarm_id,
      device_id: item.actual_device_id,
      alarm_type: item.alarm_type,
      severity: item.severity,
      status: item.status,
      trigger_value: item.trigger_value,
      message: item.message,
      created_at: item.created_at,
      updated_at: item.updated_at,
      acknowledged_at: item.acknowledged_at,
      cleared_at: item.cleared_at
    }));

    res.json(alarms);
  } catch (error) {
    console.error('[Get Alarms Error]:', error);
    res.status(500).json({ error: error.message });
  }
});

// 8. Acknowledge Alarm Route (Secured)
app.post('/api/tenants/:tenantId/alarms/:alarmId/acknowledge', authenticateToken, async (req, res) => {
  const { tenantId, alarmId } = req.params;
  const cleanTenantId = tenantId.trim().toLowerCase();

  if (req.user.tenantId !== cleanTenantId) {
    return res.status(403).json({ error: 'Unauthorized tenant scope.' });
  }

  try {
    const pk = `TENANT#${cleanTenantId}`;
    const sk = `ALARM#${alarmId}`;

    // Fetch the alarm first
    const alarmRes = await ddbDocClient.send(new QueryCommand({
      TableName: DYNAMODB_TABLE,
      KeyConditionExpression: 'device_id = :pk AND #ts = :sk',
      ExpressionAttributeNames: { '#ts': 'timestamp' },
      ExpressionAttributeValues: {
        ':pk': pk,
        ':sk': sk
      }
    }));

    if (!alarmRes.Items || alarmRes.Items.length === 0) {
      return res.status(404).json({ error: 'Alarm not found.' });
    }

    const alarmItem = alarmRes.Items[0];
    if (alarmItem.status === 'CLEARED') {
      return res.status(400).json({ error: 'Alarm already cleared, cannot acknowledge.' });
    }

    alarmItem.status = 'ACKNOWLEDGED';
    alarmItem.acknowledged_at = Date.now();
    alarmItem.updated_at = Date.now();

    await ddbDocClient.send(new PutCommand({
      TableName: DYNAMODB_TABLE,
      Item: alarmItem
    }));

    const updatePayload = {
      alarm_id: alarmId,
      actual_device_id: alarmItem.actual_device_id,
      alarm_type: alarmItem.alarm_type,
      status: 'ACKNOWLEDGED',
      tenant_id: cleanTenantId
    };
    io.to('tenant_' + cleanTenantId).emit('alarm_updated', updatePayload);

    console.log(`[Alarm Engine] Alarm ${alarmId} acknowledged by operator.`);
    res.json({ success: true, alarm: alarmItem });
  } catch (error) {
    console.error('[Acknowledge Alarm Error]:', error);
    res.status(500).json({ error: error.message });
  }
});

// 9. Clear Alarm Route (Secured)
app.post('/api/tenants/:tenantId/alarms/:alarmId/clear', authenticateToken, async (req, res) => {
  const { tenantId, alarmId } = req.params;
  const cleanTenantId = tenantId.trim().toLowerCase();

  if (req.user.tenantId !== cleanTenantId) {
    return res.status(403).json({ error: 'Unauthorized tenant scope.' });
  }

  try {
    const pk = `TENANT#${cleanTenantId}`;
    const sk = `ALARM#${alarmId}`;

    const alarmRes = await ddbDocClient.send(new QueryCommand({
      TableName: DYNAMODB_TABLE,
      KeyConditionExpression: 'device_id = :pk AND #ts = :sk',
      ExpressionAttributeNames: { '#ts': 'timestamp' },
      ExpressionAttributeValues: {
        ':pk': pk,
        ':sk': sk
      }
    }));

    if (!alarmRes.Items || alarmRes.Items.length === 0) {
      return res.status(404).json({ error: 'Alarm not found.' });
    }

    const alarmItem = alarmRes.Items[0];
    
    alarmItem.status = 'CLEARED';
    alarmItem.cleared_at = Date.now();
    alarmItem.updated_at = Date.now();

    await ddbDocClient.send(new PutCommand({
      TableName: DYNAMODB_TABLE,
      Item: alarmItem
    }));

    const updatePayload = {
      alarm_id: alarmId,
      actual_device_id: alarmItem.actual_device_id,
      alarm_type: alarmItem.alarm_type,
      status: 'CLEARED',
      tenant_id: cleanTenantId
    };
    io.to('tenant_' + cleanTenantId).emit('alarm_resolved', updatePayload);

    console.log(`[Alarm Engine] Alarm ${alarmId} manually cleared by operator.`);
    res.json({ success: true, alarm: alarmItem });
  } catch (error) {
    console.error('[Clear Alarm Error]:', error);
    res.status(500).json({ error: error.message });
  }
});

// Default SuperAdmin Account Auto-Seed
async function seedDefaultSuperadmin() {
  try {
    const userPK = 'TENANT#superadmin';
    const cleanEmail = 'superadmin@coreboard.io';
    const userSK = `USER#${cleanEmail}`;
    const checkRes = await ddbDocClient.send(new QueryCommand({
      TableName: DYNAMODB_TABLE,
      KeyConditionExpression: 'device_id = :pk AND #ts = :sk',
      ExpressionAttributeNames: { '#ts': 'timestamp' },
      ExpressionAttributeValues: { ':pk': userPK, ':sk': userSK }
    }));

    if (!checkRes.Items || checkRes.Items.length === 0) {
      const defaultPassword = process.env.DEFAULT_SUPERADMIN_PASSWORD || 'superadmin123';
      const passwordHash = await bcrypt.hash(defaultPassword, 10);
      await ddbDocClient.send(new PutCommand({
        TableName: DYNAMODB_TABLE,
        Item: {
          device_id: userPK,
          timestamp: userSK,
          company_name: 'Coreboard',
          email: cleanEmail,
          password_hash: passwordHash,
          role: 'SUPERADMIN',
          created_at: Date.now()
        }
      }));
      console.log(`[Seed] Initialized default SuperAdmin account: ${cleanEmail}`);
    }
  } catch (err) {
    console.warn('[Seed] Note: SuperAdmin auto-seed skipped or deferred:', err.message);
  }
}

server.listen(PORT, () => {
  console.log(`[Bridge Server] Running and listening on http://localhost:${PORT}`);
  seedDefaultSuperadmin();
});


