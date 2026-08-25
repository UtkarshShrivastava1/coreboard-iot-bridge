require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { DynamoDBClient, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');

const awsCredentials = {
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  },
  region: process.env.AWS_REGION || 'ap-south-1',
  useDualstackEndpoint: true
};

const ddbClient = new DynamoDBClient(awsCredentials);
const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE_NAME || 'ESP32_IoT_Data';

async function check() {
  try {
    const res = await ddbClient.send(new DescribeTableCommand({ TableName: DYNAMODB_TABLE }));
    console.log("Table info (Dualstack/IPv6):", JSON.stringify(res.Table.KeySchema, null, 2));
    console.log("Attribute definitions:", JSON.stringify(res.Table.AttributeDefinitions, null, 2));
  } catch (err) {
    console.error("Error describing table:", err);
  }
}

check();
