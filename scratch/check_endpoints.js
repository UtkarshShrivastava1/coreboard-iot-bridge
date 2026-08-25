const fs = require('fs');
const path = require('path');

const tenantAppPath = path.resolve(__dirname, '../frontend/src/App.tsx');
const superadminAppPath = path.resolve(__dirname, '../frontend-SuperAdmin/src/App.tsx');

function scanFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`File ${filePath} does not exist.`);
    return;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  console.log(`=== Scanning ${path.basename(filePath)} ===`);
  lines.forEach((line, index) => {
    if (line.includes('localhost:4000')) {
      console.log(`Line ${index + 1}: ${line.trim()}`);
    }
  });
}

scanFile(tenantAppPath);
scanFile(superadminAppPath);
