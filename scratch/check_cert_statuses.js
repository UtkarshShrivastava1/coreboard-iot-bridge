require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { IoTClient, DescribeCertificateCommand, UpdateCertificateCommand } = require('@aws-sdk/client-iot');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const iotClient = new IoTClient({ region: process.env.AWS_REGION || 'ap-south-1' });

async function checkAndFixCerts() {
  // Scan for all device metadata items
  const resp = await dynamoClient.send(new ScanCommand({
    TableName: process.env.DYNAMODB_TABLE_NAME || 'ESP32_IoT_Data',
    FilterExpression: 'begins_with(SK, :prefix)',
    ExpressionAttributeValues: {
      ':prefix': { S: 'METADATA#DEVICE#' }
    }
  }));

  const items = resp.Items || [];
  console.log(`\nFound ${items.length} device metadata records across all tenants:\n`);

  for (const item of items) {
    const pk = item.PK?.S || '?';
    const sk = item.SK?.S || '?';
    const tenantId = pk.replace('TENANT#', '');
    const deviceId = sk.replace('METADATA#DEVICE#', '');
    
    // Log all attribute keys for debugging
    const allKeys = Object.keys(item);
    const certArn = item.cert_arn?.S || item.certArn?.S || item.certificate_arn?.S || item.certificateArn?.S;

    if (!certArn) {
      console.log(`  ⚠️  [${tenantId}] ${deviceId} — No cert ARN (Keys: ${allKeys.join(', ')})`);
      continue;
    }

    const certId = certArn.split('/').pop();
    let certStatus = 'UNKNOWN';
    try {
      const certResp = await iotClient.send(new DescribeCertificateCommand({ certificateId: certId }));
      certStatus = certResp.certificateDescription?.status || 'UNKNOWN';
    } catch (e) {
      certStatus = `ERROR: ${e.message}`;
    }

    const statusEmoji = certStatus === 'ACTIVE' ? '✅' : certStatus === 'INACTIVE' ? '❌' : '⚠️';
    console.log(`  ${statusEmoji} [${tenantId}] ${deviceId.padEnd(25)} | Cert: ...${certId.slice(-12)} | Status: ${certStatus}`);

    // Auto-fix: activate INACTIVE certs
    if (certStatus === 'INACTIVE') {
      console.log(`     🔧 Activating certificate for ${deviceId}...`);
      try {
        await iotClient.send(new UpdateCertificateCommand({ certificateId: certId, newStatus: 'ACTIVE' }));
        console.log(`     ✅ Certificate ACTIVATED for ${deviceId}`);
      } catch (e) {
        console.error(`     ❌ Failed to activate: ${e.message}`);
      }
    }
  }
}

checkAndFixCerts().catch(console.error);
