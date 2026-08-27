const fs = require('fs');
const path = require('path');

const clientAppPath = path.resolve(__dirname, '../simulator-ui/client/src/App.tsx');

if (fs.existsSync(clientAppPath)) {
  const content = fs.readFileSync(clientAppPath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (line.includes('certPem') || line.includes('keyPem') || line.includes('file') || line.includes('upload') || line.includes('Upload')) {
      console.log(`Line ${index + 1}: ${line.trim()}`);
    }
  });
}
