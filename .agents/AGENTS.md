# Coreboard IoT Suite Customization Rules

The following architectural rules and constraints must be strictly adhered to throughout the development of the Coreboard project:

## 1. Highly Decoupled Serverless Infrastructure
- **Stateless Ingestion Layer**: The Node.js bridge server must remain stateless and act strictly as an event-driven gateway. Do not store session states, connection mappings, or local caches in memory.
- **Offloaded Transport Layer**: Offload the heavy MQTT and connection state management entirely to AWS IoT Core (via secure mTLS).
- **Independent SPA Frontend**: The React frontend (Vite) must run fully decoupled from the ingestion pipeline resources. It fetches historical data via HTTP REST endpoints and receives real-time streams via stateless WebSocket broadcasts (Socket.io).

## 2. Multi-Tenancy via DynamoDB Single-Table Design
- All tenant, user, device metadata, and telemetry data must reside in a single DynamoDB table partition-isolated at the physical layer.
- **Partition Key (PK) Mapping**: `TENANT#<tenant_uuid>` (e.g., `TENANT#acme-corp`).
- **Sort Key (SK) Mapping**:
  - **User Profile**: `USER#<email>` (e.g., `USER#admin@acme.com`).
  - **Device Configuration Metadata**: `METADATA#DEVICE#<device_uuid>` (e.g., `METADATA#DEVICE#PUMP-01`).
  - **Telemetry Time-Series Log**: `DEVICE#<device_uuid>#TIMESTAMP#<epoch>` (e.g., `DEVICE#PUMP-01#TIMESTAMP#1719876543000`).

## 3. Programmatic, API-First Device Enrollment
- Device registration must not rely on rigid visual workflows or internal wizards.
- Provisioning must be handled programmatically via the backend API leveraging the AWS SDK:
  1. Register Thing dynamically (`CreateThingCommand`).
  2. Generate unique X.509 cryptographic client credentials on-the-fly (`CreateKeysAndCertificateCommand`).
  3. Bind X.509 certificate to the Thing principal and attach strict, dynamic connection policies.
- Ensure the React UI remains a clean dashboard client that interacts with these endpoints and displays console logs/credential download packages.
