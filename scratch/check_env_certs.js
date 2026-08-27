require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

console.log("Check Environment Variables:");
console.log("AWS_CA_CERT present:", !!process.env.AWS_CA_CERT);
console.log("AWS_DEVICE_CERT present:", !!process.env.AWS_DEVICE_CERT);
console.log("AWS_PRIVATE_KEY present:", !!process.env.AWS_PRIVATE_KEY);

if (process.env.AWS_DEVICE_CERT) {
  console.log("\nAWS_DEVICE_CERT Length:", process.env.AWS_DEVICE_CERT.length);
  console.log("AWS_DEVICE_CERT snippet:", process.env.AWS_DEVICE_CERT.substring(0, 50) + "...");
}
