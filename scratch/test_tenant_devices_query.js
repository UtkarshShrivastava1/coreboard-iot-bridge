require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

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

async function testQuery() {
  const cleanTenantId = 'stark-ind';
  try {
    const res = await ddbDocClient.send(new QueryCommand({
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
    console.log(`Query returned ${res.Items ? res.Items.length : 0} items:`);
    if (res.Items) {
      res.Items.forEach(item => {
        console.log(JSON.stringify(item, null, 2));
      });
    }
  } catch (err) {
    console.error("Query Error:", err);
  }
}

testQuery();
