require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { IoTClient, GetPolicyCommand } = require('@aws-sdk/client-iot');

const awsCredentials = {
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  },
  region: process.env.AWS_REGION || 'ap-south-1',
  useDualstackEndpoint: true
};

const iotClient = new IoTClient(awsCredentials);

async function checkPolicies() {
  const policies = ['MultiTenantBackendPolicy', 'MultiTenantDevicePolicy'];
  for (const name of policies) {
    try {
      const res = await iotClient.send(new GetPolicyCommand({ policyName: name }));
      console.log(`\n=================== POLICY: ${name} ===================`);
      // Parse policy document string to JSON
      const doc = JSON.parse(res.policyDocument);
      console.log(JSON.stringify(doc, null, 2));
    } catch (err) {
      console.error(`Error fetching policy ${name}:`, err.message);
    }
  }
}

checkPolicies();
