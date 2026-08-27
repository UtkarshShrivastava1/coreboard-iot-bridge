require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { IoTClient, ListCertificatesCommand, ListPrincipalPoliciesCommand, ListTargetsForPolicyCommand } = require('@aws-sdk/client-iot');

const awsCredentials = {
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  },
  region: process.env.AWS_REGION || 'ap-south-1',
  useDualstackEndpoint: true
};

const iotClient = new IoTClient(awsCredentials);

async function inspectCerts() {
  try {
    const res = await iotClient.send(new ListCertificatesCommand({ pageSize: 10 }));
    console.log(`Found ${res.certificates.length} certificates:`);
    for (const cert of res.certificates) {
      console.log(`CertId: ${cert.certificateId} | Status: ${cert.status} | ARN: ${cert.certificateArn}`);
      try {
        const policies = await iotClient.send(new ListPrincipalPoliciesCommand({ principal: cert.certificateArn }));
        console.log(`  Attached Policies:`, policies.policies.map(p => p.policyName));
      } catch (e) {
        console.log(`  Error listing policies: ${e.message}`);
      }
    }
  } catch (err) {
    console.error("Error inspecting certificates:", err);
  }
}

inspectCerts();
