const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const certPath = path.resolve(__dirname, '../backend/certs/Device_certificate.crt');
const keyPath = path.resolve(__dirname, '../backend/certs/Private_key.key');

if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
  console.error("Certificate or Key file is missing!");
  process.exit(1);
}

try {
  const cert = fs.readFileSync(certPath, 'utf8');
  const key = fs.readFileSync(keyPath, 'utf8');

  // Extract public key from certificate
  const certDetails = new crypto.X509Certificate(cert);
  const certPublicKey = certDetails.publicKey.export({ type: 'spki', format: 'pem' });

  // Extract public key from private key
  const privateKeyObject = crypto.createPrivateKey(key);
  const keyPublicKey = crypto.createPublicKey(privateKeyObject).export({ type: 'spki', format: 'pem' });

  console.log("Certificate Public Key (SPKI PEM):");
  console.log(certPublicKey.trim().substring(0, 100) + "...");
  console.log("\nPrivate Key's Public Key (SPKI PEM):");
  console.log(keyPublicKey.trim().substring(0, 100) + "...");

  if (certPublicKey === keyPublicKey) {
    console.log("\n✅ SUCCESS: The local private key matches the local certificate public key perfectly!");
  } else {
    console.log("\n❌ ERROR: MISMATCH! The local private key does NOT match the certificate! They belong to different keypairs.");
  }
} catch (err) {
  console.error("Cryptographic check failed:", err.message);
}
