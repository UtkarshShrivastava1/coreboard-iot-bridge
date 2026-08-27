const fs = require('fs');
const path = require('path');

const tenantAppPath = path.resolve(__dirname, '../frontend/src/App.tsx');

if (fs.existsSync(tenantAppPath)) {
  const content = fs.readFileSync(tenantAppPath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (line.includes('const [activeTab, setActiveTab]')) {
      console.log(`Line ${index + 1}: ${line.trim()}`);
    }
  });
}
