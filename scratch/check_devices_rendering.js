const fs = require('fs');
const path = require('path');

const tenantAppPath = path.resolve(__dirname, '../frontend/src/App.tsx');

if (fs.existsSync(tenantAppPath)) {
  const content = fs.readFileSync(tenantAppPath, 'utf8');
  const lines = content.split('\n');
  console.log('Searching for devices tab rendering in App.tsx...');
  lines.forEach((line, index) => {
    if (line.includes("activeTab === 'devices'") || line.includes('devices.map')) {
      console.log(`Line ${index + 1}: ${line.trim()}`);
    }
  });
}
