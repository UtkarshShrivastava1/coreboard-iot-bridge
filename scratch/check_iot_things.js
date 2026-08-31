require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { IoTClient, DescribeCertificateCommand, ListThingPrincipalsCommand, ListThingsCommand } = require('@aws-sdk/client-iot');
const fs = require('fs');
const path = require('path');

const iotClient = new IoTClient({ region: process.env.AWS_REGION || 'ap-south-1' });

async function checkDeviceCerts() {
  // List all IoT things and their attached certs
  console.log('\n=== AWS IoT Things and Certificate Status ===\n');
  
  let nextToken;
  do {
    const thingsResp = await iotClient.send(new ListThingsCommand({ nextToken, maxResults: 50 }));
    const things = thingsResp.things || [];
    
    for (const thing of things) {
      console.log(`Thing: ${thing.thingName}`);
      
      try {
        const principalsResp = await iotClient.send(new ListThingPrincipalsCommand({ thingName: thing.thingName }));
        const principals = principalsResp.principals || [];
        
        for (const certArn of principals) {
          const certId = certArn.split('/').pop();
          try {
            const certResp = await iotClient.send(new DescribeCertificateCommand({ certificateId: certId }));
            const status = certResp.certificateDescription?.status;
            const emoji = status === 'ACTIVE' ? '✅' : status === 'INACTIVE' ? '❌' : '⚠️';
            console.log(`  ${emoji} Cert: ...${certId.slice(-16)} | Status: ${status}`);
          } catch (e) {
            console.log(`  ⚠️ Cert: ...${certId.slice(-16)} | Error: ${e.message}`);
          }
        }
        
        if (principals.length === 0) {
          console.log(`  ⚠️ No certificates attached`);
        }
      } catch (e) {
        console.log(`  ❌ Error getting principals: ${e.message}`);
      }
      console.log('');
    }
    
    nextToken = thingsResp.nextToken;
  } while (nextToken);
  
  // Also check the local cert file being used by the simulator
  console.log('\n=== Local Certificate Files (used by simulator) ===\n');
  const localCertPath = path.resolve(__dirname, '../backend/certs/Device_certificate.crt');
  if (fs.existsSync(localCertPath)) {
    const certContent = fs.readFileSync(localCertPath, 'utf8');
    // Extract cert fingerprint info (just show first 100 chars)
    console.log(`Local cert file exists: ${localCertPath}`);
    console.log(`Cert content preview: ${certContent.slice(0, 80)}...`);
  } else {
    console.log(`❌ Local cert file NOT FOUND at: ${localCertPath}`);
  }
}

checkDeviceCerts().catch(console.error);
