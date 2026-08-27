require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'coreboard-secret-super-key';
const API_BASE = 'http://localhost:4000';

const payload = {
  email: 'super@coreboard.com',
  role: 'SUPERADMIN',
  tenantId: 'superadmin'
};

const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

async function testApi() {
  try {
    const res = await fetch(`${API_BASE}/api/superadmin/tenants/stark-ind/devices`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    console.log("Response Status:", res.status);
    const body = await res.json();
    console.log("Response Body:", JSON.stringify(body, null, 2));
  } catch (err) {
    console.error("Test API Error:", err);
  }
}

testApi();
