const fs = require('fs');
const path = require('path');

const clientAppPath = path.resolve(__dirname, '../frontend/src/App.tsx');

if (fs.existsSync(clientAppPath)) {
  const content = fs.readFileSync(clientAppPath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (line.includes('handleSimulateTelemetry') || (index > 2100 && index < 2250)) {
      console.log(`Line ${index + 1}: ${line.trim()}`);
    }
  });
}
