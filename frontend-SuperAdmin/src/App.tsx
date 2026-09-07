import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Terminal, 
  RefreshCw, 
  CheckCircle2, 
  ShieldAlert, 
  ShieldCheck, 
  LogOut, 
  User, 
  Lock, 
  Clock, 
  Download, 
  ArrowRight,
  Database,
  Sliders,
  Trash2,
  Settings
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

interface PendingRequest {
  tenantId: string;
  deviceId: string;
  deviceType: string;
  created_at?: number;
}

interface SuperAdmin {
  email: string;
  role: 'SUPERADMIN';
}

export default function App() {
  // Auth state
  const [token, setToken] = useState<string | null>(localStorage.getItem('superadmin_token'));
  const [superadmin, setSuperadmin] = useState<SuperAdmin | null>(null);
  const [isLogin, setIsLogin] = useState(true);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  // Active workspace state
  const [activeTab, setActiveTab] = useState<'pending_requests' | 'tenant_manager' | 'direct_provision' | 'tenant_profiles'>('pending_requests');

  // Tenant Profile / Devices View state
  const [selectedProfileTenantId, setSelectedProfileTenantId] = useState('');
  const [tenantDevices, setTenantDevices] = useState<any[]>([]);
  const [loadingTenantDevices, setLoadingTenantDevices] = useState(false);
  const [resetCredentialsData, setResetCredentialsData] = useState<any | null>(null);
  const [deviceResetSuccess, setDeviceResetSuccess] = useState<string | null>(null);
  const [deviceResetError, setDeviceResetError] = useState<string | null>(null);
  const [deviceDeleteSuccess, setDeviceDeleteSuccess] = useState<string | null>(null);
  const [deviceDeleteError, setDeviceDeleteError] = useState<string | null>(null);

  // Direct Provisioning & Tenants List State
  const [tenants, setTenants] = useState<{ tenantId: string; companyName: string; adminEmail: string }[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [directDeviceId, setDirectDeviceId] = useState('');
  const [directDeviceType, setDirectDeviceType] = useState('pump');
  const [directError, setDirectError] = useState<string | null>(null);
  const [directSuccess, setDirectSuccess] = useState<string | null>(null);

  // Pending Requests State
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provLogs, setProvLogs] = useState<string[]>([]);
  const [credentials, setCredentials] = useState<{
    certificatePem: string;
    privateKeyPem: string;
    certificateArn: string;
    rootCaPem?: string;
  } | null>(null);

  // Tenant Onboarding State
  const [superadminCompanyName, setSuperadminCompanyName] = useState('');
  const [superadminTenantId, setSuperadminTenantId] = useState('');
  const [superadminEmail, setSuperadminEmail] = useState('');
  const [superadminPassword, setSuperadminPassword] = useState('');
  const [onboardError, setOnboardError] = useState<string | null>(null);
  const [onboardSuccess, setOnboardSuccess] = useState<string | null>(null);

  // Auto-fetch pending requests when logged in
  useEffect(() => {
    if (token) {
      // Decode simple details or fetch superadmin profile
      // For now, set dummy superadmin name
      setSuperadmin({ email: 'super@coreboard.com', role: 'SUPERADMIN' });
      fetchPendingRequests();
      fetchTenants();
    }
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem('superadmin_token');
    setToken(null);
    setSuperadmin(null);
    setCredentials(null);
    setProvLogs([]);
  };

  // Fetch All Onboarded Tenants list
  const fetchTenants = async () => {
    if (!token) return;
    setLoadingTenants(true);
    setDirectError(null);
    try {
      const res = await fetch(`${API_BASE}/api/superadmin/tenants`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch tenants list.');
      setTenants(data || []);
      if (data && data.length > 0 && !selectedTenantId) {
        setSelectedTenantId(data[0].tenantId);
      }
    } catch (err: any) {
      console.error(err);
      setDirectError(err.message);
    } finally {
      setLoadingTenants(false);
    }
  };

  // Direct Device Provisioning handler
  const handleDirectProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedTenantId || !directDeviceId) return;

    setIsProvisioning(true);
    setCredentials(null);
    setDirectError(null);
    setDirectSuccess(null);
    
    setProvLogs([
      `[AWS] Initializing direct authorization payload...`,
      `[AWS] Target Client ID: ${directDeviceId}`,
      `[AWS] Target Tenant: ${selectedTenantId}`,
      `[AWS] Generating secure cryptographic keys...`
    ]);

    try {
      const res = await fetch(`${API_BASE}/api/superadmin/tenants/${selectedTenantId}/devices/provision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          deviceId: directDeviceId,
          deviceType: directDeviceType
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to provision device.');

      setProvLogs(prev => [
        ...prev,
        `[AWS] X.509 Cryptographic Key Pair and Certificate generated.`,
        `[AWS] Client Thing created in IoT Core registry.`,
        `[AWS] Attached certificate to Thing principal.`,
        `[AWS] Associated Multi-Tenant connection policies attached.`,
        `[DynamoDB] Device metadata logged.`,
        `[SUCCESS] Device ${directDeviceId} provisioned successfully.`
      ]);

      setCredentials(data.credentials);
      setDirectSuccess(`Device '${directDeviceId}' successfully provisioned directly under '${selectedTenantId}'.`);
      setDirectDeviceId('');
    } catch (err: any) {
      setProvLogs(prev => [...prev, `[ERROR] Direct provisioning failed: ${err.message}`]);
      setDirectError(err.message);
    } finally {
      setIsProvisioning(false);
    }
  };

  const fetchTenantDevices = async (tenantIdVal: string) => {
    if (!tenantIdVal) {
      setTenantDevices([]);
      return;
    }
    setLoadingTenantDevices(true);
    setDeviceResetSuccess(null);
    setDeviceResetError(null);
    setDeviceDeleteSuccess(null);
    setDeviceDeleteError(null);
    setResetCredentialsData(null);
    try {
      const res = await fetch(`${API_BASE}/api/superadmin/tenants/${tenantIdVal}/devices`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch tenant devices.');
      setTenantDevices(data);
    } catch (err: any) {
      console.error(err);
      setTenantDevices([]);
    } finally {
      setLoadingTenantDevices(false);
    }
  };

  const handleResetDeviceCredentials = async (tenantIdVal: string, deviceIdVal: string) => {
    if (!window.confirm(`Are you sure you want to regenerate credentials for device ${deviceIdVal}? The old certificates will be permanently deleted and invalidated in AWS IoT Core.`)) {
      return;
    }
    setDeviceResetSuccess(null);
    setDeviceResetError(null);
    setResetCredentialsData(null);
    setProvLogs(prev => [...prev, `[INFO] Initiating credential regeneration for ${deviceIdVal}...`]);
    try {
      const res = await fetch(`${API_BASE}/api/superadmin/tenants/${tenantIdVal}/devices/${deviceIdVal}/reset`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to regenerate credentials.');

      setProvLogs(prev => [
        ...prev,
        `[AWS] Old certificates detached and deleted.`,
        `[AWS] New X.509 Cryptographic Key Pair generated.`,
        `[AWS] Attached new principal to Thing ${deviceIdVal}.`,
        `[DynamoDB] Device metadata updated.`,
        `[SUCCESS] Credentials regenerated successfully for ${deviceIdVal}.`
      ]);

      setResetCredentialsData(data.credentials);
      setDeviceResetSuccess(`Credentials successfully regenerated for device ${deviceIdVal}. Please download the new certificate package.`);
      fetchTenantDevices(tenantIdVal); // Refresh device list
    } catch (err: any) {
      setDeviceResetError(err.message);
      setProvLogs(prev => [...prev, `[ERROR] Credential regeneration failed: ${err.message}`]);
    }
  };

  const handleDeleteDevice = async (tenantIdVal: string, deviceIdVal: string) => {
    if (!window.confirm(`WARNING: Are you sure you want to delete device ${deviceIdVal} completely? This will delete the Thing from AWS IoT Core, deactivate and delete its certificates, and remove its metadata from DynamoDB. This action is irreversible.`)) {
      return;
    }
    setDeviceDeleteSuccess(null);
    setDeviceDeleteError(null);
    setProvLogs(prev => [...prev, `[INFO] Deleting device ${deviceIdVal}...`]);
    try {
      const res = await fetch(`${API_BASE}/api/superadmin/tenants/${tenantIdVal}/devices/${deviceIdVal}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete device.');

      setProvLogs(prev => [
        ...prev,
        `[AWS] Certs detached and deleted.`,
        `[AWS] Thing deleted from registry.`,
        `[DynamoDB] Device metadata removed.`,
        `[SUCCESS] Device ${deviceIdVal} completely deleted.`
      ]);

      setDeviceDeleteSuccess(`Device ${deviceIdVal} has been completely deleted.`);
      fetchTenantDevices(tenantIdVal); // Refresh device list
    } catch (err: any) {
      setDeviceDeleteError(err.message);
      setProvLogs(prev => [...prev, `[ERROR] Deleting device failed: ${err.message}`]);
    }
  };

  // Auth Handlers
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
    const payload = isLogin 
      ? { email, password, tenantId: 'superadmin' }
      : { 
          email, 
          password, 
          role: 'SUPERADMIN', 
          tenantId: 'superadmin', 
          companyName: 'Coreboard',
          signupSecret: secretKey 
        };

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed.');
      }

      if (isLogin) {
        if (data.tenant?.role !== 'SUPERADMIN') {
          throw new Error('Forbidden: Only SuperAdmins can access this portal.');
        }
        localStorage.setItem('superadmin_token', data.token);
        setToken(data.token);
      } else {
        setAuthSuccess('SuperAdmin registered successfully! Please log in.');
        setIsLogin(true);
      }
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  // Fetch Pending Requests Queue
  const fetchPendingRequests = async () => {
    if (!token) return;
    setLoadingRequests(true);
    try {
      const res = await fetch(`${API_BASE}/api/superadmin/requests`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch pending requests.');
      setPendingRequests(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingRequests(false);
    }
  };

  // Approve & Provision mTLS Client in AWS IoT Core
  const handleApproveRequest = async (reqItem: PendingRequest) => {
    if (!token) return;
    setIsProvisioning(true);
    setCredentials(null);
    setProvLogs([
      `[AWS] Requesting device authorization payload...`,
      `[AWS] Target Client ID: ${reqItem.deviceId}`,
      `[AWS] Initializing secure certificate generation...`
    ]);

    try {
      const res = await fetch(`${API_BASE}/api/superadmin/requests/approve`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          tenantId: reqItem.tenantId,
          deviceId: reqItem.deviceId,
          deviceType: reqItem.deviceType
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve request.');

      setProvLogs(prev => [
        ...prev,
        `[AWS] mTLS Cryptographic Key Pair and Certificate generated.`,
        `[AWS] Client Thing created: ${reqItem.deviceId}`,
        `[AWS] Certificate attached to Thing principal.`,
        `[AWS] Associated Multi-Tenant Policy attached.`,
        `[DynamoDB] Device metadata logged under Tenant: ${reqItem.tenantId}`,
        `[DynamoDB] Deleted setup request key.`,
        `[SUCCESS] Device ${reqItem.deviceId} provisioned successfully.`
      ]);

      setCredentials(data.credentials);
      fetchPendingRequests(); // reload list

    } catch (err: any) {
      setProvLogs(prev => [...prev, `[ERROR] Provisioning failed: ${err.message}`]);
    } finally {
      setIsProvisioning(false);
    }
  };

  // Onboard New Tenant Organization
  const handleSuperadminRegisterTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setOnboardError(null);
    setOnboardSuccess(null);

    try {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: superadminEmail,
          password: superadminPassword,
          role: 'ADMIN',
          tenantId: superadminTenantId,
          companyName: superadminCompanyName
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to onboard tenant.');

      setOnboardSuccess(`Tenant '${superadminCompanyName}' (${superadminTenantId}) successfully onboarded.`);
      setSuperadminCompanyName('');
      setSuperadminTenantId('');
      setSuperadminEmail('');
      setSuperadminPassword('');
    } catch (err: any) {
      setOnboardError(err.message);
    }
  };

  // Helper: Download generated keys
  const downloadCredentialFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Auth Screen Template
  if (!token) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center p-6 relative overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="w-full max-w-md bg-[#0f172a] border border-[#1e293b] rounded-2xl p-8 shadow-2xl relative z-10">
          <div className="text-center mb-8">
            <div className="inline-flex bg-gradient-to-tr from-indigo-500 to-blue-600 p-3 rounded-xl text-white shadow-xl shadow-indigo-500/15 mb-4">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              Coreboard SuperAdmin
            </h1>
            <p className="text-xs text-indigo-400 font-mono tracking-wider uppercase mt-1">
              Internal Control Panel
            </p>
          </div>

          {authError && (
            <div className="bg-rose-950/40 border border-rose-500/30 text-rose-300 p-3 rounded-lg text-xs font-mono mb-6 flex items-center gap-2">
              <ShieldAlert className="w-4.5 h-4.5 shrink-0" />
              <span>{authError}</span>
            </div>
          )}
          {authSuccess && (
            <div className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 p-3 rounded-lg text-xs font-mono mb-6 flex items-center gap-2">
              <CheckCircle2 className="w-4.5 h-4.5 shrink-0" />
              <span>{authSuccess}</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4 text-xs font-mono">
            <div>
              <label className="block text-slate-400 mb-1.5 uppercase font-bold tracking-wide">Security Email</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <User className="h-4 w-4" />
                </span>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="super@coreboard.com"
                  className="w-full bg-[#0b0f19] border border-[#334155] rounded-xl pl-10 pr-3 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1.5 uppercase font-bold tracking-wide">Access Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <Lock className="h-4 w-4" />
                </span>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#0b0f19] border border-[#334155] rounded-xl pl-10 pr-3 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>
            </div>

            {!isLogin && (
              <div>
                <label className="block text-slate-400 mb-1.5 uppercase font-bold tracking-wide">Superadmin Secret Key</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                    <Lock className="h-4 w-4" />
                  </span>
                  <input 
                    type="password" 
                    required
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    placeholder="Enter registration key"
                    className="w-full bg-[#0b0f19] border border-[#334155] rounded-xl pl-10 pr-3 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 font-semibold"
                  />
                </div>
              </div>
            )}

            <button 
              type="submit" 
              className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-1.5 text-xs uppercase"
            >
              <span>{isLogin ? 'Grant Access' : 'Register Officer'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="text-center mt-6">
            <button 
              onClick={() => { setIsLogin(!isLogin); setAuthError(null); setAuthSuccess(null); }}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-mono transition-colors"
            >
              {isLogin ? "Need a SuperAdmin account? Sign Up" : "Already registered? Log In"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard Panel Template
  return (
    <div className="min-h-screen bg-[#0b0f19] text-[#f1f5f9] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#1e293b] bg-[#0f172a] px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-indigo-500 to-blue-600 p-2 rounded-lg text-white shadow-lg shadow-indigo-500/20">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              Coreboard SuperAdmin Console
            </h1>
            <p className="text-xs text-indigo-400 font-mono font-medium uppercase tracking-wider">
              Tenant Orchestration & Device Provisioning
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right font-mono text-xs hidden md:block">
            <div className="text-slate-300">{superadmin?.email}</div>
            <div className="text-indigo-400 text-[10px] uppercase font-bold">Officer Status: Active</div>
          </div>
          <button 
            onClick={handleLogout}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-mono transition-colors flex items-center gap-1.5"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      </header>

      {/* Workspace Tabs */}
      <div className="bg-[#0f172a]/40 border-b border-[#1e293b] px-6 py-2.5 flex items-center gap-4">
        <button 
          onClick={() => setActiveTab('pending_requests')}
          className={`px-4 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'pending_requests' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="h-4 w-4" />
          Pending Requests ({pendingRequests.length})
        </button>

        <button 
          onClick={() => setActiveTab('tenant_manager')}
          className={`px-4 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'tenant_manager' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building2 className="h-4 w-4" />
          Tenant Manager
        </button>

        <button 
          onClick={() => { setActiveTab('direct_provision'); fetchTenants(); }}
          className={`px-4 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'direct_provision' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Database className="h-4 w-4" />
          Direct Provisioning
        </button>

        <button 
          onClick={() => { setActiveTab('tenant_profiles'); fetchTenants(); }}
          className={`px-4 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'tenant_profiles' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="h-4 w-4" />
          Tenant Profiles
        </button>
      </div>

      {/* Main Workspace */}
      <main className="flex-1 p-6 overflow-y-auto space-y-6">

        {/* Tab 1: Pending Device Requests */}
        {activeTab === 'pending_requests' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Logs Terminal & Credentials */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Terminal Logs */}
              <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5 shadow-xl flex flex-col h-[280px]">
                <div className="flex items-center gap-2 mb-3">
                  <Terminal className="w-4 h-4 text-indigo-400 animate-pulse" />
                  <h3 className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wider">AWS Provisioning Stream</h3>
                </div>
                <div className="flex-1 bg-[#0b0f19] border border-slate-800 rounded-lg p-3 font-mono text-[10px] overflow-y-auto flex flex-col gap-1.5 select-text">
                  {provLogs.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-600">
                      &gt;&gt; CONSOLE READY. APPROVE A DEVICE TO COMMENCE &lt;&lt;
                    </div>
                  ) : (
                    provLogs.map((log, idx) => {
                      let color = 'text-slate-400';
                      if (log.includes('[ERROR]')) color = 'text-rose-500 font-bold';
                      if (log.includes('[SUCCESS]')) color = 'text-emerald-400 font-bold';
                      if (log.includes('[AWS]')) color = 'text-cyan-400';
                      return <div key={idx} className={`${color} leading-4 border-l border-slate-800 pl-2`}>{log}</div>;
                    })
                  )}
                </div>
              </div>

              {/* Downloads Panel */}
              {credentials && (
                <div className="bg-[#0b1626]/90 border border-cyan-500/30 rounded-xl p-5 shadow-xl animate-[fadeIn_0.5s_ease-out]">
                  <h3 className="text-xs font-bold font-mono text-cyan-400 mb-2 flex items-center gap-2 uppercase tracking-wide">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                    mTLS Credentials Generated
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono leading-relaxed mb-4">
                    Cryptographic certificates successfully established in AWS IoT Core registry. Download files to flash onto ESP32 simulator client.
                  </p>

                  <div className="flex flex-col gap-2 font-mono text-xs">
                    <button
                      onClick={() => downloadCredentialFile(credentials.certificatePem, `device_certificate.crt`)}
                      className="w-full bg-[#102431] border border-cyan-500/30 text-cyan-400 hover:bg-[#122e3e] font-bold p-3 rounded-lg flex items-center justify-between transition-all"
                    >
                      <span className="flex items-center gap-1.5">
                        <Download className="h-4 w-4" /> Download Certificate
                      </span>
                      <span className="text-[9px] text-slate-500 font-normal">device.pem.crt</span>
                    </button>

                    <button
                      onClick={() => downloadCredentialFile(credentials.privateKeyPem, `private_key.key`)}
                      className="w-full bg-[#102431] border border-cyan-500/30 text-cyan-400 hover:bg-[#122e3e] font-bold p-3 rounded-lg flex items-center justify-between transition-all"
                    >
                      <span className="flex items-center gap-1.5">
                        <Download className="h-4 w-4" /> Download Private Key
                      </span>
                      <span className="text-[9px] text-slate-500 font-normal">private.pem.key</span>
                    </button>

                    {credentials.rootCaPem && (
                      <button
                        onClick={() => downloadCredentialFile(credentials.rootCaPem!, `AmazonRootCA1.pem`)}
                        className="w-full bg-[#102431] border border-cyan-500/30 text-cyan-400 hover:bg-[#122e3e] font-bold p-3 rounded-lg flex items-center justify-between transition-all"
                      >
                        <span className="flex items-center gap-1.5">
                          <Download className="h-4 w-4" /> Download Root CA
                        </span>
                        <span className="text-[9px] text-slate-500 font-normal">AmazonRootCA1.pem</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Queue Table */}
            <div className="lg:col-span-7 bg-[#0f172a] border border-[#1e293b] rounded-xl p-6 shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-200">Pending Device Registry Queue</h3>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">Authorization and cryptographic credentials generation queue.</p>
                </div>
                <button 
                  onClick={fetchPendingRequests}
                  className="text-xs font-mono text-cyan-400 flex items-center gap-1.5 hover:text-cyan-300 transition-all bg-slate-900 border border-[#1e293b] px-3.5 py-1.5 rounded-lg font-bold"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh Queue
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 uppercase text-[10px] tracking-wider pb-3 font-bold">
                      <th className="pb-3">Tenant ID</th>
                      <th className="pb-3">Device Name</th>
                      <th className="pb-3">Profile</th>
                      <th className="pb-3">Date Requested</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingRequests ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500">
                          Scanning queue in DynamoDB...
                        </td>
                      </tr>
                    ) : pendingRequests.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-600 italic">
                          No pending requests in authorization queue.
                        </td>
                      </tr>
                    ) : (
                      pendingRequests.map((reqItem, idx) => (
                        <tr key={idx} className="border-b border-slate-900/60 hover:bg-slate-900/10 transition-all">
                          <td className="py-3.5 text-indigo-400 font-bold">{reqItem.tenantId}</td>
                          <td className="py-3.5 text-slate-200">{reqItem.deviceId}</td>
                          <td className="py-3.5 text-slate-400 uppercase text-[10px] tracking-wider">{reqItem.deviceType}</td>
                          <td className="py-3.5 text-slate-500">
                            {new Date(reqItem.created_at || Date.now()).toLocaleString()}
                          </td>
                          <td className="py-3.5 text-right">
                            <button
                              disabled={isProvisioning}
                              onClick={() => handleApproveRequest(reqItem)}
                              className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all text-[10px] uppercase shadow-lg shadow-emerald-600/15"
                            >
                              Approve & Provision
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* Tab 2: Onboard Tenant */}
        {activeTab === 'tenant_manager' && (
          <div className="max-w-xl mx-auto bg-[#0f172a] border border-[#1e293b] rounded-xl p-6 shadow-xl">
            <div className="flex items-center gap-2.5 mb-2 border-b border-[#1e293b] pb-4">
              <Building2 className="w-5 h-5 text-indigo-400" />
              <div>
                <h3 className="text-base font-semibold text-slate-200">Onboard New Tenant Company</h3>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">Establishes isolated partition and registers the initial Tenant Admin account.</p>
              </div>
            </div>

            {onboardError && (
              <div className="bg-rose-950/50 border border-rose-500/30 text-rose-300 p-3 rounded-lg text-xs font-mono mb-4 mt-4 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{onboardError}</span>
              </div>
            )}
            {onboardSuccess && (
              <div className="bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 p-3 rounded-lg text-xs font-mono mb-4 mt-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{onboardSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSuperadminRegisterTenant} className="space-y-4 font-mono text-xs mt-4">
              <div>
                <label className="block text-slate-400 mb-1.5 font-bold uppercase tracking-wide">Company / Organization Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Stark Industries"
                  value={superadminCompanyName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSuperadminCompanyName(val);
                    const slug = val
                      .toLowerCase()
                      .replace(/[^a-z0-9\s-]/g, '')
                      .replace(/[\s_-]+/g, '-')
                      .replace(/^-+|-+$/g, '');
                    setSuperadminTenantId(slug);
                  }}
                  className="w-full bg-[#0b0f19] border border-[#334155] rounded-xl p-3 text-slate-200 focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5 font-bold uppercase tracking-wide">Tenant Domain ID (Slug)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. stark-ind"
                  value={superadminTenantId}
                  onChange={(e) => setSuperadminTenantId(e.target.value)}
                  className="w-full bg-[#0b0f19] border border-[#334155] rounded-xl p-3 text-slate-200 focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5 font-bold uppercase tracking-wide">Admin Representative Email</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. admin@stark.com"
                  value={superadminEmail}
                  onChange={(e) => setSuperadminEmail(e.target.value)}
                  className="w-full bg-[#0b0f19] border border-[#334155] rounded-xl p-3 text-slate-200 focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5 font-bold uppercase tracking-wide">Temporary Secret Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={superadminPassword}
                  onChange={(e) => setSuperadminPassword(e.target.value)}
                  className="w-full bg-[#0b0f19] border border-[#334155] rounded-xl p-3 text-slate-200 focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl font-bold uppercase tracking-wider mt-4 bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/10 transition-all flex items-center justify-center gap-1.5"
              >
                <Database className="h-4 w-4" />
                Complete Tenant Onboarding
              </button>
            </form>
          </div>
        )}

        {/* Tab 3: Direct Provisioning */}
        {activeTab === 'direct_provision' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left: Provisioning Logs and Keys */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Terminal Logs */}
              <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5 shadow-xl flex flex-col h-[280px]">
                <div className="flex items-center gap-2 mb-3">
                  <Terminal className="w-4 h-4 text-indigo-400 animate-pulse" />
                  <h3 className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wider">AWS Provisioning Stream</h3>
                </div>
                <div className="flex-1 bg-[#0b0f19] border border-slate-800 rounded-lg p-3 font-mono text-[10px] overflow-y-auto flex flex-col gap-1.5 select-text">
                  {provLogs.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-600">
                      &gt;&gt; CONSOLE READY. DIRECTLY PROVISION A DEVICE TO COMMENCE &lt;&lt;
                    </div>
                  ) : (
                    provLogs.map((log, idx) => {
                      let color = 'text-slate-400';
                      if (log.includes('[ERROR]')) color = 'text-rose-500 font-bold';
                      if (log.includes('[SUCCESS]')) color = 'text-emerald-400 font-bold';
                      if (log.includes('[AWS]')) color = 'text-cyan-400';
                      return <div key={idx} className={`${color} leading-4 border-l border-slate-800 pl-2`}>{log}</div>;
                    })
                  )}
                </div>
              </div>

              {/* Downloads Panel */}
              {credentials && (
                <div className="bg-[#0b1626]/90 border border-cyan-500/30 rounded-xl p-5 shadow-xl animate-[fadeIn_0.5s_ease-out]">
                  <h3 className="text-xs font-bold font-mono text-cyan-400 mb-2 flex items-center gap-2 uppercase tracking-wide">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                    mTLS Credentials Generated
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono leading-relaxed mb-4">
                    Cryptographic certificates successfully established in AWS IoT Core registry. Download files to flash onto ESP32 simulator client.
                  </p>

                  <div className="flex flex-col gap-2 font-mono text-xs">
                    <button
                      onClick={() => downloadCredentialFile(credentials.certificatePem, `device_certificate.crt`)}
                      className="w-full bg-[#102431] border border-cyan-500/30 text-cyan-400 hover:bg-[#122e3e] font-bold p-3 rounded-lg flex items-center justify-between transition-all"
                    >
                      <span className="flex items-center gap-1.5">
                        <Download className="h-4 w-4" /> Download Certificate
                      </span>
                      <span className="text-[9px] text-slate-500 font-normal">device.pem.crt</span>
                    </button>

                    <button
                      onClick={() => downloadCredentialFile(credentials.privateKeyPem, `private_key.key`)}
                      className="w-full bg-[#102431] border border-cyan-500/30 text-cyan-400 hover:bg-[#122e3e] font-bold p-3 rounded-lg flex items-center justify-between transition-all"
                    >
                      <span className="flex items-center gap-1.5">
                        <Download className="h-4 w-4" /> Download Private Key
                      </span>
                      <span className="text-[9px] text-slate-500 font-normal">private.pem.key</span>
                    </button>

                    {credentials.rootCaPem && (
                      <button
                        onClick={() => downloadCredentialFile(credentials.rootCaPem!, `AmazonRootCA1.pem`)}
                        className="w-full bg-[#102431] border border-cyan-500/30 text-cyan-400 hover:bg-[#122e3e] font-bold p-3 rounded-lg flex items-center justify-between transition-all"
                      >
                        <span className="flex items-center gap-1.5">
                          <Download className="h-4 w-4" /> Download Root CA
                        </span>
                        <span className="text-[9px] text-slate-500 font-normal">AmazonRootCA1.pem</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Right: Direct Provisioning Form */}
            <div className="lg:col-span-7 bg-[#0f172a] border border-[#1e293b] rounded-xl p-6 shadow-xl">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-[#1e293b]">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-200">Direct Device Provisioning</h3>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">Provision X.509 certificates and Thing registry slots directly for any tenant.</p>
                </div>
                <button 
                  onClick={fetchTenants}
                  className="text-[10px] font-mono text-cyan-400 flex items-center gap-1.5 hover:text-cyan-300 transition-all bg-slate-900 border border-[#1e293b] px-3.5 py-1.5 rounded-lg font-bold"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh Tenants
                </button>
              </div>

              {directError && (
                <div className="bg-rose-950/50 border border-rose-500/30 text-rose-300 p-3 rounded-lg text-xs font-mono mb-4 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{directError}</span>
                </div>
              )}

              {directSuccess && (
                <div className="bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 p-3 rounded-lg text-xs font-mono mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{directSuccess}</span>
                </div>
              )}

              <form onSubmit={handleDirectProvision} className="space-y-4 font-mono text-xs">
                <div>
                  <label className="block text-slate-400 mb-1.5 font-bold uppercase tracking-wide">Target Tenant Domain ID</label>
                  {loadingTenants ? (
                    <div className="text-slate-500 text-xs">Loading tenants list...</div>
                  ) : tenants.length === 0 ? (
                    <div className="text-rose-400 text-xs">No onboarded tenants available. Please onboard a tenant first.</div>
                  ) : (
                    <select
                      value={selectedTenantId}
                      onChange={(e) => setSelectedTenantId(e.target.value)}
                      className="w-full bg-[#0b0f19] border border-[#334155] rounded-xl p-3.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-semibold"
                    >
                      {tenants.map(t => (
                        <option key={t.tenantId} value={t.tenantId}>
                          {t.companyName} ({t.tenantId})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-bold uppercase tracking-wide">Unique Device ID / Thing Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. SMART-LOCK-101"
                      value={directDeviceId}
                      onChange={(e) => setDirectDeviceId(e.target.value)}
                      className="w-full bg-[#0b0f19] border border-[#334155] rounded-xl p-3.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1.5 font-bold uppercase tracking-wide">Device Profile Type</label>
                    <select
                      value={directDeviceType}
                      onChange={(e) => setDirectDeviceType(e.target.value)}
                      className="w-full bg-[#0b0f19] border border-[#334155] rounded-xl p-3.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-semibold"
                    >
                      <option value="pump">Industrial Water Pump</option>
                      <option value="temp_sensor">Ambient Weather/Temp Sensor</option>
                      <option value="pressure_sensor">High-Pressure Pipeline Gauge</option>
                      <option value="power_meter">Smart Electricity Grid Meter</option>
                      <option value="smart_lock">Domestic Smart Door Lock</option>
                      <option value="motion_sensor">Home Security Motion Sensor</option>
                      <option value="smart_switch">Smart Relay Power Switch</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isProvisioning || tenants.length === 0}
                  className="w-full py-3.5 rounded-xl font-bold uppercase tracking-wider mt-4 bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/10 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Database className="h-4 w-4" />
                  Directly Provision Device
                </button>
              </form>
            </div>

          </div>
        )}

        {/* Tab 4: Tenant Profiles & Device Management */}
        {activeTab === 'tenant_profiles' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-[fadeIn_0.2s_ease-out]">
            
            {/* Left Column: Tenant Selection & Details */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Select Tenant Card */}
              <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-6 shadow-xl">
                <h3 className="text-sm font-semibold orbitron text-white mb-1 uppercase tracking-wide flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-indigo-400" />
                  Select Tenant Context
                </h3>
                <p className="text-[10px] text-slate-500 font-mono mb-4">View device profile registry and execute remote credentials reset or removal.</p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-slate-400 text-[10px] font-mono font-bold mb-1.5 uppercase">Tenant Business Account</label>
                    <select
                      value={selectedProfileTenantId}
                      onChange={(e) => {
                        setSelectedProfileTenantId(e.target.value);
                        fetchTenantDevices(e.target.value);
                      }}
                      className="w-full bg-[#0b0f19] border border-[#334155] rounded-xl p-3.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer font-mono font-semibold"
                    >
                      <option value="">-- Choose Tenant --</option>
                      {tenants.map(t => (
                        <option key={t.tenantId} value={t.tenantId}>
                          {t.companyName} ({t.tenantId})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Selected Tenant Info */}
              {selectedProfileTenantId && (() => {
                const currentTenant = tenants.find(t => t.tenantId === selectedProfileTenantId);
                if (!currentTenant) return null;
                return (
                  <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5 shadow-xl font-mono text-[10px] text-slate-400 space-y-2.5">
                    <h4 className="text-[11px] font-bold text-slate-200 uppercase tracking-wide border-b border-[#1e293b] pb-1.5">Tenant Profile Details</h4>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Company Name:</span>
                      <span className="text-slate-300 font-bold">{currentTenant.companyName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Tenant ID Slug:</span>
                      <span className="text-slate-300 font-bold text-indigo-400">{currentTenant.tenantId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Administrator:</span>
                      <span className="text-slate-300 font-bold select-all">{currentTenant.adminEmail}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Reset Logs Console */}
              <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5 flex flex-col h-[200px] shadow-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Terminal className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-[10px] font-bold orbitron text-white uppercase tracking-wider">AWS / DB Event Logs</h3>
                </div>
                <div className="flex-1 bg-black/60 rounded-lg p-3.5 font-mono text-[9px] overflow-y-auto border border-slate-900 flex flex-col gap-1.5">
                  {provLogs.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-700">
                      &gt;&gt; MONITOR READY &lt;&lt;
                    </div>
                  ) : (
                    provLogs.map((log, idx) => {
                      let color = 'text-slate-400';
                      if (log.includes('[ERROR]')) color = 'text-rose-500 font-bold';
                      if (log.includes('[SUCCESS]')) color = 'text-emerald-400 font-bold';
                      if (log.includes('[AWS]')) color = 'text-indigo-400';
                      return <div key={idx} className={`${color} border-l border-slate-850 pl-2`}>{log}</div>;
                    })
                  )}
                </div>
              </div>

            </div>

            {/* Right Column: Device Registry List */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Devices Card */}
              <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-6 shadow-xl space-y-4">
                <div className="flex justify-between items-center border-b border-[#1e293b] pb-4">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-200">Device Registry Matrix</h3>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">Active client hardware tokens and cryptographic configurations under this partition key.</p>
                  </div>
                  {selectedProfileTenantId && (
                    <button 
                      onClick={() => fetchTenantDevices(selectedProfileTenantId)}
                      disabled={loadingTenantDevices}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 border border-[#1e293b] text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-all font-mono"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingTenantDevices ? 'animate-spin' : ''}`} />
                      Refresh Registry
                    </button>
                  )}
                </div>

                {deviceResetSuccess && (
                  <div className="bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 text-[10px] p-3 rounded-lg font-mono">
                    ✅ {deviceResetSuccess}
                  </div>
                )}
                {deviceResetError && (
                  <div className="bg-rose-950/40 border border-rose-500/20 text-rose-400 text-[10px] p-3 rounded-lg font-mono">
                    ❌ {deviceResetError}
                  </div>
                )}
                {deviceDeleteSuccess && (
                  <div className="bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 text-[10px] p-3 rounded-lg font-mono">
                    🗑️ {deviceDeleteSuccess}
                  </div>
                )}
                {deviceDeleteError && (
                  <div className="bg-rose-950/40 border border-rose-500/20 text-rose-400 text-[10px] p-3 rounded-lg font-mono">
                    ❌ {deviceDeleteError}
                  </div>
                )}

                {!selectedProfileTenantId ? (
                  <div className="text-center py-12 border border-dashed border-[#1e293b] rounded-xl bg-slate-950/10">
                    <Building2 className="w-10 h-10 text-slate-700 mx-auto mb-2" />
                    <p className="text-xs font-mono text-slate-500">Select a tenant on the left to inspect and manage devices.</p>
                  </div>
                ) : loadingTenantDevices ? (
                  <div className="text-center py-12 font-mono text-xs text-slate-500">
                    Querying DynamoDB partition registry...
                  </div>
                ) : tenantDevices.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-[#1e293b] rounded-xl bg-slate-950/10 font-mono text-xs text-slate-500">
                    No devices registered under this tenant.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-[#1e293b] text-slate-500 uppercase text-[9px] tracking-wider pb-2">
                          <th className="pb-2 font-bold">Device ID</th>
                          <th className="pb-2 font-bold">Hardware Classification</th>
                          <th className="pb-2 font-bold">Created Date</th>
                          <th className="pb-2 font-bold">AWS Certificate ARN</th>
                          <th className="pb-2 font-bold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tenantDevices.map(device => (
                          <tr key={device.device_id} className="border-b border-slate-900/60 hover:bg-[#1e293b]/10 transition-all">
                            <td className="py-3 text-slate-200 font-bold">{device.device_id}</td>
                            <td className="py-3 text-slate-400 uppercase text-[10px] tracking-wider">{device.device_type}</td>
                            <td className="py-3 text-slate-500">{new Date(device.created_at || Date.now()).toLocaleDateString()}</td>
                            <td className="py-3 text-slate-500 text-[10px] select-all max-w-[150px] truncate" title={device.certArn}>
                              {device.certArn ? `${device.certArn.substring(0, 15)}...${device.certArn.slice(-8)}` : 'None'}
                            </td>
                            <td className="py-3 text-right space-x-2">
                              <button
                                onClick={() => handleResetDeviceCredentials(selectedProfileTenantId, device.device_id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-950/40 border border-indigo-500/20 text-[10px] font-bold text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all font-semibold"
                                title="Re-Setup device keys"
                              >
                                <Settings className="h-3 w-3" />
                                Re-Setup
                              </button>
                              <button
                                onClick={() => handleDeleteDevice(selectedProfileTenantId, device.device_id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-950/40 border border-rose-500/20 text-[10px] font-bold text-rose-400 hover:bg-rose-600 hover:text-white transition-all font-semibold"
                                title="Delete device completely"
                              >
                                <Trash2 className="h-3 w-3" />
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Reset Credentials Download Panel */}
              {resetCredentialsData && (
                <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center gap-2 border-b border-[#1e293b] pb-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    <h3 className="text-sm font-semibold orbitron text-white uppercase tracking-wide">Credentials Download Packages</h3>
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono">
                    New cryptographic certificates successfully established in AWS IoT Core registry. Download files to flash onto ESP32 simulator client.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-[10px]">
                    <button
                      onClick={() => downloadCredentialFile(resetCredentialsData.certificatePem, `device_certificate.crt`)}
                      className="w-full bg-[#102431] border border-cyan-500/30 text-cyan-400 hover:bg-[#122e3e] font-bold p-3 rounded-lg flex items-center justify-between transition-all"
                    >
                      <span className="flex items-center gap-1.5">
                        <Download className="h-4 w-4" /> Download Certificate
                      </span>
                      <span className="text-[9px] text-slate-500 font-normal">device.pem.crt</span>
                    </button>

                    <button
                      onClick={() => downloadCredentialFile(resetCredentialsData.privateKeyPem, `private_key.key`)}
                      className="w-full bg-[#102431] border border-cyan-500/30 text-cyan-400 hover:bg-[#122e3e] font-bold p-3 rounded-lg flex items-center justify-between transition-all"
                    >
                      <span className="flex items-center gap-1.5">
                        <Download className="h-4 w-4" /> Download Private Key
                      </span>
                      <span className="text-[9px] text-slate-500 font-normal">private.pem.key</span>
                    </button>
                  </div>
                </div>
              )}

            </div>

          </div>
        )}
      </main>
    </div>
  );
}
