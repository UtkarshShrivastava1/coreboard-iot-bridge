const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { IoTClient, ListCertificatesCommand, AttachPolicyCommand } = require('@aws-sdk/client-iot');

const client = new IoTClient({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  },
  region: process.env.AWS_REGION || 'ap-south-1'
});

async function run() {
  const certs = await client.send(new ListCertificatesCommand({}));
  for (const cert of certs.certificates) {
    try {
      await client.send(new AttachPolicyCommand({
        policyName: 'MultiTenantBackendPolicy',
        target: cert.certificateArn
      }));
      console.log(`Attached MultiTenantBackendPolicy to ${cert.certificateId}`);
    } catch (e) {
      console.error(`Error attaching to ${cert.certificateId}:`, e.message);
    }
  }
}

run();
