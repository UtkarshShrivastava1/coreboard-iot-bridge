# Coreboard IoT Suite - Global Agent Instructions & Architecture Rules

This workspace follows the global instructions and architectural constraints defined in [.agents/AGENTS.md](file:///d:/UTKARSH/GitHub/Orignal/coreboard-iot-bridge/.agents/AGENTS.md).

All AI agents must automatically adhere to the following rules:

1. **Stateless Infrastructure**: The Node.js bridge server must remain stateless and act strictly as an event-driven gateway. Transport and mTLS management are offloaded to AWS IoT Core.
2. **Multi-Tenancy & DynamoDB Single-Table Design**: All data is stored in a single DynamoDB table isolated by Partition Key (`PK = TENANT#<tenant_uuid>`). Scans across tenants are strictly forbidden.
3. **API-First Device Enrollment**: Provisioning is programmatically handled via backend AWS SDK calls (`CreateThingCommand`, `CreateKeysAndCertificateCommand`, etc.). Private keys must never be stored in the database.
4. **Role-Based Access Control**: Strict role isolation for `SuperAdmin`, `Tenant Admin`, and `Tenant User`.
5. **Defensive Engineering**: Wrap API array responses defensively to prevent UI white-screens, clean up Socket.io event listeners on unmount, and never swallow runtime errors.
6. **Git Operations & Authorization**: The AI agent is authorized to execute `git add .`, `git add <file>`, and `git commit -m "..."` for verified code changes. However, `git push` is strictly prohibited and MUST be performed manually by the user.
7. **Node.js & Terminal Command Authorization**: The AI agent is pre-authorized to run standard Node.js scripts (including `node scratch/...`), NPM execution (`npm run dev`, `npm run build`, `npm test`, `npm install`), and `npx` commands for building, testing, and debugging without prompting for routine shell execution.


For full schema details and architectural rules, inspect [.agents/AGENTS.md](file:///d:/UTKARSH/GitHub/Orignal/coreboard-iot-bridge/.agents/AGENTS.md).


