require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { IoTClient, UpdateCertificateCommand } = require('@aws-sdk/client-iot');

const awsCredentials = {
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  },
  region: process.env.AWS_REGION || 'ap-south-1',
  useDualstackEndpoint: true
};

const iotClient = new IoTClient(awsCredentials);
const certId = '0b3c40e732f5905f729bc67412e49938b3754dcca1a79296f601c87d29a70578';

async function activateCert() {
  try {
    await iotClient.send(new UpdateCertificateCommand({
      certificateId: certId,
      newStatus: 'ACTIVE'
    }));
    console.log(`[AWS IoT] Success! Certificate ${certId} status updated to ACTIVE.`);
  } catch (err) {
    console.error("Error activating certificate:", err);
  }
}

activateCert();
