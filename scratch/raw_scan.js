require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });

async function rawScan() {
  const resp = await dynamoClient.send(new ScanCommand({
    TableName: process.env.DYNAMODB_TABLE_NAME || 'ESP32_IoT_Data',
    Limit: 30
  }));

  const items = resp.Items || [];
  console.log(`\nRaw scan — ${items.length} items:\n`);
  for (const item of items) {
    const pk = item.PK?.S || JSON.stringify(Object.entries(item)[0]);
    const sk = item.SK?.S || '(no SK)';
    const keys = Object.keys(item);
    console.log(`PK: ${pk.slice(0,50)} | SK: ${sk.slice(0,60)}`);
    console.log(`  Keys: ${keys.join(', ')}\n`);
  }
}

rawScan().catch(console.error);
