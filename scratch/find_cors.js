const fs = require('fs');
const path = require('path');

const bridgePath = path.resolve(__dirname, '../backend/bridge.js');

if (fs.existsSync(bridgePath)) {
  const content = fs.readFileSync(bridgePath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (line.includes('cors') || line.includes('CORS')) {
      console.log(`Line ${index + 1}: ${line.trim()}`);
    }
  });
}
