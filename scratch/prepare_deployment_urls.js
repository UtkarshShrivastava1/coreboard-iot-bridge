const fs = require('fs');
const path = require('path');

const tenantAppPath = path.resolve(__dirname, '../frontend/src/App.tsx');
const superadminAppPath = path.resolve(__dirname, '../frontend-SuperAdmin/src/App.tsx');

// 1. Refactor Tenant App
if (fs.existsSync(tenantAppPath)) {
  let content = fs.readFileSync(tenantAppPath, 'utf8');
  
  if (!content.includes('const API_BASE =')) {
    // Inject API_BASE declaration
    content = content.replace(
      'export default function App() {',
      "const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';\n\nexport default function App() {"
    );
    
    // Replace URL paths
    content = content
      .replaceAll("'http://localhost:4000/api/auth/signup'", "`${API_BASE}/api/auth/signup`")
      .replaceAll("'http://localhost:4000/api/auth/login'", "`${API_BASE}/api/auth/login`")
      .replaceAll("`http://localhost:4000/api/tenants/${tenant.tenantId}/devices`", "`${API_BASE}/api/tenants/${tenant.tenantId}/devices`")
      .replaceAll("`http://localhost:4000/api/tenants/${tenant.tenantId}/alarms`", "`${API_BASE}/api/tenants/${tenant.tenantId}/alarms`")
      .replaceAll("`http://localhost:4000/api/tenants/${tenant.tenantId}/telemetry`", "`${API_BASE}/api/tenants/${tenant.tenantId}/telemetry`")
      .replaceAll("`http://localhost:4000/api/tenants/${tenant.tenantId}/alarms/${alarmId}/acknowledge`", "`${API_BASE}/api/tenants/${tenant.tenantId}/alarms/${alarmId}/acknowledge`")
      .replaceAll("`http://localhost:4000/api/tenants/${tenant.tenantId}/alarms/${alarmId}/clear`", "`${API_BASE}/api/tenants/${tenant.tenantId}/alarms/${alarmId}/clear`")
      .replaceAll("`http://localhost:4000/api/tenants/${tenant.tenantId}/devices/${deviceId}/actuate`", "`${API_BASE}/api/tenants/${tenant.tenantId}/devices/${deviceId}/actuate`")
      .replaceAll("'http://localhost:4000'", "API_BASE")
      .replaceAll("`http://localhost:4000/api/tenants/${tenant.tenantId}/devices/request`", "`${API_BASE}/api/tenants/${tenant.tenantId}/devices/request`")
      .replaceAll("`http://localhost:4000/api/tenants/${tenant.tenantId}/devices/${simDeviceId}/telemetry/simulate`", "`${API_BASE}/api/tenants/${tenant.tenantId}/devices/${simDeviceId}/telemetry/simulate`");

    fs.writeFileSync(tenantAppPath, content, 'utf8');
    console.log('Successfully refactored Tenant Dashboard App.tsx URLs.');
  } else {
    console.log('Tenant App.tsx already has API_BASE configured.');
  }
}

// 2. Refactor Superadmin App
if (fs.existsSync(superadminAppPath)) {
  let content = fs.readFileSync(superadminAppPath, 'utf8');
  if (content.includes("const API_BASE = 'http://localhost:4000';")) {
    content = content.replace(
      "const API_BASE = 'http://localhost:4000';",
      "const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';"
    );
    fs.writeFileSync(superadminAppPath, content, 'utf8');
    console.log('Successfully refactored SuperAdmin App.tsx API_BASE.');
  } else {
    console.log('SuperAdmin App.tsx already has dynamic API_BASE configured.');
  }
}
