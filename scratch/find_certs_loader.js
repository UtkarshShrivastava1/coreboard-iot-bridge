const fs = require('fs');
const path = require('path');

const bridgePath = path.resolve(__dirname, '../backend/bridge.js');

if (fs.existsSync(bridgePath)) {
  const content = fs.readFileSync(bridgePath, 'utf8');
  const lines = content.split('\n');
  let inCerts = false;
  let count = 0;
  lines.forEach((line, index) => {
    if (line.includes('const caCert =') || line.includes('let caCert') || line.includes('let deviceCert')) {
      inCerts = true;
      count = 0;
    }
    if (inCerts && count < 25) {
      console.log(`Line ${index + 1}: ${line}`);
      count++;
    }
  });
}
