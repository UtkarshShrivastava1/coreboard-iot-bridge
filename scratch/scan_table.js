require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const awsCredentials = {
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  },
  region: process.env.AWS_REGION || 'ap-south-1',
  useDualstackEndpoint: true
};

const ddbClient = new DynamoDBClient(awsCredentials);
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE_NAME || 'ESP32_IoT_Data';

async function scanTable() {
  try {
    const res = await ddbDocClient.send(new ScanCommand({ TableName: DYNAMODB_TABLE }));
    console.log(`Scan returned ${res.Items.length} items:`);
    res.Items.forEach(item => {
      console.log(`PK: ${item.device_id} | SK: ${item.timestamp} | Type: ${item.device_type || 'N/A'} | Company: ${item.company_name || 'N/A'}`);
    });
  } catch (err) {
    console.error("Error scanning table:", err);
  }
}

scanTable();
