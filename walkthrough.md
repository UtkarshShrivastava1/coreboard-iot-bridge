# Walkthrough: System Verification & Feature Expansion

This document summarizes the execution and verification of the system updates:
1. **SuperAdmin Segregation**: Isolate global operations from the client frontend.
2. **Dynamic Device Profiling**: support any domestic, security, or industrial device.
3. **Downlink Actuation (Control)**: send real-time commands from the dashboard (such as toggling switches or locks) to the simulators/devices.

---

## 🔍 Code Changes & Implementations

### 1. Ingestion Bridge Backend (`/backend`)
- [x] **Database Schema Alignment**: Adjusted table creation parameters in [`bridge.js`](file:///d:/UTKARSH/GitHub/Orignal/coreboard-iot-bridge/backend/bridge.js) to resolve the key mismatch, ensuring clean environments initialize table keys with HASH: `device_id` and RANGE: `timestamp`.
- [x] **Downlink API Endpoint**: Added a secure POST route `POST /api/tenants/:tenantId/devices/:deviceId/actuate` inside [`bridge.js`](file:///d:/UTKARSH/GitHub/Orignal/coreboard-iot-bridge/backend/bridge.js).
  - Authenticates user JWT and verifies tenant scope.
  - Publishes command JSON to topic `tenants/<tenantId>/devices/<deviceId>/sub` via AWS IoT Core MQTT broker.

### 2. Tenant Dashboard (`/frontend`)
- [x] **Actuation Dispatcher**: Implemented `handleActuateDevice()` in [`App.tsx`](file:///d:/UTKARSH/GitHub/Orignal/coreboard-iot-bridge/frontend/src/App.tsx) to submit control commands to the backend.
- [x] **Dynamic Attributes Parser & Actuator UI**: Replaced the static attributes view in [`App.tsx`](file:///d:/UTKARSH/GitHub/Orignal/coreboard-iot-bridge/frontend/src/App.tsx) with a dynamic widget generator.
- [x] **Integration Specifications Helper**: Added a **`[View MQTT & JSON]`** specification viewer button and popup modal inside [`App.tsx`](file:///d:/UTKARSH/GitHub/Orignal/coreboard-iot-bridge/frontend/src/App.tsx) to display exact topics and copy-paste ready JSON payloads customized for each hardware classification.

### 3. Universal Web Simulator (`/simulator-ui`)
- [x] **Device Subscription**: Modified the simulated client connection block in [`server.js`](file:///d:/UTKARSH/GitHub/Orignal/coreboard-iot-bridge/simulator-ui/server.js) to automatically subscribe devices to their respective control topics (`/sub`).
- [x] **WebSockets Forwarder**: Configured the simulation backend to intercept incoming MQTT messages and emit them as `actuator_command` WebSockets events.
- [x] **Toggle Controllers & Auto-Acknowledge**: Expanded the simulator client [`App.tsx`](file:///d:/UTKARSH/GitHub/Orignal/coreboard-iot-bridge/simulator-ui/client/src/App.tsx) to:
  - Add option presets for **Smart Lock**, **Motion Sensor**, and **Smart Switch**.
  - Render interactive toggles on the simulator dashboard for domestic/security profiles.
  - Listen for downlink commands via Socket.io, update slider/state views in real-time, and automatically publish an updated uplink confirming the state change to the bridge.

---

## 🧪 Compile & Build Verification

All workspaces build and compile cleanly with exit code `0`:

1. **Parent Workspace Dependencies**:
   `npm install` completes cleanly. Added `"start:superadmin"` script to the root [`package.json`](file:///d:/UTKARSH/GitHub/Orignal/coreboard-iot-bridge/package.json) to spin up the production preview server.
2. **Tenant Client Build**:
   `npm run build:frontend` compiled cleanly (Built in 10.21s).
3. **SuperAdmin Console Build**:
   `npm run build:superadmin` compiled cleanly (Built in 6.73s).
4. **Simulator Client Build**:
   `npm run build:simulator` compiled cleanly (Built in 6.80s).

---

## 🚀 End-to-End Simulation Test Checklist

To test the dynamic home automation controls:

1. **Startup Services**:
   ```bash
   npm run dev:all
   ```
2. **Onboard a Security Device**:
   - Access **Client Dashboard**: [http://localhost:5173](http://localhost:5173). Log in or sign up.
   - Go to Devices tab, request setup for ID `LOCK-99` of type `smart_lock`.
   - Access **SuperAdmin Console**: [http://localhost:5175](http://localhost:5175). Log in.
   - Under Pending Requests, click **Approve & Provision** for `LOCK-99` and download the credentials.
3. **Spin up Device Simulator**:
   - Access **Universal Simulator**: [http://localhost:5174](http://localhost:5174).
   - Enter `LOCK-99` as Thing Name, select **Domestic Smart Door Lock** as the device profile, upload your certs, and connect.
   - Verify that an interactive **Lock Mechanism State** toggle is rendered on the simulator screen.
4. **Trigger Downlink Actuation**:
   - Return to the **Client Dashboard** (`localhost:5173`). Select `LOCK-99`.
   - You will see a card **LOCK STATE** showing a toggle switch (default: ACTIVE/ON).
   - Toggle the switch to OFF.
   - **Verification**:
     1. The simulator terminal logs: `[DOWNLINK COMMAND RECEIVED] Field: "lock_state" -> Value: false`.
     2. The lock toggle on the simulator interface flips to OFF.
     3. The client dashboard updates (via the auto-acknowledged uplink) to show **INACTIVE/OFF (Unlocked)**.
