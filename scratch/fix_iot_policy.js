require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { IoTClient, GetPolicyCommand, CreatePolicyVersionCommand, ListPolicyVersionsCommand, DeletePolicyVersionCommand } = require('@aws-sdk/client-iot');

const iotClient = new IoTClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const region = process.env.AWS_REGION || 'ap-south-1';

async function fixPolicies() {
  // Fix 1: MultiTenantDevicePolicy - fix topicfilter and make it work for simulator
  console.log('\n=== Updating MultiTenantDevicePolicy ===\n');
  
  const devicePolicyDoc = {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: ["iot:Connect"],
        // Allow any clientId (needed for simulator to connect as any device)
        Resource: [`arn:aws:iot:${region}:*:client/*`]
      },
      {
        Effect: "Allow",
        Action: ["iot:Publish"],
        // Allow publishing to any multi-tenant topic
        Resource: [`arn:aws:iot:${region}:*:topic/tenants/*/devices/*/pub`]
      },
      {
        Effect: "Allow",
        Action: ["iot:Subscribe"],
        // FIX: must use topicfilter/ not topic/ for subscribe
        Resource: [`arn:aws:iot:${region}:*:topicfilter/tenants/*/devices/*/sub`]
      },
      {
        Effect: "Allow",
        Action: ["iot:Receive"],
        // FIX: use topic/ for receive (this is correct)
        Resource: [`arn:aws:iot:${region}:*:topic/tenants/*/devices/*/sub`]
      }
    ]
  };

  await updatePolicy('MultiTenantDevicePolicy', devicePolicyDoc);
}

async function updatePolicy(policyName, policyDoc) {
  try {
    // Get current policy to check versions
    const currentPolicy = await iotClient.send(new GetPolicyCommand({ policyName }));
    console.log(`Current policy default version: ${currentPolicy.defaultVersionId}`);
    
    // List existing versions
    const versionsResp = await iotClient.send(new ListPolicyVersionsCommand({ policyName }));
    const versions = versionsResp.policyVersions || [];
    console.log(`Existing versions: ${versions.map(v => `v${v.versionId}(${v.isDefaultVersion ? 'DEFAULT' : 'old'})`).join(', ')}`);
    
    // Delete non-default versions if we have 5 (AWS limit)
    const nonDefaultVersions = versions.filter(v => !v.isDefaultVersion);
    if (versions.length >= 5) {
      // Delete oldest non-default version
      const oldest = nonDefaultVersions.sort((a, b) => parseInt(a.versionId) - parseInt(b.versionId))[0];
      if (oldest) {
        await iotClient.send(new DeletePolicyVersionCommand({ policyName, policyVersionId: oldest.versionId }));
        console.log(`Deleted old version: ${oldest.versionId}`);
      }
    }
    
    // Create new version and set as default
    const newVersion = await iotClient.send(new CreatePolicyVersionCommand({
      policyName,
      policyDocument: JSON.stringify(policyDoc),
      setAsDefault: true
    }));
    
    console.log(`✅ Policy '${policyName}' updated to version ${newVersion.policyVersionId}`);
    console.log(`   New document: ${JSON.stringify(policyDoc, null, 2)}`);
    
  } catch (e) {
    console.error(`❌ Failed to update policy ${policyName}: ${e.message}`);
  }
}

fixPolicies().catch(console.error);
