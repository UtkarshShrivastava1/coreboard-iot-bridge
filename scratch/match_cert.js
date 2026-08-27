require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load local certificate
const certPath = path.resolve(__dirname, '../backend/certs/Device_certificate.crt');
if (!fs.existsSync(certPath)) {
  console.error("Local cert file not found!");
  process.exit(1);
}

const certContent = fs.readFileSync(certPath, 'utf8');

// Compute hex hash of DER certificate
// A PEM certificate has headers like -----BEGIN CERTIFICATE-----
// We extract the base64 content, decode to binary (DER), and hash it.
const base64Body = certContent
  .replace(/-----BEGIN CERTIFICATE-----/, '')
  .replace(/-----END CERTIFICATE-----/, '')
  .replace(/\s+/g, '');
const derBuffer = Buffer.from(base64Body, 'base64');
const sha256Hash = crypto.createHash('sha256').update(derBuffer).digest('hex');

console.log(`Local Certificate SHA-256 Hash:\n${sha256Hash}`);

// Now verify if it matches any active certificate on AWS
const { IoTClient, ListCertificatesCommand } = require('@aws-sdk/client-iot');
const awsCredentials = {
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  },
  region: process.env.AWS_REGION || 'ap-south-1',
  useDualstackEndpoint: true
};
const iotClient = new IoTClient(awsCredentials);

async function checkMatch() {
  try {
    const res = await iotClient.send(new ListCertificatesCommand({ pageSize: 50 }));
    const match = res.certificates.find(c => c.certificateId === sha256Hash);
    if (match) {
      console.log(`\nMATCH FOUND IN AWS!`);
      console.log(`Status: ${match.status}`);
      console.log(`ARN: ${match.certificateArn}`);
    } else {
      console.log(`\n❌ NO MATCH FOUND IN AWS. This certificate is not registered in your AWS IoT registry!`);
    }
  } catch (err) {
    console.error("Error connecting to AWS:", err);
  }
}

checkMatch();
