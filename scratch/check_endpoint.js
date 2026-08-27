require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { IoTClient, DescribeEndpointCommand } = require('@aws-sdk/client-iot');

const awsCredentials = {
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  },
  region: process.env.AWS_REGION || 'ap-south-1',
  useDualstackEndpoint: true
};

const iotClient = new IoTClient(awsCredentials);

async function checkEndpoint() {
  try {
    const res = await iotClient.send(new DescribeEndpointCommand({ endpointType: 'iot:Data-ATS' }));
    console.log("Expected AWS Data-ATS Endpoint:", res.endpointAddress);
    console.log("Current .env AWS_ENDPOINT:     ", process.env.AWS_ENDPOINT);
    if (res.endpointAddress === process.env.AWS_ENDPOINT) {
      console.log("\n✅ MATCH: The endpoint configured in .env matches the AWS account endpoint perfectly.");
    } else {
      console.log("\n❌ MISMATCH: The endpoint in .env does NOT match the AWS account endpoint!");
    }
  } catch (err) {
    console.error("Error describing endpoint:", err);
  }
}

checkEndpoint();
