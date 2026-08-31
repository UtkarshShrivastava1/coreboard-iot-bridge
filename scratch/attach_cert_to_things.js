require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { IoTClient, AttachThingPrincipalCommand, ListCertificatesCommand, DescribeCertificateCommand } = require('@aws-sdk/client-iot');

const iotClient = new IoTClient({ region: process.env.AWS_REGION || 'ap-south-1' });

// The cert ID found from find_cert_owner.js
const CERT_ID = '0b3c40e732f5905f729bc67412e49938b3754dcca1a79296f601c87d29a70578';
const CERT_ARN = `arn:aws:iot:ap-south-1:${process.env.AWS_ACCOUNT_ID}:cert/${CERT_ID}`;

// Devices that need to use this cert in the simulator
// These are the demo-organisation devices
const thingsToAttach = ['pump-02', 'smart-meter', 'Tempsensor', 'PUMP-01'];

async function attachCertToThings() {
  // First, get the cert ARN properly  
  const certResp = await iotClient.send(new DescribeCertificateCommand({ certificateId: CERT_ID }));
  const certArn = certResp.certificateDescription?.certificateArn;
  console.log(`\nCert ARN: ${certArn}`);
  console.log(`Cert Status: ${certResp.certificateDescription?.status}\n`);

  for (const thingName of thingsToAttach) {
    try {
      await iotClient.send(new AttachThingPrincipalCommand({
        thingName,
        principal: certArn
      }));
      console.log(`✅ Attached cert to Thing: ${thingName}`);
    } catch (e) {
      if (e.message?.includes('already attached') || e.__type?.includes('ResourceAlreadyExists')) {
        console.log(`ℹ️  Cert already attached to Thing: ${thingName}`);
      } else {
        console.error(`❌ Failed to attach to ${thingName}: ${e.message}`);
      }
    }
  }
  
  console.log('\n✅ Done! The simulator cert is now attached to all demo devices.');
  console.log('   You can now connect any of these devices in the simulator using Device_certificate.crt + Private_key.key');
}

attachCertToThings().catch(console.error);
