const fs = require('fs');
const path = require('path');

const clientAppPath = path.resolve(__dirname, '../frontend/src/App.tsx');

if (fs.existsSync(clientAppPath)) {
  const content = fs.readFileSync(clientAppPath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (line.includes("'harness'") || line.includes('"harness"') || line.includes('harnessState') || line.includes('simulation') || line.includes('simulate')) {
      console.log(`Line ${index + 1}: ${line.trim()}`);
    }
  });
}
