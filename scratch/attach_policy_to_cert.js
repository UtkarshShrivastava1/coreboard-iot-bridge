require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { IoTClient, ListAttachedPoliciesCommand, AttachPolicyCommand, ListCertificatesCommand, DescribeCertificateCommand } = require('@aws-sdk/client-iot');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const iotClient = new IoTClient({ region: process.env.AWS_REGION || 'ap-south-1' });

const CERT_ID = '0b3c40e732f5905f729bc67412e49938b3754dcca1a79296f601c87d29a70578';
const POLICY_NAME = 'MultiTenantDevicePolicy';

async function checkAndAttachPolicy() {
  // Get the cert ARN
  const certResp = await iotClient.send(new DescribeCertificateCommand({ certificateId: CERT_ID }));
  const certArn = certResp.certificateDescription?.certificateArn;
  const certStatus = certResp.certificateDescription?.status;
  console.log(`\nCert ARN: ${certArn}`);
  console.log(`Cert Status: ${certStatus}\n`);

  // Check which policies are currently attached to this cert
  const attachedPolicies = await iotClient.send(new ListAttachedPoliciesCommand({ target: certArn }));
  const policies = attachedPolicies.policies || [];
  console.log(`Currently attached policies (${policies.length}):`);
  policies.forEach(p => console.log(`  - ${p.policyName}`));
  
  // Check if our policy is attached
  const hasDevicePolicy = policies.some(p => p.policyName === POLICY_NAME);
  
  if (hasDevicePolicy) {
    console.log(`\n✅ ${POLICY_NAME} is already attached to this cert.`);
  } else {
    console.log(`\n❌ ${POLICY_NAME} is NOT attached. Attaching now...`);
    await iotClient.send(new AttachPolicyCommand({
      policyName: POLICY_NAME,
      target: certArn
    }));
    console.log(`✅ Successfully attached ${POLICY_NAME} to cert!`);
  }
  
  // Verify final state
  const verifyResp = await iotClient.send(new ListAttachedPoliciesCommand({ target: certArn }));
  const finalPolicies = verifyResp.policies || [];
  console.log(`\nFinal attached policies (${finalPolicies.length}):`);
  finalPolicies.forEach(p => console.log(`  ✅ ${p.policyName}`));
}

checkAndAttachPolicy().catch(console.error);
