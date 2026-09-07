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
  Trash2,
  Cpu,
  Layers,
  ChevronRight,
  Menu,
  KeyRound,
  PlusCircle
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

  // Layout & Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
      setSuperadmin({ email: 'superadmin@coreboard.io', role: 'SUPERADMIN' });
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
      `[AWS IoT] Initializing authorization payload...`,
      `[AWS IoT] Target Thing Name: ${directDeviceId}`,
      `[AWS IoT] Target Tenant Partition: TENANT#${selectedTenantId}`,
      `[AWS IoT] Generating mTLS X.509 Cryptographic Keys...`
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
      if (!res.ok) throw new Error(data.error || 'Direct provisioning failed.');

      setProvLogs(prev => [
        ...prev,
        `[AWS IoT] Registered Thing: ${directDeviceId}`,
        `[AWS IoT] Generated Certificate & RSA Private Key`,
        `[AWS IoT] Bound Certificate Principal to Thing Name`,
        `[AWS IoT] Attached MultiTenantDevicePolicy & MultiTenantBackendPolicy`,
        `[DynamoDB] Saved METADATA#DEVICE#${directDeviceId} under TENANT#${selectedTenantId}`,
        `[SUCCESS] Provisioning complete. Download credentials package below.`
      ]);

      setCredentials(data.credentials);
      setDirectSuccess(data.message || 'Device provisioned successfully.');
      setDirectDeviceId('');
    } catch (err: any) {
      setDirectError(err.message);
      setProvLogs(prev => [...prev, `[ERROR] ${err.message}`]);
    } finally {
      setIsProvisioning(false);
    }
  };

  // Fetch Pending Requests
  const fetchPendingRequests = async () => {
    if (!token) return;
    setLoadingRequests(true);
    try {
      const res = await fetch(`${API_BASE}/api/superadmin/requests`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch queue.');
      setPendingRequests(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingRequests(false);
    }
  };

  // Approve Pending Device Request
  const handleApprove = async (req: PendingRequest) => {
    if (!token) return;
    setIsProvisioning(true);
    setCredentials(null);
    setProvLogs([
      `[AWS IoT] Initializing authorization for pending request...`,
      `[AWS IoT] Target Thing Name: ${req.deviceId}`,
      `[AWS IoT] Target Tenant: ${req.tenantId}`,
      `[AWS IoT] Calling CreateThingCommand...`
    ]);

    try {
      const res = await fetch(`${API_BASE}/api/superadmin/requests/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          tenantId: req.tenantId,
          deviceId: req.deviceId,
          deviceType: req.deviceType
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Approval failed.');

      setProvLogs(prev => [
        ...prev,
        `[AWS IoT] Registered Thing: ${req.deviceId}`,
        `[AWS IoT] Generated Certificate & Key Pair`,
        `[AWS IoT] Attached MultiTenant Policies`,
        `[DynamoDB] Logged METADATA#DEVICE#${req.deviceId}`,
        `[DynamoDB] Deleted setup request from queue`,
        `[SUCCESS] Credentials package ready for download.`
      ]);

      setCredentials(data.credentials);
      fetchPendingRequests();
    } catch (err: any) {
      setProvLogs(prev => [...prev, `[ERROR] ${err.message}`]);
    } finally {
      setIsProvisioning(false);
    }
  };

  // Fetch Devices under a specific Tenant
  const fetchTenantDevices = async (tId: string) => {
    if (!token || !tId) return;
    setSelectedProfileTenantId(tId);
    setLoadingTenantDevices(true);
    setResetCredentialsData(null);
    setDeviceResetSuccess(null);
    setDeviceResetError(null);
    setDeviceDeleteSuccess(null);
    setDeviceDeleteError(null);

    try {
      const res = await fetch(`${API_BASE}/api/superadmin/tenants/${tId}/devices`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch devices for tenant.');
      setTenantDevices(data || []);
    } catch (err: any) {
      console.error(err);
      setDeviceResetError(err.message);
    } finally {
      setLoadingTenantDevices(false);
    }
  };

  // Regenerate / Reset Credentials for a Device
  const handleRegenerateCredentials = async (tId: string, dId: string) => {
    if (!token) return;
    setResetCredentialsData(null);
    setDeviceResetSuccess(null);
    setDeviceResetError(null);

    try {
      const res = await fetch(`${API_BASE}/api/superadmin/tenants/${tId}/devices/${dId}/regenerate-keys`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to regenerate credentials.');
      setResetCredentialsData(data.credentials);
      setDeviceResetSuccess(`Credentials successfully regenerated for device ${dId}. Download updated package below.`);
    } catch (err: any) {
      setDeviceResetError(err.message);
    }
  };

  // Revoke / Delete a Device
  const handleDeleteDevice = async (tId: string, dId: string) => {
    if (!token || !window.confirm(`Revoke and delete device ${dId} from AWS IoT Core & DynamoDB?`)) return;
    setDeviceDeleteSuccess(null);
    setDeviceDeleteError(null);

    try {
      const res = await fetch(`${API_BASE}/api/superadmin/tenants/${tId}/devices/${dId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete device.');
      setDeviceDeleteSuccess(`Device ${dId} has been revoked and removed.`);
      fetchTenantDevices(tId);
    } catch (err: any) {
      setDeviceDeleteError(err.message);
    }
  };

  // Onboard New Tenant
  const handleOnboardTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !superadminCompanyName || !superadminTenantId || !superadminEmail || !superadminPassword) return;
    setOnboardError(null);
    setOnboardSuccess(null);

    try {
      const res = await fetch(`${API_BASE}/api/superadmin/tenants/onboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          companyName: superadminCompanyName,
          tenantId: superadminTenantId,
          email: superadminEmail,
          password: superadminPassword
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Onboarding failed.');
      setOnboardSuccess(`Tenant ${superadminCompanyName} (${superadminTenantId}) onboarded successfully!`);
      setSuperadminCompanyName('');
      setSuperadminTenantId('');
      setSuperadminEmail('');
      setSuperadminPassword('');
      fetchTenants();
    } catch (err: any) {
      setOnboardError(err.message);
    }
  };

  // Handle Login / Signup
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    const endpoint = isLogin ? `${API_BASE}/api/superadmin/login` : `${API_BASE}/api/superadmin/signup`;
    const payload = isLogin ? { email, password } : { email, password, secretKey };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed');

      if (isLogin) {
        localStorage.setItem('superadmin_token', data.token);
        setToken(data.token);
        setSuperadmin(data.superadmin);
      } else {
        setAuthSuccess('SuperAdmin registered! Please log in.');
        setIsLogin(true);
      }
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  // Helper: Download credential files
  const downloadCredentialFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Auth Screen if unauthenticated
  if (!token) {
    return (
      <div className="min-h-screen bg-[#070b14] text-slate-100 flex items-center justify-center p-6 relative overflow-hidden font-sans">
        {/* Glowing background elements */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none animate-pulse"></div>

        <div className="w-full max-w-md bg-[#0f172a]/90 backdrop-blur-xl border border-indigo-500/20 rounded-2xl shadow-2xl p-8 relative z-10">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/25 mb-4">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-xl font-bold orbitron tracking-wider text-white uppercase">Coreboard SuperAdmin</h1>
            <p className="text-xs font-mono text-slate-400 mt-1">Multi-Tenant IoT Provisioning & Operations Portal</p>
          </div>

          {authError && (
            <div className="bg-rose-950/50 border border-rose-500/30 text-rose-300 p-3.5 rounded-xl text-xs font-mono mb-6 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{authError}</span>
            </div>
          )}

          {authSuccess && (
            <div className="bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 p-3.5 rounded-xl text-xs font-mono mb-6 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{authSuccess}</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5 font-bold">Admin Email</label>
              <div className="relative">
                <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  required
                  placeholder="superadmin@coreboard.io"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#090d16] border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5 font-bold">Secret Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#090d16] border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            {!isLogin && (
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5 font-bold">SuperAdmin Secret Key</label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    placeholder="Enter system secret key"
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    className="w-full bg-[#090d16] border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold text-xs font-mono uppercase tracking-wider shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 mt-6"
            >
              <span>{isLogin ? 'Authenticate SuperAdmin' : 'Register SuperAdmin'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 text-center border-t border-slate-800/80 pt-4">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setAuthError(null);
                setAuthSuccess(null);
              }}
              className="text-xs font-mono text-slate-400 hover:text-cyan-400 transition-all"
            >
              {isLogin ? "Need a new SuperAdmin account? Register" : "Already registered? Sign In"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard Layout
  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex font-sans overflow-x-hidden">
      
      {/* 1. Futuristic Left Glassmorphic Sidebar */}
      <aside 
        className={`fixed top-0 left-0 bottom-0 z-40 bg-[#090e1a]/95 backdrop-blur-xl border-r border-slate-800/80 transition-all duration-300 flex flex-col justify-between ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        <div>
          {/* Brand Header */}
          <div className="h-16 px-5 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-400 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              {sidebarOpen && (
                <div className="flex flex-col truncate">
                  <span className="text-sm font-bold orbitron text-white tracking-wider uppercase">COREBOARD</span>
                  <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-widest font-bold">SUPERADMIN</span>
                </div>
              )}
            </div>
            
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>

          {/* System Health Status Badge */}
          {sidebarOpen && (
            <div className="mx-4 my-4 p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 font-mono text-[10px] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 uppercase tracking-wider">AWS IoT Core</span>
                <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Active
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 uppercase tracking-wider">DynamoDB Table</span>
                <span className="text-cyan-400 font-bold">Single-Table</span>
              </div>
            </div>
          )}

          {/* Sidebar Menu Items */}
          <nav className="px-3 py-2 space-y-1.5 font-mono text-xs">
            <button
              onClick={() => setActiveTab('pending_requests')}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all relative ${
                activeTab === 'pending_requests'
                  ? 'bg-gradient-to-r from-indigo-600/30 to-cyan-500/10 border border-indigo-500/50 text-white font-bold shadow-lg shadow-indigo-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Clock className={`w-4 h-4 shrink-0 ${activeTab === 'pending_requests' ? 'text-cyan-400' : ''}`} />
              {sidebarOpen && (
                <div className="flex items-center justify-between w-full">
                  <span className="truncate">Pending Requests</span>
                  {pendingRequests.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold">
                      {pendingRequests.length}
                    </span>
                  )}
                </div>
              )}
            </button>

            <button
              onClick={() => setActiveTab('tenant_manager')}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all relative ${
                activeTab === 'tenant_manager'
                  ? 'bg-gradient-to-r from-indigo-600/30 to-cyan-500/10 border border-indigo-500/50 text-white font-bold shadow-lg shadow-indigo-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Building2 className={`w-4 h-4 shrink-0 ${activeTab === 'tenant_manager' ? 'text-cyan-400' : ''}`} />
              {sidebarOpen && <span className="truncate">Tenant Onboarding</span>}
            </button>

            <button
              onClick={() => setActiveTab('direct_provision')}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all relative ${
                activeTab === 'direct_provision'
                  ? 'bg-gradient-to-r from-indigo-600/30 to-cyan-500/10 border border-indigo-500/50 text-white font-bold shadow-lg shadow-indigo-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <PlusCircle className={`w-4 h-4 shrink-0 ${activeTab === 'direct_provision' ? 'text-cyan-400' : ''}`} />
              {sidebarOpen && <span className="truncate">Direct Device Provisioning</span>}
            </button>

            <button
              onClick={() => setActiveTab('tenant_profiles')}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all relative ${
                activeTab === 'tenant_profiles'
                  ? 'bg-gradient-to-r from-indigo-600/30 to-cyan-500/10 border border-indigo-500/50 text-white font-bold shadow-lg shadow-indigo-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Cpu className={`w-4 h-4 shrink-0 ${activeTab === 'tenant_profiles' ? 'text-cyan-400' : ''}`} />
              {sidebarOpen && <span className="truncate">Tenant Devices & Keys</span>}
            </button>
          </nav>
        </div>

        {/* User Profile & Logout Bottom Bar */}
        <div className="p-4 border-t border-slate-800/80 font-mono">
          {sidebarOpen ? (
            <div className="flex items-center justify-between bg-slate-900/80 p-3 rounded-xl border border-slate-800/80">
              <div className="flex items-center gap-2.5 truncate">
                <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0">
                  SA
                </div>
                <div className="flex flex-col truncate">
                  <span className="text-xs font-bold text-slate-200 truncate">SuperAdmin</span>
                  <span className="text-[9px] text-slate-500 truncate">{superadmin?.email || 'superadmin@coreboard.io'}</span>
                </div>
              </div>

              <button
                onClick={handleLogout}
                title="Sign Out"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-all shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              className="w-full p-3 rounded-xl bg-slate-900 hover:bg-rose-950/30 text-slate-400 hover:text-rose-400 transition-all flex items-center justify-center"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content View Container */}
      <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'} flex flex-col min-h-screen`}>
        
        {/* Top Header Command Bar */}
        <header className="h-16 bg-[#090e1a]/80 backdrop-blur-xl border-b border-slate-800/80 px-8 flex items-center justify-between sticky top-0 z-30 font-mono">
          <div className="flex items-center gap-3">
            <h1 className="text-xs font-bold orbitron text-white uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              {activeTab === 'pending_requests' && 'Provisioning Request Queue'}
              {activeTab === 'tenant_manager' && 'Tenant Onboarding & Manager'}
              {activeTab === 'direct_provision' && 'Direct Device Provisioning'}
              {activeTab === 'tenant_profiles' && 'Tenant Profiles & Key Registry'}
            </h1>
          </div>

          <div className="flex items-center gap-6 text-xs">
            {/* Quick Metrics */}
            <div className="hidden md:flex items-center gap-4 border-r border-slate-800 pr-6">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 uppercase text-[10px]">Tenants:</span>
                <span className="text-cyan-400 font-bold">{tenants.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 uppercase text-[10px]">Queue:</span>
                <span className="text-amber-400 font-bold">{pendingRequests.length}</span>
              </div>
            </div>

            <button
              onClick={() => {
                fetchPendingRequests();
                fetchTenants();
              }}
              className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1.5 transition-all text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Data
            </button>
          </div>
        </header>

        {/* Main Body */}
        <main className="flex-1 p-8 space-y-6">
          
          {/* TAB 1: PENDING PROVISIONING REQUESTS */}
          {activeTab === 'pending_requests' && (
            <div className="space-y-6">
              
              {/* Credentials Download Panel (when approved) */}
              {credentials && (
                <div className="bg-gradient-to-r from-[#0d1c2b] to-[#0f172a] border border-cyan-500/40 rounded-2xl p-6 shadow-2xl animate-[fadeIn_0.3s_ease-out] font-mono">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-cyan-400 flex items-center gap-2 uppercase tracking-wide">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                      AWS X.509 Cryptographic Credentials Generated
                    </h3>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                      Provisioned in AWS IoT Core
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">
                    Cryptographic credentials package established. Download all 3 authentication files below to flash onto the physical hardware controller or Python simulator client.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                      onClick={() => downloadCredentialFile(credentials.certificatePem, `device_certificate.crt`)}
                      className="bg-[#0b1626] border border-cyan-500/30 hover:border-cyan-400 text-cyan-400 hover:bg-[#102438] font-bold p-3.5 rounded-xl flex items-center justify-between transition-all group"
                    >
                      <span className="flex items-center gap-2">
                        <Download className="h-4 w-4 group-hover:scale-110 transition-transform" /> Device Certificate
                      </span>
                      <span className="text-[9px] text-slate-500 font-normal">.crt</span>
                    </button>

                    <button
                      onClick={() => downloadCredentialFile(credentials.privateKeyPem, `private_key.key`)}
                      className="bg-[#0b1626] border border-cyan-500/30 hover:border-cyan-400 text-cyan-400 hover:bg-[#102438] font-bold p-3.5 rounded-xl flex items-center justify-between transition-all group"
                    >
                      <span className="flex items-center gap-2">
                        <Download className="h-4 w-4 group-hover:scale-110 transition-transform" /> Private Key
                      </span>
                      <span className="text-[9px] text-slate-500 font-normal">.key</span>
                    </button>

                    {credentials.rootCaPem && (
                      <button
                        onClick={() => downloadCredentialFile(credentials.rootCaPem!, `AmazonRootCA1.pem`)}
                        className="bg-[#0b1626] border border-cyan-500/30 hover:border-cyan-400 text-cyan-400 hover:bg-[#102438] font-bold p-3.5 rounded-xl flex items-center justify-between transition-all group"
                      >
                        <span className="flex items-center gap-2">
                          <Download className="h-4 w-4 group-hover:scale-110 transition-transform" /> Root CA Cert
                        </span>
                        <span className="text-[9px] text-slate-500 font-normal">.pem</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left: Queue Table */}
                <div className="lg:col-span-7 bg-[#0f172a]/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl">
                  <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800/80 font-mono">
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-200">Pending Authorization Requests</h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">Device registration setup queue submitted by Tenant Administrators.</p>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-cyan-400 font-bold text-xs">
                      {pendingRequests.length} Pending
                    </span>
                  </div>

                  {loadingRequests ? (
                    <div className="p-12 text-center text-slate-500 font-mono text-xs">
                      Querying pending requests queue...
                    </div>
                  ) : pendingRequests.length === 0 ? (
                    <div className="border border-dashed border-slate-800/80 rounded-xl p-12 text-center text-slate-600 font-mono text-xs">
                      No pending device setup requests in queue.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left font-mono text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-500 uppercase text-[10px] tracking-wider pb-3">
                            <th className="pb-3 font-bold">Tenant Domain</th>
                            <th className="pb-3 font-bold">Thing Name</th>
                            <th className="pb-3 font-bold">Hardware Profile</th>
                            <th className="pb-3 font-bold text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {pendingRequests.map((req, idx) => (
                            <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                              <td className="py-4 font-bold text-slate-200">{req.tenantId}</td>
                              <td className="py-4 text-cyan-400 font-bold">{req.deviceId}</td>
                              <td className="py-4 text-slate-400 uppercase text-[10px]">{req.deviceType}</td>
                              <td className="py-4 text-right">
                                <button
                                  onClick={() => handleApprove(req)}
                                  disabled={isProvisioning}
                                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 inline-flex items-center gap-1.5"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  Approve & Provision
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Right: AWS SDK Logs Console */}
                <div className="lg:col-span-5 bg-[#0a0f1d] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col h-[480px] font-mono">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
                    <Terminal className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-xs font-bold orbitron text-white uppercase tracking-wider">AWS Provisioning Execution Console</h3>
                  </div>
                  <div className="flex-1 bg-black/80 rounded-xl p-4 text-[10px] overflow-y-auto border border-slate-900 space-y-2">
                    {provLogs.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-slate-600 italic">
                        &gt;&gt; CONSOLE READY. SELECT A PENDING DEVICE REQUEST TO APPROVE &lt;&lt;
                      </div>
                    ) : (
                      provLogs.map((log, idx) => {
                        let color = 'text-slate-400';
                        if (log.includes('[ERROR]')) color = 'text-rose-400 font-bold';
                        if (log.includes('[SUCCESS]')) color = 'text-emerald-400 font-bold';
                        if (log.includes('[AWS')) color = 'text-cyan-400';
                        return <div key={idx} className={`${color} border-l border-slate-800 pl-2`}>{log}</div>;
                      })
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: TENANT ONBOARDING & MANAGER */}
          {activeTab === 'tenant_manager' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-mono text-xs">
              
              {/* Left: Onboard Tenant Form */}
              <div className="lg:col-span-5 bg-[#0f172a]/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800/80">
                  <div className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold orbitron text-white uppercase tracking-wide">Onboard New Tenant Client</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Create isolated tenant partition & Tenant Admin credentials.</p>
                  </div>
                </div>

                {onboardError && (
                  <div className="bg-rose-950/50 border border-rose-500/30 text-rose-300 p-3.5 rounded-xl mb-4 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{onboardError}</span>
                  </div>
                )}

                {onboardSuccess && (
                  <div className="bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 p-3.5 rounded-xl mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>{onboardSuccess}</span>
                  </div>
                )}

                <form onSubmit={handleOnboardTenant} className="space-y-4">
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-bold uppercase tracking-wide">Company Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Acme Industrial Corp"
                      value={superadminCompanyName}
                      onChange={(e) => setSuperadminCompanyName(e.target.value)}
                      className="w-full bg-[#090d16] border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1.5 font-bold uppercase tracking-wide">Tenant Domain ID (Partition Key)</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. acme-industrial"
                      value={superadminTenantId}
                      onChange={(e) => setSuperadminTenantId(e.target.value)}
                      className="w-full bg-[#090d16] border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1.5 font-bold uppercase tracking-wide">Tenant Admin Email</label>
                    <input
                      type="email"
                      required
                      placeholder="admin@acme.com"
                      value={superadminEmail}
                      onChange={(e) => setSuperadminEmail(e.target.value)}
                      className="w-full bg-[#090d16] border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1.5 font-bold uppercase tracking-wide">Initial Admin Password</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••••••"
                      value={superadminPassword}
                      onChange={(e) => setSuperadminPassword(e.target.value)}
                      className="w-full bg-[#090d16] border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold uppercase tracking-wider shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 mt-4"
                  >
                    <Building2 className="w-4 h-4" />
                    Onboard Tenant Account
                  </button>
                </form>
              </div>

              {/* Right: Active Tenants List */}
              <div className="lg:col-span-7 bg-[#0f172a]/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800/80">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-200">Registered Tenant Accounts</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Active multi-tenant partitions provisioned in DynamoDB.</p>
                  </div>
                  <button
                    onClick={fetchTenants}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-cyan-400 font-bold text-xs flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh List
                  </button>
                </div>

                {loadingTenants ? (
                  <div className="p-12 text-center text-slate-500 font-mono text-xs">
                    Fetching tenant list...
                  </div>
                ) : tenants.length === 0 ? (
                  <div className="border border-dashed border-slate-800/80 rounded-xl p-12 text-center text-slate-600 font-mono text-xs">
                    No active tenants onboarded yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tenants.map(t => (
                      <div key={t.tenantId} className="bg-[#090e1a] border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-white uppercase tracking-wider">{t.companyName}</span>
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-bold border border-emerald-500/30">
                              ACTIVE
                            </span>
                          </div>
                          <p className="text-[10px] text-cyan-400 font-mono mb-1">Partition: TENANT#{t.tenantId}</p>
                          <p className="text-[10px] text-slate-500 font-mono">Admin: {t.adminEmail}</p>
                        </div>

                        <button
                          onClick={() => {
                            setActiveTab('tenant_profiles');
                            fetchTenantDevices(t.tenantId);
                          }}
                          className="mt-4 w-full py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-colors"
                        >
                          Inspect Registered Devices <ChevronRight className="w-3.5 h-3.5 text-cyan-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 3: DIRECT DEVICE PROVISIONING */}
          {activeTab === 'direct_provision' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-mono text-xs">
              
              {/* Left: Provisioning Controls & Credentials Download */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                
                <div className="bg-[#0f172a]/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl">
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800/80">
                    <div className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
                      <PlusCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold orbitron text-white uppercase tracking-wide">Direct Device Provisioning</h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">Provision X.509 certificates & Thing slots directly.</p>
                    </div>
                  </div>

                  {directError && (
                    <div className="bg-rose-950/50 border border-rose-500/30 text-rose-300 p-3.5 rounded-xl mb-4 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>{directError}</span>
                    </div>
                  )}

                  {directSuccess && (
                    <div className="bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 p-3.5 rounded-xl mb-4 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                      <span>{directSuccess}</span>
                    </div>
                  )}

                  <form onSubmit={handleDirectProvision} className="space-y-4">
                    <div>
                      <label className="block text-slate-400 mb-1.5 font-bold uppercase tracking-wide">Target Tenant Partition</label>
                      {loadingTenants ? (
                        <div className="text-slate-500 text-xs">Loading tenants list...</div>
                      ) : tenants.length === 0 ? (
                        <div className="text-rose-400 text-xs">No onboarded tenants available. Please onboard a tenant first.</div>
                      ) : (
                        <select
                          value={selectedTenantId}
                          onChange={(e) => setSelectedTenantId(e.target.value)}
                          className="w-full bg-[#090d16] border border-slate-800 rounded-xl p-3.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-semibold"
                        >
                          {tenants.map(t => (
                            <option key={t.tenantId} value={t.tenantId}>
                              {t.companyName} ({t.tenantId})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1.5 font-bold uppercase tracking-wide">Unique Device ID / Thing Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. SMART-LOCK-101"
                        value={directDeviceId}
                        onChange={(e) => setDirectDeviceId(e.target.value)}
                        className="w-full bg-[#090d16] border border-slate-800 rounded-xl p-3.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1.5 font-bold uppercase tracking-wide">Device Profile Type (Free-Text / Custom)</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Locking System, Solar Inverter, Pump..."
                        value={directDeviceType}
                        onChange={(e) => setDirectDeviceType(e.target.value)}
                        className="w-full bg-[#090d16] border border-slate-800 rounded-xl p-3.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-semibold mb-2"
                      />
                      <div className="flex flex-wrap gap-1.5 font-mono text-[9px]">
                        <span className="text-slate-500 self-center">Presets:</span>
                        {['pump', 'temp_sensor', 'pressure_sensor', 'power_meter', 'smart_lock', 'solar_inverter'].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setDirectDeviceType(preset)}
                            className={`px-2 py-0.5 rounded border transition-all ${
                              directDeviceType === preset
                                ? 'bg-indigo-600 border-indigo-400 text-white font-bold'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isProvisioning || tenants.length === 0}
                      className="w-full py-3.5 rounded-xl font-bold uppercase tracking-wider mt-4 bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Database className="h-4 w-4" />
                      Directly Provision Device
                    </button>
                  </form>
                </div>

                {/* Download Credentials Panel */}
                {credentials && (
                  <div className="bg-[#0b1626] border border-cyan-500/30 rounded-2xl p-5 shadow-xl animate-[fadeIn_0.5s_ease-out]">
                    <h3 className="text-xs font-bold text-cyan-400 mb-2 flex items-center gap-2 uppercase tracking-wide">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                      mTLS Credentials Established
                    </h3>
                    <p className="text-[10px] text-slate-400 leading-relaxed mb-4">
                      Cryptographic certificates established in AWS IoT Core registry. Download files to flash onto ESP32 simulator client.
                    </p>

                    <div className="flex flex-col gap-2 font-mono text-xs">
                      <button
                        onClick={() => downloadCredentialFile(credentials.certificatePem, `device_certificate.crt`)}
                        className="w-full bg-[#102431] border border-cyan-500/30 text-cyan-400 hover:bg-[#122e3e] font-bold p-3 rounded-xl flex items-center justify-between transition-all"
                      >
                        <span className="flex items-center gap-1.5">
                          <Download className="h-4 w-4" /> Download Certificate
                        </span>
                        <span className="text-[9px] text-slate-500 font-normal">device.pem.crt</span>
                      </button>

                      <button
                        onClick={() => downloadCredentialFile(credentials.privateKeyPem, `private_key.key`)}
                        className="w-full bg-[#102431] border border-cyan-500/30 text-cyan-400 hover:bg-[#122e3e] font-bold p-3 rounded-xl flex items-center justify-between transition-all"
                      >
                        <span className="flex items-center gap-1.5">
                          <Download className="h-4 w-4" /> Download Private Key
                        </span>
                        <span className="text-[9px] text-slate-500 font-normal">private.pem.key</span>
                      </button>

                      {credentials.rootCaPem && (
                        <button
                          onClick={() => downloadCredentialFile(credentials.rootCaPem!, `AmazonRootCA1.pem`)}
                          className="w-full bg-[#102431] border border-cyan-500/30 text-cyan-400 hover:bg-[#122e3e] font-bold p-3 rounded-xl flex items-center justify-between transition-all"
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

              {/* Right: AWS SDK Execution Logs */}
              <div className="lg:col-span-7 bg-[#0a0f1d] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col h-[520px] font-mono">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-bold orbitron text-white uppercase tracking-wider">AWS SDK Ingestion Execution Terminal</h3>
                </div>
                <div className="flex-1 bg-black/80 rounded-xl p-4 text-[10px] overflow-y-auto border border-slate-900 space-y-2">
                  {provLogs.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-600 italic">
                      &gt;&gt; CONSOLE READY. SUBMIT PROVISIONING FORM &lt;&lt;
                    </div>
                  ) : (
                    provLogs.map((log, idx) => {
                      let color = 'text-slate-400';
                      if (log.includes('[ERROR]')) color = 'text-rose-400 font-bold';
                      if (log.includes('[SUCCESS]')) color = 'text-emerald-400 font-bold';
                      if (log.includes('[AWS')) color = 'text-cyan-400';
                      return <div key={idx} className={`${color} border-l border-slate-800 pl-2`}>{log}</div>;
                    })
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: TENANT PROFILES & DEVICE REGISTRY */}
          {activeTab === 'tenant_profiles' && (
            <div className="space-y-6 font-mono text-xs">
              
              <div className="bg-[#0f172a]/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl">
                <div className="flex flex-wrap gap-4 items-center justify-between mb-6 pb-4 border-b border-slate-800/80">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-200">Tenant Devices Registry & Credentials Manager</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Inspect registered devices, reset mTLS credentials, or revoke device access.</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="text-slate-400 text-xs font-bold uppercase">Select Tenant:</label>
                    <select
                      value={selectedProfileTenantId}
                      onChange={(e) => fetchTenantDevices(e.target.value)}
                      className="bg-[#090d16] border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-bold"
                    >
                      <option value="">-- Choose Tenant Domain --</option>
                      {tenants.map(t => (
                        <option key={t.tenantId} value={t.tenantId}>
                          {t.companyName} ({t.tenantId})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {deviceResetSuccess && (
                  <div className="bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 p-3.5 rounded-xl mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>{deviceResetSuccess}</span>
                  </div>
                )}

                {deviceResetError && (
                  <div className="bg-rose-950/50 border border-rose-500/30 text-rose-300 p-3.5 rounded-xl mb-4 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{deviceResetError}</span>
                  </div>
                )}

                {deviceDeleteSuccess && (
                  <div className="bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 p-3.5 rounded-xl mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>{deviceDeleteSuccess}</span>
                  </div>
                )}

                {deviceDeleteError && (
                  <div className="bg-rose-950/50 border border-rose-500/30 text-rose-300 p-3.5 rounded-xl mb-4 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{deviceDeleteError}</span>
                  </div>
                )}

                {!selectedProfileTenantId ? (
                  <div className="border border-dashed border-slate-800/80 rounded-xl p-12 text-center text-slate-600 text-xs italic">
                    Select a Tenant Domain above to inspect registered devices and manage credentials.
                  </div>
                ) : loadingTenantDevices ? (
                  <div className="p-12 text-center text-slate-500 text-xs">
                    Querying DynamoDB for registered things under TENANT#{selectedProfileTenantId}...
                  </div>
                ) : tenantDevices.length === 0 ? (
                  <div className="border border-dashed border-slate-800/80 rounded-xl p-12 text-center text-slate-600 text-xs">
                    No registered devices found for tenant <strong className="text-slate-400">{selectedProfileTenantId}</strong>.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-500 uppercase text-[10px] tracking-wider pb-3">
                          <th className="pb-3 font-bold">Device ID / Thing Name</th>
                          <th className="pb-3 font-bold">Hardware Classification</th>
                          <th className="pb-3 font-bold">Provisioned Date</th>
                          <th className="pb-3 font-bold text-right">Administrative Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {tenantDevices.map(d => {
                          const devId = d.actual_device_id || d.device_id || d.id || 'N/A';
                          return (
                            <tr key={devId} className="hover:bg-slate-900/40 transition-colors">
                              <td className="py-4 font-bold text-cyan-400">{devId}</td>
                              <td className="py-4 text-slate-400 uppercase text-[10px]">{d.device_type}</td>
                              <td className="py-4 text-slate-500">{new Date(d.created_at || Date.now()).toLocaleDateString()}</td>
                              <td className="py-4 text-right flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleRegenerateCredentials(selectedProfileTenantId, devId)}
                                  className="px-3 py-1.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-300 font-bold text-[10px] uppercase flex items-center gap-1 transition-all"
                                >
                                  <RefreshCw className="w-3 h-3" /> Reset Credentials
                                </button>
                                <button
                                  onClick={() => handleDeleteDevice(selectedProfileTenantId, devId)}
                                  className="px-3 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-300 font-bold text-[10px] uppercase flex items-center gap-1 transition-all"
                                >
                                  <Trash2 className="w-3 h-3" /> Revoke Device
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Regenerated Credentials Download Box */}
                {resetCredentialsData && (
                  <div className="mt-6 bg-[#0b1626] border border-cyan-500/40 rounded-2xl p-6 shadow-xl animate-[fadeIn_0.3s_ease-out]">
                    <h3 className="text-xs font-bold text-cyan-400 mb-2 uppercase tracking-wide flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                      Regenerated Credentials Ready
                    </h3>
                    <p className="text-xs text-slate-400 mb-4">
                      New X.509 certificates and keys issued for device. Download the package below:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <button
                        onClick={() => downloadCredentialFile(resetCredentialsData.certificatePem, `device_certificate.crt`)}
                        className="bg-[#102431] border border-cyan-500/30 text-cyan-400 hover:bg-[#122e3e] font-bold p-3 rounded-xl flex items-center justify-between transition-all"
                      >
                        <span className="flex items-center gap-1.5"><Download className="h-4 w-4" /> Download Certificate</span>
                        <span className="text-[9px] text-slate-500 font-normal">.crt</span>
                      </button>

                      <button
                        onClick={() => downloadCredentialFile(resetCredentialsData.privateKeyPem, `private_key.key`)}
                        className="bg-[#102431] border border-cyan-500/30 text-cyan-400 hover:bg-[#122e3e] font-bold p-3 rounded-xl flex items-center justify-between transition-all"
                      >
                        <span className="flex items-center gap-1.5"><Download className="h-4 w-4" /> Download Private Key</span>
                        <span className="text-[9px] text-slate-500 font-normal">.key</span>
                      </button>

                      {resetCredentialsData.rootCaPem && (
                        <button
                          onClick={() => downloadCredentialFile(resetCredentialsData.rootCaPem!, `AmazonRootCA1.pem`)}
                          className="bg-[#102431] border border-cyan-500/30 text-cyan-400 hover:bg-[#122e3e] font-bold p-3 rounded-xl flex items-center justify-between transition-all"
                        >
                          <span className="flex items-center gap-1.5"><Download className="h-4 w-4" /> Download Root CA</span>
                          <span className="text-[9px] text-slate-500 font-normal">.pem</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

        </main>
      </div>
    </div>
  );
}
