const fs = require('fs');
const path = require('path');

const bridgePath = path.resolve(__dirname, '../backend/bridge.js');

if (fs.existsSync(bridgePath)) {
  const content = fs.readFileSync(bridgePath, 'utf8');
  const lines = content.split('\n');
  let inOptions = false;
  let count = 0;
  lines.forEach((line, index) => {
    if (line.includes('const mqttOptions =')) {
      inOptions = true;
      count = 0;
    }
    if (inOptions && count < 40) {
      console.log(`Line ${index + 1}: ${line}`);
      count++;
    }
  });
}
