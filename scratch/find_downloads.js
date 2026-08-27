const fs = require('fs');
const path = require('path');

const superadminAppPath = path.resolve(__dirname, '../frontend-SuperAdmin/src/App.tsx');

if (fs.existsSync(superadminAppPath)) {
  const content = fs.readFileSync(superadminAppPath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (line.includes('certificatePem') || line.includes('privateKeyPem') || line.includes('Download') || line.includes('blob')) {
      console.log(`Line ${index + 1}: ${line.trim()}`);
    }
  });
}
