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
  PlusCircle,
  Copy,
  Check,
  Search,
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

const DEFAULT_AMAZON_ROOT_CA_PEM = `-----BEGIN CERTIFICATE-----
MIIDQTCCAimgAwIBAgITBmyfz5m/jAo54vB4ikPmljZbyjANBgkqhkiG9w0BAQsF
ADA5MQswCQYDVQQGEwJVUzEPMA0GA1UEChMGQW1hem9uMRkwFwYDVQQDExBBbWF6
b24gUm9vdCBDQSAxMB4XDTE1MDUyNjAwMDAwMFoXDTM4MDExNzAwMDAwMFowOTEL
MAkGA1UEBhMCVVMxDzANBgNVBAoTBkFtYXpvbjEZMBcGA1UEAxMQQW1hem9uIFJv
b3QgQ0EgMTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALJ4gHHKeNXj
ca9HgFB0fW7Y14h29Jlo91ghYPl0hAEvrAIthtOgQ3pOsqTQNroBvo3bSMgHFzZM
9O6II8c+6zf1tRn4SWiw3te5djgdYZ6k/oI2peVKVuRF4fn9tBb6dNqcmzU5L/qw
IFAGbHrQgLKm+a/sRxmPUDgH3KKHOVj4utWp+UhnMJbulHheb4mjUcAwhmahRWa6
VOujw5H5SNz/0egwLX0tdHA114gk957EWW67c4cX8jJGKLhD+rcdqsq08p8kDi1L
93FcXmn/6pUCyziKrlA4b9v7LWIbxcceVOF34GfID5yHI9Y/QCB/IIDEgEw+OyQm
jgSubJrIqg0CAwEAAaNCMEAwDwYDVR0TAQH/BAUwAwEB/zAOBgNVHQ8BAf8EBAMC
AYYwHQYDVR0OBBYEFIQYzIU07LwMlJQuCFmcx7IQTgoIMA0GCSqGSIb3DQEBCwUA
A4IBAQCY8jdaQZChGsV2USggNiMOruYou6r4lK5IpDB/G/wkjUu0yKGX9rbxenDI
U5PMCCjjmCXPI6T53iHTfIUJrU6adTrCC2qJeHZERxhlbI1Bjjt/msv0tadQ1wUs
N+gDS63pYaACbvXy8MWy7Vu33PqUXHeeE6V/Uq2V8viTO96LXFvKWlJbYK8U90vv
o/ufQJVtMVT8QtPHRh8jrdkPSHCa2XV4cdFyQzR1bldZwgJcJmApzyMZFo6IQ6XU
5MsI+yMRQ+hDKXJioaldXgjUkK642M4UwtBV8ob2xJNDd2ZhwLnoQdeXeGADbkpy
rqXRfboQnoZsG4q5WTP468SQvvG5
-----END CERTIFICATE-----`;

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

  // Copy feedback state
  const [copiedDomain, setCopiedDomain] = useState<string | null>(null);

  const handleCopyDomain = (domainId: string) => {
    if (!domainId) return;
    navigator.clipboard.writeText(domainId);
    setCopiedDomain(domainId);
    setTimeout(() => setCopiedDomain(null), 2000);
  };

  // Direct Provisioning & Tenants List State
  const [tenants, setTenants] = useState<{ tenantId: string; companyName: string; adminEmail: string }[]>([]);
  const [tenantSearchQuery, setTenantSearchQuery] = useState('');
  const [expandedTenantId, setExpandedTenantId] = useState<string | null>(null);
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
  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(false);
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
      console.log(`[Superadmin] Onboarded new tenant: ${superadminCompanyName} (${superadminTenantId})`);
      fetchTenants();
    } catch (err: any) {
      setOnboardError(err.message);
    }
  };

  // Permanently Delete Tenant
  const handleDeleteTenant = async (tId: string, companyName: string) => {
    if (!token) return;
    if (!window.confirm(`⚠️ PERMANENT DELETION WARNING!\n\nAre you sure you want to permanently delete tenant "${companyName}" (${tId})?\n\nThis will permanently erase all associated DynamoDB partition records (metadata, users, telemetry, alarms) and clean up AWS IoT Core Things & Certificates.\n\nThis action CANNOT be undone. Proceed?`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/superadmin/tenants/${tId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete tenant.');

      setOnboardSuccess(`Tenant "${companyName}" (${tId}) has been permanently deleted.`);
      if (selectedTenantId === tId) {
        setSelectedTenantId('');
      }
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
      <div className="min-h-screen bg-slate-100 text-slate-900 flex items-center justify-center p-6 relative overflow-hidden font-sans">
        {/* Soft background accents */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-8 relative z-10">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center shadow-md shadow-indigo-500/20 mb-4">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 uppercase">Coreboard SuperAdmin</h1>
            <p className="text-xs font-mono text-slate-500 mt-1">Multi-Tenant IoT Provisioning & Operations Portal</p>
          </div>

          {authError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl text-xs font-mono mb-6 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{authError}</span>
            </div>
          )}

          {authSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl text-xs font-mono mb-6 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{authSuccess}</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-600 mb-1.5 font-bold">Admin Email</label>
              <div className="relative">
                <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="superadmin@coreboard.io"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl py-3 pl-10 pr-4 text-xs font-mono text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-600 mb-1.5 font-bold">Secret Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl py-3 pl-10 pr-4 text-xs font-mono text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all font-semibold"
                />
              </div>
            </div>

            {!isLogin && (
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-600 mb-1.5 font-bold">SuperAdmin Secret Key</label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    placeholder="Enter system secret key"
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl py-3 pl-10 pr-4 text-xs font-mono text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all font-semibold"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs font-mono uppercase tracking-wider shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 mt-6"
            >
              <span>{isLogin ? 'Authenticate SuperAdmin' : 'Register SuperAdmin'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 text-center border-t border-slate-200 pt-4">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setAuthError(null);
                setAuthSuccess(null);
              }}
              className="text-xs font-mono text-slate-600 hover:text-indigo-600 font-semibold transition-all"
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
    <div className="min-h-screen bg-[#F2EFE7] text-slate-900 flex font-sans overflow-x-hidden">
      
      {/* 1. Left Sidebar */}
      <aside 
        className={`fixed top-0 left-0 bottom-0 z-40 bg-white border-r border-[#C8DFDB] transition-all duration-300 flex flex-col justify-between shadow-sm ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        <div>
          {/* Brand Header */}
          <div className="h-16 px-5 border-b border-[#C8DFDB] flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-[#3368A0] flex items-center justify-center shrink-0 shadow-md shadow-[#3368A0]/20">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              {sidebarOpen && (
                <div className="flex flex-col truncate">
                  <span className="text-sm font-bold text-slate-900 tracking-wide uppercase">COREBOARD</span>
                  <span className="text-[9px] font-mono text-[#3368A0] uppercase tracking-widest font-bold">SUPERADMIN</span>
                </div>
              )}
            </div>
            
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-[#C8DFDB]/30 transition-all"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>

          {/* System Health Status Badge */}
          {sidebarOpen && (
            <div className="mx-4 my-4 p-3.5 rounded-xl bg-white border border-[#C8DFDB] font-sans text-xs space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 uppercase tracking-wider font-bold text-[11px]">AWS IoT Core</span>
                <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 uppercase tracking-wider font-bold text-[11px]">DynamoDB Table</span>
                <span className="text-[#3368A0] font-bold text-xs">Single-Table</span>
              </div>

              {/* SuperAdmin Global Tenant Domain Quick Copy */}
              {selectedTenantId && (
                <div className="space-y-1 pt-1 border-t border-[#C8DFDB]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 uppercase tracking-wider font-bold text-[11px]">Active Partition</span>
                    {copiedDomain === selectedTenantId && (
                      <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Copied!
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleCopyDomain(selectedTenantId)}
                    title="Click to copy selected Tenant Domain ID"
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[#F2EFE7]/80 hover:bg-[#C8DFDB]/40 border border-[#C8DFDB] text-[#3368A0] transition-all group text-left cursor-pointer"
                  >
                    <span className="font-mono text-xs font-bold break-all">{selectedTenantId}</span>
                    {copiedDomain === selectedTenantId ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-[#66A3BF] group-hover:text-[#3368A0] shrink-0" />
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Sidebar Menu Items */}
          <nav className="px-3 py-2 space-y-2 font-sans text-sm font-semibold">
            <button
              onClick={() => setActiveTab('pending_requests')}
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl transition-all relative ${
                activeTab === 'pending_requests'
                  ? 'bg-[#C8DFDB]/60 border border-[#3368A0]/30 text-[#3368A0] font-bold shadow-xs'
                  : 'text-slate-800 hover:text-slate-900 hover:bg-[#C8DFDB]/25 font-semibold'
              }`}
            >
              <Clock className={`w-5 h-5 shrink-0 ${activeTab === 'pending_requests' ? 'text-[#3368A0]' : 'text-slate-600'}`} />
              {sidebarOpen && (
                <div className="flex items-center justify-between w-full">
                  <span className="truncate">Pending Requests</span>
                  {pendingRequests.length > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 text-xs font-bold shrink-0">
                      {pendingRequests.length}
                    </span>
                  )}
                </div>
              )}
            </button>

            <button
              onClick={() => setActiveTab('tenant_manager')}
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl transition-all relative ${
                activeTab === 'tenant_manager'
                  ? 'bg-[#C8DFDB]/60 border border-[#3368A0]/30 text-[#3368A0] font-bold shadow-xs'
                  : 'text-slate-800 hover:text-slate-900 hover:bg-[#C8DFDB]/25 font-semibold'
              }`}
            >
              <Building2 className={`w-5 h-5 shrink-0 ${activeTab === 'tenant_manager' ? 'text-[#3368A0]' : 'text-slate-600'}`} />
              {sidebarOpen && <span className="truncate">Tenant Onboarding</span>}
            </button>

            <button
              onClick={() => setActiveTab('direct_provision')}
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl transition-all relative ${
                activeTab === 'direct_provision'
                  ? 'bg-[#C8DFDB]/60 border border-[#3368A0]/30 text-[#3368A0] font-bold shadow-xs'
                  : 'text-slate-800 hover:text-slate-900 hover:bg-[#C8DFDB]/25 font-semibold'
              }`}
            >
              <PlusCircle className={`w-5 h-5 shrink-0 ${activeTab === 'direct_provision' ? 'text-[#3368A0]' : 'text-slate-600'}`} />
              {sidebarOpen && <span className="truncate">Direct Device Provisioning</span>}
            </button>

            <button
              onClick={() => setActiveTab('tenant_profiles')}
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl transition-all relative ${
                activeTab === 'tenant_profiles'
                  ? 'bg-[#C8DFDB]/60 border border-[#3368A0]/30 text-[#3368A0] font-bold shadow-xs'
                  : 'text-slate-800 hover:text-slate-900 hover:bg-[#C8DFDB]/25 font-semibold'
              }`}
            >
              <Cpu className={`w-5 h-5 shrink-0 ${activeTab === 'tenant_profiles' ? 'text-[#3368A0]' : 'text-slate-600'}`} />
              {sidebarOpen && <span className="truncate">Tenant Devices & Keys</span>}
            </button>
          </nav>
        </div>

        {/* User Profile & Logout Bottom Bar */}
        <div className="p-4 border-t border-[#C8DFDB] font-sans">
          {sidebarOpen ? (
            <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-[#C8DFDB] shadow-xs">
              <div className="flex items-center gap-3 truncate">
                <div className="w-9 h-9 rounded-lg bg-[#C8DFDB]/80 border border-[#66A3BF]/40 text-[#3368A0] flex items-center justify-center font-bold text-xs shrink-0">
                  SA
                </div>
                <div className="flex flex-col truncate">
                  <span className="text-sm font-bold text-slate-900 truncate">SuperAdmin</span>
                  <span className="text-xs font-medium text-slate-600 truncate">{superadmin?.email || 'superadmin@coreboard.io'}</span>
                </div>
              </div>

              <button
                onClick={handleLogout}
                title="Sign Out"
                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50 transition-all shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              className="w-full p-3 rounded-xl bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 transition-all flex items-center justify-center border border-[#C8DFDB]"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content View Container */}
      <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'} flex flex-col min-h-screen`}>
        
        {/* Top Header Command Bar */}
        <header className="h-16 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-8 flex items-center justify-between sticky top-0 z-30 font-sans">
          <div className="flex items-center gap-3">
            <h1 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              {activeTab === 'pending_requests' && 'Provisioning Request Queue'}
              {activeTab === 'tenant_manager' && 'Tenant Onboarding & Manager'}
              {activeTab === 'direct_provision' && 'Direct Device Provisioning'}
              {activeTab === 'tenant_profiles' && 'Tenant Profiles & Key Registry'}
            </h1>
          </div>

          <div className="flex items-center gap-6 text-xs font-mono">
            {/* Quick Metrics */}
            <div className="hidden md:flex items-center gap-4 border-r border-slate-200 pr-6">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 uppercase text-[10px]">Tenants:</span>
                <span className="text-indigo-600 font-bold">{tenants.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 uppercase text-[10px]">Queue:</span>
                <span className="text-amber-600 font-bold">{pendingRequests.length}</span>
              </div>
            </div>

            <button
              onClick={() => {
                fetchPendingRequests();
                fetchTenants();
              }}
              className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-bold flex items-center gap-1.5 transition-all text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
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
                <div className="bg-cyan-50/80 border border-cyan-300 rounded-2xl p-6 shadow-md animate-[fadeIn_0.3s_ease-out] font-mono">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-cyan-900 flex items-center gap-2 uppercase tracking-wide">
                      <span className="w-2 h-2 rounded-full bg-cyan-600 animate-ping"></span>
                      AWS X.509 Cryptographic Credentials Generated
                    </h3>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300">
                      Provisioned in AWS IoT Core
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed mb-4">
                    Cryptographic credentials package established. Download all 3 authentication files below to flash onto the physical hardware controller or Python simulator client.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                      onClick={() => downloadCredentialFile(credentials.certificatePem, `device_certificate.crt`)}
                      className="bg-white border border-cyan-300 hover:border-cyan-500 text-cyan-900 hover:bg-cyan-50 font-bold p-3.5 rounded-xl flex items-center justify-between transition-all group shadow-xs"
                    >
                      <span className="flex items-center gap-2">
                        <Download className="h-4 w-4 text-cyan-700 group-hover:scale-110 transition-transform" /> Device Certificate
                      </span>
                      <span className="text-[9px] text-slate-500 font-normal">.crt</span>
                    </button>

                    <button
                      onClick={() => downloadCredentialFile(credentials.privateKeyPem, `private_key.key`)}
                      className="bg-white border border-cyan-300 hover:border-cyan-500 text-cyan-900 hover:bg-cyan-50 font-bold p-3.5 rounded-xl flex items-center justify-between transition-all group shadow-xs"
                    >
                      <span className="flex items-center gap-2">
                        <Download className="h-4 w-4 text-cyan-700 group-hover:scale-110 transition-transform" /> Private Key
                      </span>
                      <span className="text-[9px] text-slate-500 font-normal">.key</span>
                    </button>

                    <button
                      onClick={() => downloadCredentialFile(credentials.rootCaPem || DEFAULT_AMAZON_ROOT_CA_PEM, `AmazonRootCA1.pem`)}
                      className="bg-white border border-cyan-300 hover:border-cyan-500 text-cyan-900 hover:bg-cyan-50 font-bold p-3.5 rounded-xl flex items-center justify-between transition-all group shadow-xs"
                    >
                      <span className="flex items-center gap-2">
                        <Download className="h-4 w-4 text-cyan-700 group-hover:scale-110 transition-transform" /> Root CA Cert
                      </span>
                      <span className="text-[9px] text-slate-500 font-normal">.pem</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left: Queue Table */}
                <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
                  <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200 font-sans">
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">Pending Authorization Requests</h3>
                      <p className="text-[10px] font-mono text-slate-500 mt-0.5">Device registration setup queue submitted by Tenant Administrators.</p>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-indigo-700 font-bold text-xs font-mono">
                      {pendingRequests.length} Pending
                    </span>
                  </div>

                  {loadingRequests ? (
                    <div className="p-12 text-center text-slate-500 font-mono text-xs">
                      Querying pending requests queue...
                    </div>
                  ) : pendingRequests.length === 0 ? (
                    <div className="border border-dashed border-slate-200 rounded-xl p-12 text-center text-slate-500 font-mono text-xs">
                      No pending device setup requests in queue.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left font-mono text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider pb-3">
                            <th className="p-3 font-bold">Tenant Domain</th>
                            <th className="p-3 font-bold">Thing Name</th>
                            <th className="p-3 font-bold">Hardware Profile</th>
                            <th className="p-3 font-bold text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {pendingRequests.map((req, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                              <td className="p-3 font-bold text-slate-900">{req.tenantId}</td>
                              <td className="p-3 text-indigo-700 font-bold">{req.deviceId}</td>
                              <td className="p-3 text-slate-600 uppercase text-[10px]">{req.deviceType}</td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => handleApprove(req)}
                                  disabled={isProvisioning}
                                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-all disabled:opacity-50 inline-flex items-center gap-1.5"
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
                <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md flex flex-col h-[480px] font-mono text-slate-100">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
                    <Terminal className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">AWS Provisioning Execution Console</h3>
                  </div>
                  <div className="flex-1 bg-slate-950 rounded-xl p-4 text-[10px] overflow-y-auto border border-slate-800 space-y-2">
                    {provLogs.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-slate-500 italic">
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
            <div className="w-full bg-white border border-[#C8DFDB] rounded-2xl p-6 shadow-xs text-xs font-sans">
              
              {/* Full-width Top Header & Action Controls */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#C8DFDB]">
                <div>
                  <h3 className="text-base font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-[#3368A0]" />
                    Registered Tenant Accounts
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Manage multi-tenant partitions and onboard new tenant client organizations.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setOnboardError(null);
                      setOnboardSuccess(null);
                      setIsOnboardModalOpen(true);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-[#3368A0] hover:bg-[#285382] text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow-md"
                  >
                    <PlusCircle className="w-4 h-4 text-white" />
                    <span>Onboard New Tenant Client</span>
                  </button>

                  <button
                    onClick={fetchTenants}
                    className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-[#C8DFDB]/30 border border-[#C8DFDB] text-[#3368A0] font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[#3368A0]" />
                    <span>Refresh List</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Tenant Search Bar */}
              <div className="mb-4 relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#66A3BF]" />
                <input
                  type="text"
                  placeholder="Search tenants by company name, domain ID, or admin email..."
                  value={tenantSearchQuery}
                  onChange={(e) => setTenantSearchQuery(e.target.value)}
                  className="w-full bg-[#F2EFE7]/80 border border-[#C8DFDB] rounded-xl py-2.5 pl-10 pr-10 text-xs font-sans font-semibold text-slate-900 focus:outline-none focus:bg-white focus:border-[#3368A0] focus:ring-1 focus:ring-[#3368A0] transition-all"
                />
                {tenantSearchQuery && (
                  <button
                    onClick={() => setTenantSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Full-width Registered Tenants Table */}
              {loadingTenants ? (
                <div className="p-16 text-center text-slate-500 font-sans text-xs font-medium">
                  Fetching tenant list...
                </div>
              ) : tenants.length === 0 ? (
                <div className="border border-dashed border-[#C8DFDB] rounded-xl p-16 text-center text-slate-500 font-sans text-xs font-medium">
                  No active tenants onboarded yet. Click <strong>"Onboard New Tenant Client"</strong> above to register your first client.
                </div>
              ) : (
                <div className="overflow-x-auto border border-[#C8DFDB] rounded-xl shadow-xs">
                  <table className="w-full text-left font-sans text-xs">
                    <thead>
                      <tr className="bg-[#C8DFDB]/30 border-b border-[#C8DFDB] text-slate-700 uppercase text-[10px] font-bold tracking-wider">
                        <th className="p-3.5 w-10 text-center"></th>
                        <th className="p-3.5">Company / Organization</th>
                        <th className="p-3.5">Partition / Domain ID</th>
                        <th className="p-3.5">Admin Email</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#C8DFDB]/40 bg-white">
                      {tenants
                        .filter(t => {
                          const q = tenantSearchQuery.toLowerCase().trim();
                          if (!q) return true;
                          return (
                            t.companyName.toLowerCase().includes(q) ||
                            t.tenantId.toLowerCase().includes(q) ||
                            (t.adminEmail && t.adminEmail.toLowerCase().includes(q))
                          );
                        })
                        .map((t) => {
                          const isExpanded = expandedTenantId === t.tenantId;
                          return (
                            <React.Fragment key={t.tenantId}>
                              <tr className={`hover:bg-[#F2EFE7]/60 transition-colors ${isExpanded ? 'bg-[#F2EFE7]/40' : ''}`}>
                                {/* Expand Toggle */}
                                <td className="p-3.5 text-center">
                                  <button
                                    onClick={() => setExpandedTenantId(isExpanded ? null : t.tenantId)}
                                    title={isExpanded ? "Collapse Details" : "Expand Details"}
                                    className="p-1 rounded-md text-slate-500 hover:text-[#3368A0] hover:bg-[#C8DFDB]/40 transition-all cursor-pointer"
                                  >
                                    {isExpanded ? <ChevronUp className="w-4 h-4 text-[#3368A0]" /> : <ChevronDown className="w-4 h-4" />}
                                  </button>
                                </td>

                                {/* Company Name */}
                                <td className="p-3.5 font-bold text-slate-900 whitespace-nowrap">{t.companyName}</td>

                                {/* Compact Tenant Domain ID */}
                                <td className="p-3.5 whitespace-nowrap">
                                  <button
                                    onClick={() => handleCopyDomain(t.tenantId)}
                                    title="Click to copy Tenant Domain ID"
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#C8DFDB]/40 hover:bg-[#C8DFDB]/80 border border-[#66A3BF]/40 text-[#3368A0] font-mono text-xs font-bold transition-all max-w-[220px] whitespace-nowrap truncate group cursor-pointer"
                                  >
                                    <span className="truncate">TENANT#{t.tenantId}</span>
                                    {copiedDomain === t.tenantId ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5 text-[#66A3BF] group-hover:text-[#3368A0] shrink-0" />
                                    )}
                                  </button>
                                </td>

                                {/* Admin Email */}
                                <td className="p-3.5 text-slate-600 font-medium whitespace-nowrap">{t.adminEmail}</td>

                                {/* Status */}
                                <td className="p-3.5 whitespace-nowrap">
                                  <span className="px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300">
                                    ACTIVE
                                  </span>
                                </td>

                                {/* Quick Actions */}
                                <td className="p-3.5 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => {
                                        setActiveTab('tenant_profiles');
                                        fetchTenantDevices(t.tenantId);
                                      }}
                                      className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#C8DFDB]/30 border border-[#C8DFDB] text-[#3368A0] text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1 cursor-pointer"
                                    >
                                      <span>Devices</span>
                                      <ChevronRight className="w-3.5 h-3.5 text-[#3368A0]" />
                                    </button>

                                    <button
                                      onClick={() => handleDeleteTenant(t.tenantId, t.companyName)}
                                      title={`Permanently Delete Tenant ${t.companyName} (${t.tenantId})`}
                                      className="p-1.5 rounded-lg bg-white hover:bg-rose-50 border border-[#C8DFDB] hover:border-rose-300 text-slate-500 hover:text-rose-600 transition-all shadow-xs shrink-0 cursor-pointer"
                                    >
                                      <Trash2 className="w-4 h-4 text-rose-500" />
                                    </button>
                                  </div>
                                </td>
                              </tr>

                              {/* Expandable Tenant Details Drawer */}
                              {isExpanded && (
                                <tr className="bg-[#F2EFE7]/50 border-b border-[#C8DFDB]">
                                  <td colSpan={6} className="p-4 font-sans">
                                    <div className="bg-white border border-[#C8DFDB] rounded-xl p-4 shadow-xs space-y-3">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Full Tenant Metadata Drawer</span>
                                        <span className="px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
                                          Partition Status: ACTIVE
                                        </span>
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                        <div>
                                          <span className="text-slate-500 uppercase text-[10px] font-bold block mb-1">Full Tenant Domain / Partition ID</span>
                                          <button
                                            onClick={() => handleCopyDomain(t.tenantId)}
                                            className="w-full flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[#F2EFE7]/80 hover:bg-[#C8DFDB]/40 border border-[#C8DFDB] text-[#3368A0] font-bold text-xs transition-all text-left cursor-pointer group"
                                          >
                                            <span className="break-all font-mono font-bold">TENANT#{t.tenantId}</span>
                                            {copiedDomain === t.tenantId ? (
                                              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                                            ) : (
                                              <Copy className="w-4 h-4 text-[#66A3BF] group-hover:text-[#3368A0] shrink-0" />
                                            )}
                                          </button>
                                        </div>

                                        <div>
                                          <span className="text-slate-500 uppercase text-[10px] font-bold block mb-1">Tenant Administrator Contact</span>
                                          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 font-sans font-semibold">
                                            {t.adminEmail}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="pt-2 border-t border-[#C8DFDB] flex items-center justify-between">
                                        <span className="text-xs font-medium text-slate-500 font-sans">
                                          Organization: <strong className="text-slate-900">{t.companyName}</strong>
                                        </span>
                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={() => {
                                              setActiveTab('tenant_profiles');
                                              fetchTenantDevices(t.tenantId);
                                            }}
                                            className="px-3 py-1.5 rounded-lg bg-[#3368A0] hover:bg-[#285382] text-white text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer font-sans"
                                          >
                                            <Cpu className="w-3.5 h-3.5" />
                                            <span>Inspect Devices</span>
                                          </button>
                                          <button
                                            onClick={() => handleDeleteTenant(t.tenantId, t.companyName)}
                                            className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer font-sans"
                                          >
                                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                            <span>Delete Tenant</span>
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ONBOARD NEW TENANT CLIENT MODAL DIALOG */}
              {isOnboardModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-md w-full relative animate-in fade-in zoom-in-95 duration-150">
                    
                    {/* Modal Header */}
                    <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-200">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">Onboard New Tenant Client</h3>
                          <p className="text-[10px] font-mono text-slate-500 mt-0.5">Provision isolated tenant partition & credentials.</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setIsOnboardModalOpen(false)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Alert Banners */}
                    {onboardError && (
                      <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl mb-4 flex items-center gap-2 font-sans text-xs">
                        <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
                        <span>{onboardError}</span>
                      </div>
                    )}

                    {onboardSuccess && (
                      <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl mb-4 flex items-center gap-2 font-sans text-xs">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                        <span>{onboardSuccess}</span>
                      </div>
                    )}

                    {/* Onboarding Form */}
                    <form onSubmit={handleOnboardTenant} className="space-y-4 text-xs font-sans">
                      <div>
                        <label className="block text-slate-700 mb-1.5 font-bold uppercase tracking-wide text-[10px]">Company / Organization Name</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Acme Industrial Corp"
                          value={superadminCompanyName}
                          onChange={(e) => setSuperadminCompanyName(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:bg-white focus:outline-none focus:border-[#3368A0] font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 mb-1.5 font-bold uppercase tracking-wide text-[10px]">Tenant Domain ID (Partition Key)</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. acme-industrial"
                          value={superadminTenantId}
                          onChange={(e) => setSuperadminTenantId(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:bg-white focus:outline-none focus:border-[#3368A0] font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 mb-1.5 font-bold uppercase tracking-wide text-[10px]">Tenant Admin Email</label>
                        <input
                          type="email"
                          required
                          placeholder="admin@acme.com"
                          value={superadminEmail}
                          onChange={(e) => setSuperadminEmail(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:bg-white focus:outline-none focus:border-[#3368A0] font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 mb-1.5 font-bold uppercase tracking-wide text-[10px]">Initial Admin Password</label>
                        <input
                          type="password"
                          required
                          placeholder="••••••••••••"
                          value={superadminPassword}
                          onChange={(e) => setSuperadminPassword(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:bg-white focus:outline-none focus:border-[#3368A0] font-semibold"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={() => setIsOnboardModalOpen(false)}
                          className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2.5 rounded-xl bg-[#3368A0] hover:bg-[#285382] text-white font-bold tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Building2 className="w-4 h-4" />
                          Onboard Tenant Account
                        </button>
                      </div>
                    </form>

                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 3: DIRECT DEVICE PROVISIONING */}
          {activeTab === 'direct_provision' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs font-sans">
              
              {/* Left: Provisioning Controls & Credentials Download */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                
                <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
                      <PlusCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Direct Device Provisioning</h3>
                      <p className="text-[10px] font-mono text-slate-500 mt-0.5">Provision X.509 certificates & Thing slots directly.</p>
                    </div>
                  </div>

                  {directError && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl mb-4 flex items-center gap-2 font-mono">
                      <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{directError}</span>
                    </div>
                  )}

                  {directSuccess && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl mb-4 flex items-center gap-2 font-mono">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                      <span>{directSuccess}</span>
                    </div>
                  )}

                  <form onSubmit={handleDirectProvision} className="space-y-4 font-sans">
                    <div>
                      <label className="block text-slate-700 mb-1.5 font-bold uppercase tracking-wide text-[10px]">Target Tenant Partition</label>
                      {loadingTenants ? (
                        <div className="text-slate-500 text-xs font-mono">Loading tenants list...</div>
                      ) : tenants.length === 0 ? (
                        <div className="text-rose-600 text-xs font-mono">No onboarded tenants available. Please onboard a tenant first.</div>
                      ) : (
                        <select
                          value={selectedTenantId}
                          onChange={(e) => setSelectedTenantId(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3.5 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 font-semibold"
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
                      <label className="block text-slate-700 mb-1.5 font-bold uppercase tracking-wide text-[10px]">Unique Device ID / Thing Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. SMART-LOCK-101"
                        value={directDeviceId}
                        onChange={(e) => setDirectDeviceId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3.5 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 font-semibold font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 mb-1.5 font-bold uppercase tracking-wide text-[10px]">Device Profile Type (Free-Text / Custom)</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Locking System, Solar Inverter, Pump..."
                        value={directDeviceType}
                        onChange={(e) => setDirectDeviceType(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3.5 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 font-semibold mb-2"
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
                                ? 'bg-indigo-600 border-indigo-600 text-white font-bold'
                                : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
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
                      className="w-full py-3.5 rounded-xl font-bold uppercase tracking-wider mt-4 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 font-mono text-xs"
                    >
                      <Database className="h-4 w-4" />
                      Directly Provision Device
                    </button>
                  </form>
                </div>

                {/* Download Credentials Panel */}
                {credentials && (
                  <div className="bg-cyan-50/80 border border-cyan-300 rounded-2xl p-5 shadow-sm animate-[fadeIn_0.5s_ease-out]">
                    <h3 className="text-xs font-bold text-cyan-900 mb-2 flex items-center gap-2 uppercase tracking-wide font-mono">
                      <span className="w-2 h-2 rounded-full bg-cyan-600 animate-pulse"></span>
                      mTLS Credentials Established
                    </h3>
                    <p className="text-[10px] text-slate-700 leading-relaxed mb-4 font-sans">
                      Cryptographic certificates established in AWS IoT Core registry. Download files to flash onto ESP32 simulator client.
                    </p>

                    <div className="flex flex-col gap-2 font-mono text-xs">
                      <button
                        onClick={() => downloadCredentialFile(credentials.certificatePem, `device_certificate.crt`)}
                        className="w-full bg-white border border-cyan-300 text-cyan-900 hover:bg-cyan-50 font-bold p-3 rounded-xl flex items-center justify-between transition-all shadow-xs"
                      >
                        <span className="flex items-center gap-1.5">
                          <Download className="h-4 w-4 text-cyan-700" /> Download Certificate
                        </span>
                        <span className="text-[9px] text-slate-500 font-normal">device.pem.crt</span>
                      </button>

                      <button
                        onClick={() => downloadCredentialFile(credentials.privateKeyPem, `private_key.key`)}
                        className="w-full bg-white border border-cyan-300 text-cyan-900 hover:bg-cyan-50 font-bold p-3 rounded-xl flex items-center justify-between transition-all shadow-xs"
                      >
                        <span className="flex items-center gap-1.5">
                          <Download className="h-4 w-4 text-cyan-700" /> Download Private Key
                        </span>
                        <span className="text-[9px] text-slate-500 font-normal">private.pem.key</span>
                      </button>

                      <button
                        onClick={() => downloadCredentialFile(credentials.rootCaPem || DEFAULT_AMAZON_ROOT_CA_PEM, `AmazonRootCA1.pem`)}
                        className="w-full bg-white border border-cyan-300 text-cyan-900 hover:bg-cyan-50 font-bold p-3 rounded-xl flex items-center justify-between transition-all shadow-xs"
                      >
                        <span className="flex items-center gap-1.5">
                          <Download className="h-4 w-4 text-cyan-700" /> Download Root CA
                        </span>
                        <span className="text-[9px] text-slate-500 font-normal">AmazonRootCA1.pem</span>
                      </button>
                    </div>
                  </div>
                )}

              </div>

              {/* Right: AWS SDK Execution Logs */}
              <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md flex flex-col h-[520px] font-mono text-slate-100">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">AWS SDK Ingestion Execution Terminal</h3>
                </div>
                <div className="flex-1 bg-slate-950 rounded-xl p-4 text-[10px] overflow-y-auto border border-slate-800 space-y-2">
                  {provLogs.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-500 italic">
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
            <div className="space-y-6 font-sans text-xs">
              
              <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
                <div className="flex flex-wrap gap-4 items-center justify-between mb-6 pb-4 border-b border-slate-200">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">Tenant Devices Registry & Credentials Manager</h3>
                    <p className="text-[10px] font-mono text-slate-500 mt-0.5">Inspect registered devices, reset mTLS credentials, or revoke device access.</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="text-slate-700 text-xs font-bold uppercase">Select Tenant:</label>
                    <select
                      value={selectedProfileTenantId}
                      onChange={(e) => fetchTenantDevices(e.target.value)}
                      className="bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600 font-bold font-mono"
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
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl mb-4 flex items-center gap-2 font-mono">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{deviceResetSuccess}</span>
                  </div>
                )}

                {deviceResetError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl mb-4 flex items-center gap-2 font-mono">
                    <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{deviceResetError}</span>
                  </div>
                )}

                {deviceDeleteSuccess && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl mb-4 flex items-center gap-2 font-mono">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{deviceDeleteSuccess}</span>
                  </div>
                )}

                {deviceDeleteError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl mb-4 flex items-center gap-2 font-mono">
                    <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{deviceDeleteError}</span>
                  </div>
                )}

                {!selectedProfileTenantId ? (
                  <div className="border border-dashed border-slate-200 rounded-xl p-12 text-center text-slate-500 text-xs italic font-mono">
                    Select a Tenant Domain above to inspect registered devices and manage credentials.
                  </div>
                ) : loadingTenantDevices ? (
                  <div className="p-12 text-center text-slate-500 text-xs font-mono">
                    Querying DynamoDB for registered things under TENANT#{selectedProfileTenantId}...
                  </div>
                ) : tenantDevices.length === 0 ? (
                  <div className="border border-dashed border-slate-200 rounded-xl p-12 text-center text-slate-500 text-xs font-mono">
                    No registered devices found for tenant <strong className="text-slate-800">{selectedProfileTenantId}</strong>.
                  </div>
                ) : (
                  <div className="overflow-x-auto font-mono">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider pb-3">
                          <th className="p-3 font-bold">Device ID / Thing Name</th>
                          <th className="p-3 font-bold">Hardware Classification</th>
                          <th className="p-3 font-bold">Provisioned Date</th>
                          <th className="p-3 font-bold text-right">Administrative Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {tenantDevices.map(d => {
                          const devId = d.actual_device_id || d.device_id || d.id || 'N/A';
                          return (
                            <tr key={devId} className="hover:bg-slate-50/80 transition-colors">
                              <td className="p-3 font-bold text-indigo-700">{devId}</td>
                              <td className="p-3 text-slate-600 uppercase text-[10px]">{d.device_type}</td>
                              <td className="p-3 text-slate-500">{new Date(d.created_at || Date.now()).toLocaleDateString()}</td>
                              <td className="p-3 text-right flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleRegenerateCredentials(selectedProfileTenantId, devId)}
                                  className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold text-[10px] uppercase flex items-center gap-1 transition-all"
                                >
                                  <RefreshCw className="w-3 h-3" /> Reset Credentials
                                </button>
                                <button
                                  onClick={() => handleDeleteDevice(selectedProfileTenantId, devId)}
                                  className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-[10px] uppercase flex items-center gap-1 transition-all"
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
                  <div className="mt-6 bg-cyan-50/80 border border-cyan-300 rounded-2xl p-6 shadow-sm animate-[fadeIn_0.3s_ease-out] font-mono">
                    <h3 className="text-xs font-bold text-cyan-900 mb-2 uppercase tracking-wide flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-600 animate-pulse"></span>
                      Regenerated Credentials Ready
                    </h3>
                    <p className="text-xs text-slate-700 mb-4 font-sans">
                      New X.509 certificates and keys issued for device. Download the package below:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <button
                        onClick={() => downloadCredentialFile(resetCredentialsData.certificatePem, `device_certificate.crt`)}
                        className="bg-white border border-cyan-300 text-cyan-900 hover:bg-cyan-50 font-bold p-3 rounded-xl flex items-center justify-between transition-all shadow-xs"
                      >
                        <span className="flex items-center gap-1.5"><Download className="h-4 w-4 text-cyan-700" /> Download Certificate</span>
                        <span className="text-[9px] text-slate-500 font-normal">.crt</span>
                      </button>

                      <button
                        onClick={() => downloadCredentialFile(resetCredentialsData.privateKeyPem, `private_key.key`)}
                        className="bg-white border border-cyan-300 text-cyan-900 hover:bg-cyan-50 font-bold p-3 rounded-xl flex items-center justify-between transition-all shadow-xs"
                      >
                        <span className="flex items-center gap-1.5"><Download className="h-4 w-4 text-cyan-700" /> Download Private Key</span>
                        <span className="text-[9px] text-slate-500 font-normal">.key</span>
                      </button>

                      <button
                        onClick={() => downloadCredentialFile(resetCredentialsData.rootCaPem || DEFAULT_AMAZON_ROOT_CA_PEM, `AmazonRootCA1.pem`)}
                        className="bg-white border border-cyan-300 text-cyan-900 hover:bg-cyan-50 font-bold p-3 rounded-xl flex items-center justify-between transition-all shadow-xs"
                      >
                        <span className="flex items-center gap-1.5"><Download className="h-4 w-4 text-cyan-700" /> Download Root CA</span>
                        <span className="text-[9px] text-slate-500 font-normal">.pem</span>
                      </button>
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
