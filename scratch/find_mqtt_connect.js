const fs = require('fs');
const path = require('path');

const bridgePath = path.resolve(__dirname, '../backend/bridge.js');

if (fs.existsSync(bridgePath)) {
  const content = fs.readFileSync(bridgePath, 'utf8');
  const lines = content.split('\n');
  let inConnect = false;
  let count = 0;
  lines.forEach((line, index) => {
    if (line.includes('mqtt.connect')) {
      inConnect = true;
      count = 0;
    }
    if (inConnect && count < 35) {
      console.log(`Line ${index + 1}: ${line}`);
      count++;
    }
  });
}
