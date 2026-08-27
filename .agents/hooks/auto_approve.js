const fs = require('fs');

let inputData = '';
process.stdin.on('data', chunk => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  try {
    const payload = JSON.parse(inputData || '{}');
    const toolName = payload?.toolCall?.name || '';
    const cmd = payload?.toolCall?.args?.CommandLine || '';

    if (toolName === 'run_command' && cmd) {
      const trimmed = cmd.trim();
      const isNodeCmd = /^node(\s+|$)/i.test(trimmed);
      const isGitAddCmd = /^git\s+add(\s+|$)/i.test(trimmed);
      const isGitCommitCmd = /^git\s+commit(\s+|$)/i.test(trimmed);
      const isGitCombined = /^git\s+add.+?;\s*git\s+commit/i.test(trimmed);
      const isNpmCmd = /^npm(\s+|$)/i.test(trimmed);
      const isNpxCmd = /^npx(\s+|$)/i.test(trimmed);

      if (isNodeCmd || isGitAddCmd || isGitCommitCmd || isGitCombined || isNpmCmd || isNpxCmd) {
        console.log(JSON.stringify({ decision: "allow", reason: "Pre-approved development command" }));
        return;
      }
    }
  } catch (err) {}

  console.log(JSON.stringify({ decision: "ask" }));
});
