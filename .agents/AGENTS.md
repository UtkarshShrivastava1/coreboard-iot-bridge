# Coreboard IoT Suite - Global Agent Instructions & Architecture Rules

This document defines mandatory architectural constraints, coding standards, database schemas, security protocols, and engineering patterns that **every AI agent must strictly follow** when working within the `coreboard-iot-bridge` codebase.

---

## 1. System Architecture & Infrastructure Constraints

- **Stateless Gateway Layer (Backend Bridge)**: The Node.js Express bridge server (`backend/`) must remain completely stateless and operate strictly as an event-driven translator. Do NOT maintain session states, connection mappings, or local telemetry arrays in server memory.
- **Offloaded MQTT Transport Layer**: Offload MQTT transport management, client connection state tracking, and mTLS security verification entirely to **AWS IoT Core**.
- **Decoupled Frontend SPAs**:
  - The primary React + Vite dashboard (`frontend/`) and SuperAdmin portal (`frontend-SuperAdmin/`) must run fully decoupled from ingestion pipeline resources.
  - Telemetry streaming must be handled via stateless WebSocket broadcasts (Socket.io) isolated into tenant rooms (`tenant_<tenantId>`).
  - Historical data retrieval and management operations must use HTTP REST endpoints.

---

## 2. Multi-Tenancy & DynamoDB Single-Table Design

All tenant, user, device metadata, telemetry logs, setup requests, and alarms **MUST** reside within a single physical DynamoDB table, strictly partition-isolated by Tenant ID.

### Partition Key (`PK`) & Sort Key (`SK`) Schema Rules

| Entity | Partition Key (`PK`) | Sort Key (`SK`) | Description / Data Payload |
| :--- | :--- | :--- | :--- |
| **Tenant Metadata** | `TENANT#<tenant_uuid>` | `METADATA` | Tenant name, status, creation timestamp, billing tier |
| **User Profile** | `TENANT#<tenant_uuid>` | `USER#<email>` | Hashed password, role (`ADMIN` \| `USER`), profile metadata |
| **Device Metadata** | `TENANT#<tenant_uuid>` | `METADATA#DEVICE#<device_uuid>` | Enrollment status (`ACTIVE`), device type, cert ARN, hardware specs |
| **Device Setup Request** | `TENANT#<tenant_uuid>` | `REQUEST#DEVICE#<device_uuid>` | Temporary record for device request (`PENDING`, `APPROVED`, `REJECTED`) |
| **Telemetry Log** | `TENANT#<tenant_uuid>` | `DEVICE#<device_uuid>#TIMESTAMP#<epoch>` | Time-series telemetry record (e.g. flow_rate, temperature) |
| **Alarm Log** | `TENANT#<tenant_uuid>` | `ALARM#<alarm_uuid>` | Alarm threshold state (`ACTIVE`, `ACKNOWLEDGED`, `CLEARED`) |

### Cross-Tenant Data Leakage Prevention
- **Database Layer**: Every DynamoDB query/mutation MUST explicitly filter and scope by `PK = TENANT#<tenant_uuid>`. Unpartitioned scans are strictly prohibited.
- **WebSocket Layer**: Upon connection, decode JWT token, extract `tenantId`, and join the client socket exclusively to room `tenant_<tenantId>`. When receiving MQTT payloads (`tenants/<tenant_id>/devices/<device_id>/pub`), parse `tenantId` and emit strictly to `io.to('tenant_' + tenantId)`.

---

## 3. Programmatic API-First Device Enrollment & AWS SDK

- **No Manual Visual Wizards**: Device registration must be executed programmatically via backend API endpoints leveraging the AWS SDK v3:
  1. `CreateThingCommand`: Register Thing dynamically in AWS IoT Core.
  2. `CreateKeysAndCertificateCommand`: Generate unique X.509 cryptographic client credentials on-the-fly.
  3. `AttachThingPrincipalCommand` & `AttachPolicyCommand`: Bind certificate to Thing principal and attach dynamic multi-tenant connection policies.
- **Cryptographic Key Disposal**: Store ONLY the Certificate ARN/ID in DynamoDB metadata. Never save X.509 private keys to the database or disk after initial provisioning download package generation.
- **UI Responsibility**: React dashboards must remain clean clients that interact with these endpoints, showing console logs and providing zip download packages for device certs.

---

## 4. Role-Based Access Control (RBAC) Enforcement

1. **SuperAdmin (Coreboard System Developer)**:
   - Global system-wide control across all tenants.
   - Access to global Provisioning Request Queue (`GET /api/superadmin/requests`).
   - Tenant onboarding, device request approval, X.509 certificate package generation.
2. **Tenant Admin (Client Administrator)**:
   - Strict partition isolation (`TENANT#<tenantId>`).
   - View telemetry/charts, configure alarm threshold rules, acknowledge/clear active alarms, initiate device setup requests, manage read-only tenant users.
3. **Tenant User (Client Viewer)**:
   - Read-only access within their own tenant partition.
   - View live dashboards, charts, and alarm logs.
   - *Restricted*: Cannot request devices, update alarm rules, clear alarms, or add users.

---

## 5. Frontend & API Reliability Standards

- **Defensive API Response Wrappers**: Always verify API response structures (e.g. check `Array.isArray()` before calling `.map()`, `.filter()`, or `.reduce()`) to prevent white-screen crashes from unexpected or missing data formats.
- **Clean Hook Cleanup & Socket Management**: In React hooks (`useTables`, `useOrders`, `useTelemetry`, etc.), ensure socket listeners are unsubscribed on unmount to prevent memory leaks and infinite re-fetching loops.
- **SuperAdmin Path Explicit Inclusion**: Note that `frontend-SuperAdmin` is excluded in root `.gitignore`. Specify paths directly when inspecting or editing files in this directory.

---

## 6. Code Quality & Security Guidelines

- **Environment Secrets**: Never commit AWS credentials, JWT secrets, database connection strings, or mTLS keys to Git. Keep all configuration in `.env` files.
- **Empirical Diagnostics**: Inspect un-truncated error logs before diagnosing runtime issues.
- **No Masking Errors**: Fix underlying contracts and data schemas directly rather than swallowing exceptions in empty `try/catch` blocks or using fake fallback data.

---

## 7. Version Control & Git Workflow Rules

- **Permitted Git Actions (`git add` & `git commit`)**: The AI agent is pre-authorized to run `git add .`, `git add <file>`, and `git commit -m "..."` to stage and save verified working code changes when appropriate or requested.
- **Strictly Prohibited Git Action (`git push`)**: The AI agent **MUST NEVER** execute `git push`. Pushing code to remote repositories must always be performed manually by the user.

---

## 8. Development Commands & Terminal Authorization

- **Permitted CLI & Node.js Commands**: The AI agent is pre-authorized to execute standard Node.js scripts (e.g. `node scratch/...`), NPM commands (e.g., `npm run dev`, `npm run build`, `npm test`, `npm install`), and `npx` commands to run dev servers, execute tests, build packages, check type safety, and inspect runtime logs without requiring routine prompt permissions.




