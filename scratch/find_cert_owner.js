require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { IoTClient, ListCertificatesCommand, DescribeCertificateCommand, ListPrincipalThingsCommand } = require('@aws-sdk/client-iot');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const iotClient = new IoTClient({ region: process.env.AWS_REGION || 'ap-south-1' });

async function findCertOwner() {
  // Read the local cert file
  const localCertPath = path.resolve(__dirname, '../backend/certs/Device_certificate.crt');
  const certContent = fs.readFileSync(localCertPath, 'utf8');
  
  // Get the certificate fingerprint by computing SHA-256 of the DER
  const certBase64 = certContent
    .replace('-----BEGIN CERTIFICATE-----', '')
    .replace('-----END CERTIFICATE-----', '')
    .replace(/\s/g, '');
  const certDer = Buffer.from(certBase64, 'base64');
  const fingerprint = crypto.createHash('sha256').update(certDer).digest('hex').toUpperCase();
  console.log(`\nLocal cert SHA-256 fingerprint: ${fingerprint}`);
  
  // List all certs and find matching one
  console.log('\nSearching for matching cert in AWS IoT...\n');
  let nextMarker;
  do {
    const listResp = await iotClient.send(new ListCertificatesCommand({ pageSize: 50, marker: nextMarker }));
    const certs = listResp.certificates || [];
    
    for (const cert of certs) {
      // We need to compare — describe each cert to get details
      try {
        const certResp = await iotClient.send(new DescribeCertificateCommand({ certificateId: cert.certificateId }));
        const awsCertPem = certResp.certificateDescription?.certificatePem || '';
        const awsBase64 = awsCertPem
          .replace('-----BEGIN CERTIFICATE-----', '')
          .replace('-----END CERTIFICATE-----', '')
          .replace(/\s/g, '');
        const awsDer = Buffer.from(awsBase64, 'base64');
        const awsFingerprint = crypto.createHash('sha256').update(awsDer).digest('hex').toUpperCase();
        
        if (awsFingerprint === fingerprint) {
          console.log(`✅ MATCH FOUND! Cert ID: ${cert.certificateId}`);
          console.log(`   Status: ${certResp.certificateDescription?.status}`);
          
          // Find the Thing this cert is attached to
          const thingsResp = await iotClient.send(new ListPrincipalThingsCommand({ principal: cert.certificateArn }));
          const things = thingsResp.things || [];
          console.log(`   Attached to Things: ${things.length ? things.join(', ') : 'NONE'}`);
          return;
        }
      } catch (e) {
        // skip
      }
    }
    
    nextMarker = listResp.nextMarker;
  } while (nextMarker);
  
  console.log('❌ No matching certificate found in AWS IoT for the local cert file.');
}

findCertOwner().catch(console.error);
