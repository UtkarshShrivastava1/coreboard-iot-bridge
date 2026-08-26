import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { 
  Activity, ShieldAlert, Cpu, LogOut, Building2, User, Mail, 
  Lock, Radio, RefreshCw, Terminal, 
  Menu, X, CheckCircle2, AlertTriangle, Thermometer, Droplets, Gauge, Zap, Bell,
  Code, Copy, Check
} from 'lucide-react';

// Interfaces
interface Device {
  device_id: string;
  device_type: string;
  created_at: number;
  status: string;
}

interface TelemetryPayload {
  device_id: string;
  device_type: string;
  timestamp: string;
  status: string;
  tenant_id: string;
  [key: string]: any;
}

interface LogEntry {
  id: number;
  timestamp: string;
  data: TelemetryPayload;
}

interface TenantUser {
  tenantId: string;
  companyName: string;
  email: string;
  role: string;
}

interface Alarm {
  alarm_id: string;
  device_id: string;
  alarm_type: string;
  severity: 'CRITICAL' | 'WARNING';
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'CLEARED';
  trigger_value: number;
  message: string;
  created_at: number;
  updated_at: number;
  acknowledged_at: number | null;
  cleared_at: number | null;
}

const DEVICE_JSON_TEMPLATES: Record<string, any> = {
  pump: {
    device_id: "DEVICE_ID",
    device_type: "pump",
    flow_rate: 25.4,
    temperature: 32.5,
    status: "optimal"
  },
  temp_sensor: {
    device_id: "DEVICE_ID",
    device_type: "temp_sensor",
    temperature: 24.2,
    humidity: 58.0,
    status: "optimal"
  },
  pressure_sensor: {
    device_id: "DEVICE_ID",
    device_type: "pressure_sensor",
    pressure: 4.2,
    status: "optimal"
  },
  power_meter: {
    device_id: "DEVICE_ID",
    device_type: "power_meter",
    voltage: 230.1,
    current: 4.8,
    power: 1.1,
    status: "optimal"
  },
  smart_lock: {
    device_id: "DEVICE_ID",
    device_type: "smart_lock",
    lock_state: true,
    status: "optimal"
  },
  motion_sensor: {
    device_id: "DEVICE_ID",
    device_type: "motion_sensor",
    motion_detected: false,
    status: "optimal"
  },
  smart_switch: {
    device_id: "DEVICE_ID",
    device_type: "smart_switch",
    switch_state: true,
    status: "optimal"
  },
  custom_sensor: {
    device_id: "DEVICE_ID",
    device_type: "custom_sensor",
    custom_metric: 100.0,
    status: "optimal"
  }
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export default function App() {
  // Session State
  const [token, setToken] = useState<string | null>(localStorage.getItem('coreboard_token'));
  const [tenant, setTenant] = useState<TenantUser | null>(
    localStorage.getItem('coreboard_tenant') ? JSON.parse(localStorage.getItem('coreboard_tenant')!) : null
  );

  // Screen State: 'landing' | 'dashboard'
  const [currentScreen, setCurrentScreen] = useState<'landing' | 'dashboard'>(token ? 'dashboard' : 'landing');
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');

  // Device JSON Template specs modal state
  const [selectedTemplateDevice, setSelectedTemplateDevice] = useState<Device | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Form States
  const [tenantId, setTenantId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sidebar navigation
  const [activeTab, setActiveTab] = useState<'telemetry' | 'devices' | 'alarms' | 'simulator'>('telemetry');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Tenant Signup State
  const [signupRole, setSignupRole] = useState<'ADMIN' | 'USER'>('ADMIN');

  // Dashboard Data State
  const [devices, setDevices] = useState<Device[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string>('');
  const [liveTelemetry, setLiveTelemetry] = useState<Record<string, TelemetryPayload>>({});
  const [liveDevices, setLiveDevices] = useState<Record<string, boolean>>({});
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [loadingDevices, setLoadingDevices] = useState(false);

  // Register Device Form State
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newDeviceType, setNewDeviceType] = useState('pump');
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provLogs, setProvLogs] = useState<string[]>([]);


  // Simulator Panel State
  const [simDeviceId, setSimDeviceId] = useState('');
  const [simStatus, setSimStatus] = useState('optimal');
  const [simFields, setSimFields] = useState<Record<string, number>>({
    flow_rate: 25.0,
    temperature: 32.5,
    humidity: 55.0,
    pressure: 4.2,
    voltage: 230.0,
    current: 4.8,
    power: 1.1
  });
  const [isSimulating, setIsSimulating] = useState(false);

  // Alarm Filters
  const [alarmFilter, setAlarmFilter] = useState<'ALL' | 'ACTIVE_ACK' | 'CLEARED'>('ACTIVE_ACK');

  // General Notification state
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'warning', message: string } | null>(null);

  const showNotification = (type: 'success' | 'error' | 'warning', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Auth Headers helper
  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('coreboard_token')}`
  });

  // Handle Tenant Register (Signup)
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !email || !password) return;
    setAuthError(null);
    setAuthSuccess(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tenantId, 
          companyName, 
          email, 
          password,
          role: signupRole
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      setAuthSuccess('Account registered successfully! Please log in.');
      setAuthTab('login');
      setPassword('');
      setCompanyName('');
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Tenant Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !email || !password) return;
    setAuthError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, email, password })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      localStorage.setItem('coreboard_token', data.token);
      localStorage.setItem('coreboard_tenant', JSON.stringify(data.tenant));
      setToken(data.token);
      setTenant(data.tenant);
      setCurrentScreen('dashboard');
      showNotification('success', `Welcome back, ${data.tenant.email}!`);
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem('coreboard_token');
    localStorage.removeItem('coreboard_tenant');
    setToken(null);
    setTenant(null);
    setCurrentScreen('landing');
    setAuthError(null);
    setAuthSuccess(null);
    setDevices([]);
    setLiveTelemetry({});
    setLiveDevices({});
    setLogs([]);
    setAlarms([]);
  };

  // Fetch Tenant Devices
  const fetchDevices = async () => {
    if (!tenant) return;
    setLoadingDevices(true);
    try {
      const res = await fetch(`${API_BASE}/api/tenants/${tenant.tenantId}/devices`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setDevices(data);
        if (data.length > 0 && !activeDeviceId) {
          setActiveDeviceId(data[0].device_id);
          setSimDeviceId(data[0].device_id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch tenant devices:', err);
    } finally {
      setLoadingDevices(false);
    }
  };

  // Fetch Tenant Alarms
  const fetchAlarms = async () => {
    if (!tenant) return;
    try {
      const res = await fetch(`${API_BASE}/api/tenants/${tenant.tenantId}/alarms`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setAlarms(data);
      }
    } catch (err) {
      console.error('Failed to fetch tenant alarms:', err);
    }
  };

  // Fetch Telemetry history
  const fetchHistoricalTelemetry = async () => {
    if (!tenant) return;
    try {
      const res = await fetch(`${API_BASE}/api/tenants/${tenant.tenantId}/telemetry`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        
        // Reconstruct liveTelemetry from newest items
        const newLive: Record<string, TelemetryPayload> = {};
        data.forEach((item: TelemetryPayload) => {
          if (!newLive[item.device_id]) {
            newLive[item.device_id] = item;
          }
        });
        setLiveTelemetry(prev => ({ ...prev, ...newLive }));

        // Map logs
        const historyLogs: LogEntry[] = data.slice(0, 20).map((item: TelemetryPayload, idx: number) => ({
          id: idx + Date.now(),
          timestamp: item.timestamp || new Date().toLocaleTimeString(),
          data: item
        }));
        setLogs(historyLogs);
      }
    } catch (err) {
      console.error('Failed to load telemetry history:', err);
    }
  };

  // Alarm Actions
  const handleAcknowledgeAlarm = async (alarmId: string) => {
    if (!tenant) return;
    try {
      const res = await fetch(`${API_BASE}/api/tenants/${tenant.tenantId}/alarms/${alarmId}/acknowledge`, {
        method: 'POST',
        headers: getHeaders()
      });
      if (res.ok) {
        showNotification('success', 'Alarm status set to Acknowledged.');
        fetchAlarms();
      } else {
        const err = await res.json();
        showNotification('error', err.error || 'Failed to acknowledge alarm');
      }
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  const handleClearAlarm = async (alarmId: string) => {
    if (!tenant) return;
    try {
      const res = await fetch(`${API_BASE}/api/tenants/${tenant.tenantId}/alarms/${alarmId}/clear`, {
        method: 'POST',
        headers: getHeaders()
      });
      if (res.ok) {
        showNotification('success', 'Alarm cleared successfully.');
        fetchAlarms();
      } else {
        const err = await res.json();
        showNotification('error', err.error || 'Failed to clear alarm');
      }
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  const handleActuateDevice = async (deviceId: string, field: string, value: any) => {
    if (!tenant) return;
    try {
      const res = await fetch(`${API_BASE}/api/tenants/${tenant.tenantId}/devices/${deviceId}/actuate`, {
        method: 'POST',
        headers: {
          ...getHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          field,
          value
        })
      });
      if (res.ok) {
        showNotification('success', `Actuation command dispatched.`);
        // Optimistic local update
        setLiveTelemetry(prev => {
          const devTel = prev[deviceId] || {};
          return {
            ...prev,
            [deviceId]: {
              ...devTel,
              [field]: value
            }
          };
        });
      } else {
        const err = await res.json();
        showNotification('error', err.error || 'Actuation command failed.');
      }
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  // Load Dashboard Data on Authenticated Mount
  useEffect(() => {
    if (token && tenant) {
      fetchDevices();
      fetchAlarms();
      fetchHistoricalTelemetry();

      // Configure Socket Connection
      const socket = io(API_BASE, {
        transports: ['websocket'],
        auth: {
          token: token
        }
      });

      socket.on('connect', () => {
        setIsConnected(true);
      });

      socket.on('disconnect', () => {
        setIsConnected(false);
      });

      // Telemetry Stream Listener
      socket.on('telemetry', (data: TelemetryPayload) => {
        if (data.tenant_id === tenant.tenantId) {
          setLiveTelemetry(prev => ({
            ...prev,
            [data.device_id]: data
          }));
          setLiveDevices(prev => ({
            ...prev,
            [data.device_id]: true
          }));

          const currentTime = new Date().toLocaleTimeString();
          
          setLogs(prev => [
            { id: Date.now(), timestamp: currentTime, data },
            ...prev.slice(0, 24)
          ]);
        }
      });

      // Alarm Stream Listeners
      socket.on('alarm_triggered', (alarm: any) => {
        if (alarm.tenant_id === tenant.tenantId) {
          // Prepend or update alarms list
          setAlarms(prev => {
            const exists = prev.some(a => a.alarm_id === alarm.alarm_id);
            if (exists) {
              return prev.map(a => a.alarm_id === alarm.alarm_id ? { ...a, ...alarm } : a);
            }
            return [alarm, ...prev];
          });

          // Trigger screen toast
          showNotification(
            alarm.severity === 'CRITICAL' ? 'error' : 'warning',
            `ALARM TRIGGERED: [${alarm.actual_device_id}] ${alarm.message}`
          );
        }
      });

      socket.on('alarm_updated', (alarm: any) => {
        if (alarm.tenant_id === tenant.tenantId) {
          setAlarms(prev => prev.map(a => a.alarm_id === alarm.alarm_id ? { ...a, ...alarm } : a));
        }
      });

      socket.on('alarm_resolved', (alarm: any) => {
        if (alarm.tenant_id === tenant.tenantId) {
          setAlarms(prev => prev.map(a => a.alarm_id === alarm.alarm_id ? { ...a, status: 'CLEARED', cleared_at: Date.now() } : a));
          showNotification('success', `Resolved: Device [${alarm.actual_device_id}] alarm has been cleared.`);
        }
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [token, tenant]);

  // Request device setup (Tenant Admin)
  const handleRequestDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceId || !tenant) return;

    setIsProvisioning(true);
    setProvLogs([
      `[INFO] Initiating setup request...`,
      `[INFO] Tenant ID: ${tenant.tenantId}`,
      `[INFO] Requested Device Name: ${newDeviceId}`,
      `[INFO] Classification Type: ${newDeviceType}`,
      `[INFO] Queuing request for Superadmin approval...`
    ]);

    try {
      const response = await fetch(`${API_BASE}/api/tenants/${tenant.tenantId}/devices/request`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          deviceId: newDeviceId,
          deviceType: newDeviceType
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Request rejected.');
      }

      setProvLogs(prev => [
        ...prev,
        `[SUCCESS] Setup request registered in queue.`,
        `[INFO] Coreboard representative will complete installation on-site.`
      ]);
      
      showNotification('success', `Device request sent! Awaiting Superadmin approval.`);
      setNewDeviceId('');
    } catch (err: any) {
      setProvLogs(prev => [
        ...prev,
        `[ERROR] Failed to send request: ${err.message}`
      ]);
      showNotification('error', `Failed to request device: ${err.message}`);
    } finally {
      setIsProvisioning(false);
    }
  };


  // Trigger telemetry simulation
  const handleSimulateTelemetry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simDeviceId || !tenant) return;

    setIsSimulating(true);
    const selectedDevice = devices.find(d => d.device_id === simDeviceId);
    const type = selectedDevice ? selectedDevice.device_type : 'custom';

    // Build payload according to type
    const payload: Record<string, any> = {
      device_type: type,
      status: simStatus
    };

    if (type === 'pump') {
      payload.flow_rate = parseFloat(simFields.flow_rate.toFixed(1));
      payload.temperature = parseFloat(simFields.temperature.toFixed(1));
    } else if (type === 'temp_sensor') {
      payload.temperature = parseFloat(simFields.temperature.toFixed(1));
      payload.humidity = parseFloat(simFields.humidity.toFixed(1));
    } else if (type === 'pressure_sensor') {
      payload.pressure = parseFloat(simFields.pressure.toFixed(2));
    } else if (type === 'power_meter') {
      payload.voltage = parseFloat(simFields.voltage.toFixed(1));
      payload.current = parseFloat(simFields.current.toFixed(2));
      payload.power = parseFloat((payload.voltage * payload.current / 1000).toFixed(3)); // kW
    } else {
      payload.metric_1 = Math.round(randomVal(10, 100));
      payload.metric_2 = Math.round(randomVal(200, 1000));
    }

    try {
      const response = await fetch(`${API_BASE}/api/tenants/${tenant.tenantId}/devices/${simDeviceId}/telemetry/simulate`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to simulate');
      }

      showNotification('success', `Simulated telemetry sent for ${simDeviceId}`);
      
      // Randomize slightly for next run
      setSimFields(prev => ({
        flow_rate: Math.min(50, Math.max(10, prev.flow_rate + randomVal(-2, 2))),
        temperature: Math.min(80, Math.max(20, prev.temperature + randomVal(-1.5, 1.5))),
        humidity: Math.min(100, Math.max(20, prev.humidity + randomVal(-3, 3))),
        pressure: Math.min(6, Math.max(1, prev.pressure + randomVal(-0.2, 0.2))),
        voltage: Math.min(240, Math.max(220, prev.voltage + randomVal(-0.8, 0.8))),
        current: Math.min(10, Math.max(1, prev.current + randomVal(-0.3, 0.3))),
        power: prev.power
      }));

    } catch (err: any) {
      showNotification('error', `Simulation failed: ${err.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  const randomVal = (min: number, max: number) => Math.random() * (max - min) + min;


  // Helper getters
  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'pump': return <Zap className="w-5 h-5" />;
      case 'temp_sensor': return <Thermometer className="w-5 h-5" />;
      case 'pressure_sensor': return <Gauge className="w-5 h-5" />;
      case 'power_meter': return <Droplets className="w-5 h-5" />;
      default: return <Cpu className="w-5 h-5" />;
    }
  };

  const getDeviceColor = (type: string) => {
    switch (type) {
      case 'pump': return 'cyan';
      case 'temp_sensor': return 'amber';
      case 'pressure_sensor': return 'rose';
      case 'power_meter': return 'emerald';
      default: return 'indigo';
    }
  };

  // Filtered alarms computation
  const filteredAlarms = alarms.filter(a => {
    if (alarmFilter === 'ALL') return true;
    if (alarmFilter === 'ACTIVE_ACK') return a.status === 'ACTIVE' || a.status === 'ACKNOWLEDGED';
    if (alarmFilter === 'CLEARED') return a.status === 'CLEARED';
    return true;
  });

  // Calculate active alarms count
  const activeAlarmsCount = alarms.filter(a => a.status === 'ACTIVE' || a.status === 'ACKNOWLEDGED').length;

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 font-sans antialiased selection:bg-cyan-500 selection:text-black">
      
      {/* Dynamic Toast Notification */}
      {notification && (
        <div className={`fixed top-5 right-5 z-[100] px-4 py-3 rounded-lg border shadow-xl flex items-center gap-3 animate-[fadeIn_0.3s_ease-out] ${
          notification.type === 'error' 
            ? 'bg-rose-950/90 border-rose-500/40 text-rose-300' 
            : notification.type === 'warning'
              ? 'bg-amber-950/90 border-amber-500/40 text-amber-300'
              : 'bg-emerald-950/90 border-emerald-500/40 text-emerald-300'
        }`}>
          {notification.type === 'error' ? (
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
          ) : notification.type === 'warning' ? (
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span className="text-xs font-mono font-semibold">{notification.message}</span>
        </div>
      )}

      {/* SCREEN 1: LANDING & AUTHENTICATION */}
      {currentScreen === 'landing' && (
        <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          
          {/* Promo Presentation Panel (Left 50%) */}
          <div className="lg:col-span-7 bg-[#0b101c] border-r border-slate-800/60 p-8 lg:p-16 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-950/20 via-[#070b13] to-[#070b13] -z-10"></div>
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>
            
            {/* Brand Header */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center font-bold text-black text-sm tracking-wider orbitron">
                  CB
                </div>
                <div className="absolute -inset-0.5 bg-gradient-to-tr from-cyan-500 to-indigo-500 rounded-lg blur opacity-40 -z-10 animate-pulse"></div>
              </div>
              <div>
                <h1 className="text-lg font-black tracking-wider text-slate-100 uppercase orbitron">
                  COREBOARD
                </h1>
                <p className="text-[10px] text-cyan-400 font-mono tracking-widest uppercase">
                  Multi-Tenant IoT Suite
                </p>
              </div>
            </div>

            {/* Core Pitch */}
            <div className="my-auto py-12 max-w-lg">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/40 border border-cyan-500/25 text-cyan-400 font-mono text-[10px] font-bold uppercase tracking-wider mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
                Now Live • Release v3.2.0 (Alarms Engine)
              </div>
              
              <h2 className="text-4xl lg:text-5xl font-black orbitron leading-tight tracking-wide text-white mb-6">
                Architectural <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">Freedom</span> for Industrial IoT.
              </h2>
              
              <p className="text-slate-400 font-mono text-sm leading-relaxed mb-8">
                Connect and manage physical devices over secure mTLS tunnels, stream live metrics in milliseconds, and build bespoke telemetry control dashboards tailored exactly to your workflow.
              </p>

              {/* Highlights */}
              <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-900">
                <div>
                  <div className="text-2xl font-bold orbitron text-white">99.9%</div>
                  <div className="text-[10px] uppercase font-mono text-slate-500 tracking-wider">Device Stream Uptime</div>
                </div>
                <div>
                  <div className="text-2xl font-bold orbitron text-cyan-400">Zero Trust</div>
                  <div className="text-[10px] uppercase font-mono text-slate-500 tracking-wider">mTLS Client Security</div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="text-[10px] font-mono text-slate-600">
              © {new Date().getFullYear()} Coreboard Inc. Powered by AWS IoT Core & DynamoDB.
            </div>
          </div>

          {/* Authentication Panel (Right 50%) */}
          <div className="lg:col-span-5 bg-[#070b13] p-8 lg:p-16 flex flex-col justify-center relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

            <div className="w-full max-w-md mx-auto">
              
              {/* Form Tab Header */}
              <div className="flex bg-slate-900/60 p-1.5 rounded-xl border border-slate-800 mb-8 max-w-[240px]">
                <button
                  onClick={() => { setAuthTab('login'); setAuthError(null); }}
                  className={`flex-1 py-2 text-center rounded-lg text-xs font-bold font-mono transition-all ${
                    authTab === 'login' 
                      ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  TENANT LOGIN
                </button>
                <button
                  onClick={() => { setAuthTab('signup'); setAuthError(null); }}
                  className={`flex-1 py-2 text-center rounded-lg text-xs font-bold font-mono transition-all ${
                    authTab === 'signup' 
                      ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  SIGN UP
                </button>
              </div>

              {/* Header Title */}
              <div className="mb-6">
                <h3 className="text-2xl font-bold orbitron text-white">
                  {authTab === 'login' ? 'Welcome Back' : 'Create Tenant Profile'}
                </h3>
                <p className="text-xs font-mono text-slate-500 mt-1">
                  {authTab === 'login' 
                    ? 'Enter your organization coordinates to access your devices.' 
                    : 'Establish a new tenant domain partition with absolute security.'}
                </p>
              </div>

              {/* Auth Errors & Success Notifications */}
              {authError && (
                <div className="bg-rose-950/50 border border-rose-500/30 text-rose-300 p-3 rounded-lg text-xs font-mono mb-6 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}
              {authSuccess && (
                <div className="bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 p-3 rounded-lg text-xs font-mono mb-6 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{authSuccess}</span>
                </div>
              )}

              {/* Form Submission */}
              <form onSubmit={authTab === 'login' ? handleLogin : handleSignup} className="space-y-4 font-mono text-xs">
                {authTab === 'signup' && (
                  <>
                    {/* Role Selector */}
                    <div className="flex bg-slate-900/60 p-1.5 rounded-xl border border-slate-800 mb-4 max-w-[240px]">
                      <button
                        type="button"
                        onClick={() => { setSignupRole('ADMIN'); setAuthError(null); }}
                        className={`flex-1 py-1.5 text-center rounded-lg text-[10px] font-bold font-mono transition-all ${
                          signupRole === 'ADMIN' 
                            ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' 
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Tenant Admin
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSignupRole('USER'); setAuthError(null); }}
                        className={`flex-1 py-1.5 text-center rounded-lg text-[10px] font-bold font-mono transition-all ${
                          signupRole === 'USER' 
                            ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' 
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Tenant User
                      </button>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1.5 font-bold uppercase tracking-wider">Company / Organization Name</label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                        <input
                          type="text"
                          required
                          placeholder="e.g. Acme Corporation"
                          value={companyName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCompanyName(val);
                            const slug = val
                              .toLowerCase()
                              .replace(/[^a-z0-9\s-]/g, '')
                              .replace(/[\s_-]+/g, '-')
                              .replace(/^-+|-+$/g, '');
                            setTenantId(slug);
                          }}
                          className="w-full bg-[#0d1321] border border-slate-800 rounded-xl py-3.5 pl-11 pr-4 text-slate-200 placeholder:text-slate-655 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-semibold"
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1.5 pl-1">
                        Your official company or organization name. Used for display branding across your dashboard.
                      </p>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1.5 font-bold uppercase tracking-wider">Tenant Domain ID</label>
                      <div className="relative">
                        <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                        <input
                          type="text"
                          required
                          placeholder="e.g. acme-corp"
                          value={tenantId}
                          onChange={(e) => setTenantId(e.target.value)}
                          className="w-full bg-[#0d1321] border border-slate-800 rounded-xl py-3.5 pl-11 pr-4 text-slate-200 placeholder:text-slate-655 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-semibold"
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1.5 pl-1">
                        A unique URL-safe prefix (e.g., acme-corp) to partition your database entries, devices, and MQTT streams.
                      </p>
                    </div>
                  </>
                )}

                {authTab === 'login' && (
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-bold uppercase tracking-wider">Tenant Domain ID</label>
                    <div className="relative">
                      <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. acme-corp"
                        value={tenantId}
                        onChange={(e) => setTenantId(e.target.value)}
                        className="w-full bg-[#0d1321] border border-slate-800 rounded-xl py-3.5 pl-11 pr-4 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-semibold"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-slate-400 mb-1.5 font-bold uppercase tracking-wider">Administrator Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. admin@acme.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-[#0d1321] border border-slate-800 rounded-xl py-3.5 pl-11 pr-4 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1.5 font-bold uppercase tracking-wider">Secret Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#0d1321] border border-slate-800 rounded-xl py-3.5 pl-11 pr-4 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-semibold"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full py-4 rounded-xl font-bold uppercase tracking-wider mt-4 shadow-lg flex items-center justify-center gap-2 transition-all ${
                    isSubmitting 
                      ? 'bg-slate-850 text-slate-500 cursor-not-allowed'
                      : authTab === 'login'
                        ? 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-cyan-500/20'
                        : 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-indigo-500/20'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Authenticating Tunnel...
                    </>
                  ) : authTab === 'login' ? (
                    'Authenticate Client'
                  ) : (
                    'Establish Tenant Domain'
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* SCREEN 2: AUTHENTICATED OPERATOR DASHBOARD */}
      {currentScreen === 'dashboard' && tenant && (
        <div className="min-h-screen flex flex-col md:flex-row relative">
          
          {/* Sidebar Navigation */}
          <aside className={`bg-[#0b101c] border-r border-slate-800/80 transition-all duration-300 flex flex-col shrink-0 z-40 ${
            sidebarOpen ? 'w-64' : 'w-20'
          }`}>
            {/* Header branding in sidebar */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center font-bold text-black orbitron shrink-0">
                  CB
                </div>
                {sidebarOpen && (
                  <div className="font-bold orbitron text-white text-xs tracking-wider leading-none">
                    COREBOARD
                  </div>
                )}
              </div>
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-slate-500 hover:text-white transition-all bg-slate-900/50 p-1 rounded border border-slate-800/50 hidden md:block"
              >
                {sidebarOpen ? <X className="w-3.5 h-3.5" /> : <Menu className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Nav Link Lists */}
            <nav className="flex-1 px-4 py-6 space-y-2 font-mono text-xs">
              <button
                onClick={() => setActiveTab('telemetry')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold ${
                  activeTab === 'telemetry' 
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/40 border border-transparent'
                }`}
              >
                <Activity className="w-4 h-4 shrink-0" />
                {sidebarOpen && <span>Telemetry Monitor</span>}
              </button>

              <button
                onClick={() => setActiveTab('devices')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold ${
                  activeTab === 'devices' 
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/40 border border-transparent'
                }`}
              >
                <Cpu className="w-4 h-4 shrink-0" />
                {sidebarOpen && <span>Device Registry</span>}
              </button>

              <button
                onClick={() => setActiveTab('alarms')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all font-semibold ${
                  activeTab === 'alarms' 
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/40 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Bell className="w-4 h-4 shrink-0" />
                  {sidebarOpen && <span>Alarms Console</span>}
                </div>
                {activeAlarmsCount > 0 && sidebarOpen && (
                  <span className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center font-bold font-mono text-[9px] animate-pulse">
                    {activeAlarmsCount}
                  </span>
                )}
              </button>

              {tenant.role === 'ADMIN' && (
                <button
                  onClick={() => setActiveTab('simulator')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold ${
                    activeTab === 'simulator' 
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-900/40 border border-transparent'
                  }`}
                >
                  <Radio className="w-4 h-4 shrink-0" />
                  {sidebarOpen && <span>Testing Harness</span>}
                </button>
              )}
            </nav>

            {/* Logout panel */}
            <div className="p-4 border-t border-slate-800">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 border border-transparent rounded-xl font-mono text-xs font-semibold transition-all"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                {sidebarOpen && <span>Disconnect Node</span>}
              </button>
            </div>
          </aside>

          {/* Main Content Workspace */}
          <div className="flex-1 flex flex-col min-w-0">
            
            {/* Header */}
            <header className="bg-[#0b101c] border-b border-slate-800/80 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
              <div className="flex items-center gap-3">
                <span className="text-slate-400 text-xs font-mono hidden md:inline">Current Tenant Context:</span>
                <span className="px-3 py-1 bg-cyan-950/40 border border-cyan-500/20 rounded-full text-cyan-400 font-mono text-[10px] font-bold uppercase tracking-wider">
                  {tenant.companyName} ({tenant.tenantId})
                </span>
              </div>

              {/* Status */}
              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="flex items-center gap-2">
                  {isConnected ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-bold uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                      Gateway Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-950/40 border border-rose-500/20 text-rose-400 rounded-full text-[10px] font-bold uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                      Gateway Offline
                    </span>
                  )}
                </div>
                <div className="text-slate-400 text-xs select-none">
                  {tenant.email}
                </div>
              </div>
            </header>

            {/* Dashboard Workspace */}
            <main className="flex-1 p-6 overflow-y-auto space-y-6">

              {activeTab === 'telemetry' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Left Column: Device Navigation */}
                  <div className="lg:col-span-4 flex flex-col gap-4">
                    <h2 className="text-xs font-bold tracking-wider text-slate-400 uppercase font-mono flex items-center justify-between">
                      <span>Registered Tenant Devices</span>
                      <button 
                        onClick={fetchDevices} 
                        className="text-[10px] text-cyan-400 font-mono flex items-center gap-1 hover:text-cyan-300"
                      >
                        <RefreshCw className="w-3 h-3" /> Refresh
                      </button>
                    </h2>

                    <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto">
                      {loadingDevices ? (
                        <div className="p-8 border border-slate-800 rounded-xl text-center text-slate-500 font-mono text-xs">
                          Querying DB registry...
                        </div>
                      ) : devices.length === 0 ? (
                        <div className="border border-dashed border-slate-800 rounded-xl p-8 text-center text-slate-600 text-xs font-mono">
                          No registered devices found. Use the Device Registry tab to register a new Thing.
                        </div>
                      ) : (
                        devices.map((device) => {
                          const color = getDeviceColor(device.device_type);
                          const isSelected = activeDeviceId === device.device_id;
                          const isLive = liveDevices[device.device_id];
                          const telemetry = liveTelemetry[device.device_id];

                          // Check if device has active/acknowledged alarms
                          const activeAlarmsForDevice = alarms.filter(a => a.device_id === device.device_id && (a.status === 'ACTIVE' || a.status === 'ACKNOWLEDGED'));
                          const hasAlarms = activeAlarmsForDevice.length > 0;
                          const isCriticalAlarm = activeAlarmsForDevice.some(a => a.severity === 'CRITICAL');

                          return (
                            <button
                              key={device.device_id}
                              onClick={() => {
                                setActiveDeviceId(device.device_id);
                                setSimDeviceId(device.device_id);
                              }}
                              className={`text-left w-full border rounded-xl p-4 transition-all duration-300 relative overflow-hidden flex items-center justify-between ${
                                isSelected 
                                  ? hasAlarms
                                    ? isCriticalAlarm 
                                      ? 'bg-rose-950/20 border-rose-500 shadow-lg shadow-rose-500/10'
                                      : 'bg-amber-950/20 border-amber-500 shadow-lg shadow-amber-500/10'
                                    : `bg-[#0d162a]/90 border-${color}-500/80 shadow-lg shadow-${color}-500/10` 
                                  : hasAlarms
                                    ? isCriticalAlarm 
                                      ? 'bg-rose-950/10 border-rose-900/60 hover:bg-rose-950/20'
                                      : 'bg-amber-950/10 border-amber-900/60 hover:bg-amber-950/20'
                                    : 'bg-[#0c1222]/80 border-slate-800 hover:border-slate-700 hover:bg-[#0e1628]/50'
                              }`}
                            >
                              <div className="flex items-center gap-3 z-10">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                                  isSelected 
                                    ? hasAlarms
                                      ? isCriticalAlarm ? 'bg-rose-900/30 text-rose-400 border border-rose-500/20' : 'bg-amber-900/30 text-amber-400 border border-amber-500/20'
                                      : 'bg-cyan-950/60 text-cyan-400 border border-cyan-500/20' 
                                    : 'bg-slate-900/80 text-slate-400 border border-slate-800'
                                }`}>
                                  {getDeviceIcon(device.device_type)}
                                </div>
                                <div>
                                  <div className="font-bold font-mono text-xs tracking-wide text-white flex items-center gap-1.5">
                                    {device.device_id}
                                    {hasAlarms && (
                                      <span className={`w-2 h-2 rounded-full ${isCriticalAlarm ? 'bg-rose-500' : 'bg-amber-500'} animate-ping`}></span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mt-0.5">
                                    {device.device_type.replace(/_/g, ' ')}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right flex flex-col items-end z-10 font-mono">
                                {hasAlarms ? (
                                  <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded border ${
                                    isCriticalAlarm 
                                      ? 'bg-rose-950/60 border-rose-500/30 text-rose-400' 
                                      : 'bg-amber-950/60 border-amber-500/30 text-amber-400'
                                  }`}>
                                    ALERT
                                  </span>
                                ) : isLive ? (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-bold text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/25">
                                    <span className="w-1 h-1 rounded-full bg-cyan-400 animate-ping"></span>
                                    LIVE
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-bold text-slate-500 uppercase">
                                    REG
                                  </span>
                                )}

                                <span className="text-xs font-bold text-slate-300 mt-1.5">
                                  {device.device_type === 'pump' && telemetry && `${(telemetry.flow_rate || 0).toFixed(1)} L/m`}
                                  {device.device_type === 'temp_sensor' && telemetry && `${(telemetry.temperature || 0).toFixed(1)} °C`}
                                  {device.device_type === 'pressure_sensor' && telemetry && `${(telemetry.pressure || 0).toFixed(2)} Bar`}
                                  {device.device_type === 'power_meter' && telemetry && `${(telemetry.power || 0).toFixed(3)} kW`}
                                  {(!telemetry) && 'No Data'}
                                </span>
                              </div>

                              {isSelected && (
                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${hasAlarms ? isCriticalAlarm ? 'bg-rose-500' : 'bg-amber-500' : 'bg-cyan-500'}`}></div>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Right Column: Gauges & Metrics display */}
                  <div className="lg:col-span-8 flex flex-col gap-6">
                    {activeDeviceId ? (
                      (() => {
                        const activeDevice = devices.find(d => d.device_id === activeDeviceId) || { device_type: 'unknown', device_id: activeDeviceId };
                        const telemetry = liveTelemetry[activeDeviceId];
                        
                        // Check active alarms for this device
                        const deviceAlarms = alarms.filter(a => a.device_id === activeDeviceId && (a.status === 'ACTIVE' || a.status === 'ACKNOWLEDGED'));
                        const color = deviceAlarms.length > 0 ? (deviceAlarms.some(a => a.severity === 'CRITICAL') ? 'rose' : 'amber') : getDeviceColor(activeDevice.device_type);

                        // Percent calculations for dynamic bars
                        const flowPercent = telemetry && activeDevice.device_type === 'pump' ? Math.min(100, Math.max(0, ((telemetry.flow_rate || 0) / 50) * 100)) : 0;
                        const pumpTempPercent = telemetry && activeDevice.device_type === 'pump' ? Math.min(100, Math.max(0, ((telemetry.temperature || 0) / 80) * 100)) : 0;
                        const tempSensorPercent = telemetry && activeDevice.device_type === 'temp_sensor' ? Math.min(100, Math.max(0, (((telemetry.temperature || 0) - 10) / 30) * 100)) : 0;
                        const humidityPercent = telemetry && activeDevice.device_type === 'temp_sensor' ? (telemetry.humidity || 0) : 0;
                        const pressurePercent = telemetry && activeDevice.device_type === 'pressure_sensor' ? Math.min(100, Math.max(0, ((telemetry.pressure || 0) / 6.0) * 100)) : 0;
                        const powerPercent = telemetry && activeDevice.device_type === 'power_meter' ? Math.min(100, Math.max(0, ((telemetry.power || 0) / 2.0) * 100)) : 0;

                        return (
                          <div className={`bg-[#0c1222] border rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[420px] transition-all duration-300 ${
                            deviceAlarms.length > 0 
                              ? deviceAlarms.some(a => a.severity === 'CRITICAL')
                                ? 'border-rose-500/40 shadow-rose-950/10'
                                : 'border-amber-500/40 shadow-amber-950/10'
                              : 'border-slate-800'
                          }`}>
                            
                            {/* Glow decoration */}
                            <div className={`absolute -top-12 -right-12 w-48 h-48 bg-${color}-500/5 rounded-full blur-3xl pointer-events-none`}></div>
                            
                            {/* Device Info Header */}
                            <div className="flex justify-between items-start border-b border-slate-800/80 pb-4 mb-6 z-10">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-${color}-400`}>
                                    {getDeviceIcon(activeDevice.device_type)}
                                  </span>
                                  <h3 className="text-base font-bold orbitron tracking-wide text-white">
                                    {activeDevice.device_id}
                                  </h3>
                                </div>
                                <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mt-1 border-none bg-transparent">
                                  Type: {activeDevice.device_type.replace(/_/g, ' ')} • Topic ID: tenants/{tenant.tenantId}/devices/{activeDevice.device_id}/pub
                                </p>
                              </div>

                              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase border ${
                                deviceAlarms.length > 0
                                  ? deviceAlarms.some(a => a.severity === 'CRITICAL')
                                    ? 'bg-rose-950/50 border-rose-500/30 text-rose-400'
                                    : 'bg-amber-950/50 border-amber-500/30 text-amber-400'
                                  : 'bg-emerald-950/40 border-emerald-500/20 text-emerald-400'
                              }`}>
                                {deviceAlarms.length > 0 
                                  ? `${deviceAlarms.length} ACTIVE ALARM${deviceAlarms.length > 1 ? 'S' : ''}` 
                                  : telemetry ? (telemetry.status || 'OPTIMAL').toUpperCase() : 'NO DATA RECEIVED'}
                              </span>
                            </div>

                            {/* Alarms Detail banner if device has active alarms */}
                            {deviceAlarms.length > 0 && (
                              <div className={`mb-6 p-4 rounded-xl border font-mono text-xs flex flex-col gap-2 ${
                                deviceAlarms.some(a => a.severity === 'CRITICAL')
                                  ? 'bg-rose-950/30 border-rose-500/20 text-rose-300'
                                  : 'bg-amber-950/30 border-amber-500/20 text-amber-300'
                              }`}>
                                <div className="font-bold flex items-center gap-2">
                                  <ShieldAlert className="w-4 h-4 shrink-0" />
                                  <span>ACTIVE INCIDENT DETECTED</span>
                                </div>
                                <div className="space-y-1.5 text-2xs pl-6">
                                  {deviceAlarms.map(a => (
                                    <div key={a.alarm_id} className="flex justify-between items-center">
                                      <span>• {a.message}</span>
                                      {tenant.role === 'ADMIN' && (
                                        <button 
                                          onClick={() => handleAcknowledgeAlarm(a.alarm_id)}
                                          className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white transition-all text-2xs font-bold font-mono uppercase"
                                        >
                                          Acknowledge
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Live Telemetry Display */}
                            <div className="flex-1 flex flex-col justify-center py-4 z-10">
                              {!telemetry ? (
                                <div className="text-center py-8">
                                  <Radio className="w-10 h-10 text-slate-700 animate-pulse mx-auto mb-3" />
                                  <p className="text-xs font-mono text-slate-500">Awaiting device transmission...</p>
                                  <p className="text-[10px] font-mono text-slate-600 mt-1">Publish telemetry using simulator.py or go to the Testing Harness tab.</p>
                                </div>
                              ) : (
                                <div className="space-y-6">
                                  
                                  {/* Type: PUMP */}
                                  {activeDevice.device_type === 'pump' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                      <div className="bg-[#10192e]/60 border border-slate-800 p-5 rounded-xl">
                                        <div className="flex justify-between text-[10px] font-bold font-mono text-slate-500 mb-1 uppercase tracking-wide">
                                          <span>Flow Rate</span>
                                          <span>0 - 50 L/min</span>
                                        </div>
                                        <div className="text-3xl font-black orbitron text-cyan-400 my-2">
                                          {telemetry.flow_rate?.toFixed(1)}{' '}
                                          <span className="text-xs font-light text-slate-400 font-mono uppercase">L/min</span>
                                        </div>
                                        <div className="h-2.5 bg-slate-950 rounded-full border border-slate-850 overflow-hidden mt-3 p-0.5">
                                          <div className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full transition-all duration-1000 ease-out" style={{ width: `${flowPercent}%` }}></div>
                                        </div>
                                      </div>

                                      <div className="bg-[#10192e]/60 border border-slate-800 p-5 rounded-xl">
                                        <div className="flex justify-between text-[10px] font-bold font-mono text-slate-500 mb-1 uppercase tracking-wide">
                                          <span>Core Temperature</span>
                                          <span>Threshold: 60 / 70 °C</span>
                                        </div>
                                        <div className={`text-3xl font-black orbitron my-2 ${telemetry.temperature > 70 ? 'text-rose-500 animate-pulse' : telemetry.temperature > 60 ? 'text-amber-500' : 'text-emerald-400'}`}>
                                          {telemetry.temperature?.toFixed(1)}{' '}
                                          <span className="text-xs font-light text-slate-400 font-mono">°C</span>
                                        </div>
                                        <div className="h-2.5 bg-slate-950 rounded-full border border-slate-850 overflow-hidden mt-3 p-0.5">
                                          <div className={`h-full bg-gradient-to-r ${telemetry.temperature > 70 ? 'from-rose-600 to-rose-455' : telemetry.temperature > 60 ? 'from-amber-600 to-amber-444' : 'from-emerald-600 to-emerald-400'} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${pumpTempPercent}%` }}></div>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Type: TEMP_SENSOR */}
                                  {activeDevice.device_type === 'temp_sensor' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                      <div className="bg-[#10192e]/60 border border-slate-800 p-5 rounded-xl">
                                        <div className="flex justify-between text-[10px] font-bold font-mono text-slate-500 mb-1 uppercase tracking-wide">
                                          <span>Ambient Temperature</span>
                                          <span>Threshold: 38 °C</span>
                                        </div>
                                        <div className={`text-3xl font-black orbitron my-2 ${telemetry.temperature > 38 ? 'text-amber-500 animate-pulse' : 'text-emerald-400'}`}>
                                          {telemetry.temperature?.toFixed(1)}{' '}
                                          <span className="text-xs font-light text-slate-400 font-mono">°C</span>
                                        </div>
                                        <div className="h-2.5 bg-slate-950 rounded-full border border-slate-850 overflow-hidden mt-3 p-0.5">
                                          <div className={`h-full bg-gradient-to-r ${telemetry.temperature > 38 ? 'from-amber-600 to-amber-400' : 'from-emerald-600 to-emerald-400'} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${tempSensorPercent}%` }}></div>
                                        </div>
                                      </div>

                                      <div className="bg-[#10192e]/60 border border-slate-800 p-5 rounded-xl">
                                        <div className="flex justify-between text-[10px] font-bold font-mono text-slate-500 mb-1 uppercase tracking-wide">
                                          <span>Ambient Humidity</span>
                                          <span>Threshold: 90%</span>
                                        </div>
                                        <div className={`text-3xl font-black orbitron my-2 ${telemetry.humidity > 90 ? 'text-amber-500 animate-pulse' : 'text-cyan-400'}`}>
                                          {telemetry.humidity?.toFixed(1)}{' '}
                                          <span className="text-xs font-light text-slate-400 font-mono">%</span>
                                        </div>
                                        <div className="h-2.5 bg-slate-950 rounded-full border border-slate-850 overflow-hidden mt-3 p-0.5">
                                          <div className={`h-full bg-gradient-to-r ${telemetry.humidity > 90 ? 'from-amber-600 to-amber-400' : 'from-cyan-600 to-cyan-400'} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${humidityPercent}%` }}></div>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Type: PRESSURE_SENSOR */}
                                  {activeDevice.device_type === 'pressure_sensor' && (
                                    <div className="bg-[#10192e]/60 border border-slate-800 p-6 rounded-xl">
                                      <div className="flex justify-between text-[10px] font-bold font-mono text-slate-500 mb-2 uppercase tracking-wide">
                                        <span>Pipeline Pressure</span>
                                        <span>Threshold: 4.5 / 5.0 Bar</span>
                                      </div>
                                      <div className="flex items-baseline gap-2">
                                        <span className={`text-5xl font-black orbitron ${telemetry.pressure > 5 ? 'text-rose-500 animate-pulse' : telemetry.pressure > 4.5 ? 'text-amber-500' : 'text-emerald-400'}`}>
                                          {telemetry.pressure?.toFixed(2)}
                                        </span>
                                        <span className="text-xs text-slate-400 font-mono font-light">Bar</span>
                                      </div>
                                      <div className="h-3.5 bg-slate-950 rounded-full border border-slate-850 overflow-hidden mt-4 p-0.5">
                                        <div className={`h-full bg-gradient-to-r ${telemetry.pressure > 5 ? 'from-rose-600 to-rose-455' : telemetry.pressure > 4.5 ? 'from-amber-600 to-amber-444' : 'from-emerald-600 to-emerald-400'} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${pressurePercent}%` }}></div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Type: POWER_METER */}
                                  {activeDevice.device_type === 'power_meter' && (
                                    <div className="space-y-4">
                                      <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-[#10192e]/60 border border-slate-800 p-4 rounded-xl text-center">
                                          <div className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wide font-semibold">Voltage</div>
                                          <div className="text-xl font-bold orbitron text-white mt-1">
                                            {telemetry.voltage?.toFixed(1)} <span className="text-2xs font-light text-slate-500 font-mono">V</span>
                                          </div>
                                        </div>
                                        <div className="bg-[#10192e]/60 border border-slate-800 p-4 rounded-xl text-center">
                                          <div className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wide">Current</div>
                                          <div className="text-xl font-bold orbitron text-white mt-1">
                                            {telemetry.current?.toFixed(2)} <span className="text-2xs font-light text-slate-500 font-mono">A</span>
                                          </div>
                                        </div>
                                        <div className="bg-[#10192e]/60 border border-slate-800 p-4 rounded-xl text-center">
                                          <div className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wide">Real Power</div>
                                          <div className={`text-xl font-bold orbitron mt-1 ${telemetry.power > 1.5 ? 'text-rose-500 animate-pulse' : telemetry.power > 1.2 ? 'text-amber-500' : 'text-emerald-400'}`}>
                                            {telemetry.power?.toFixed(3)} <span className="text-2xs font-light text-slate-500 font-mono">kW</span>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="bg-[#10192e]/40 border border-slate-800 p-4 rounded-xl">
                                        <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-1">
                                          <span>Max Capacity Draw (1.2 / 1.5 kW Thresholds)</span>
                                          <span>{((telemetry.power || 0) / 2 * 100).toFixed(0)}% Load</span>
                                        </div>
                                        <div className="h-2 bg-slate-950 rounded-full border border-slate-850 overflow-hidden mt-2 p-0.5">
                                          <div className={`h-full bg-gradient-to-r ${telemetry.power > 1.5 ? 'from-rose-600 to-rose-455' : telemetry.power > 1.2 ? 'from-amber-600 to-amber-444' : 'from-emerald-600 to-emerald-400'} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${powerPercent}%` }}></div>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Dynamic Generic Attributes */}
                                  {!['pump', 'temp_sensor', 'pressure_sensor', 'power_meter'].includes(activeDevice.device_type) && (
                                    <div className="bg-[#10192e]/60 border border-slate-800 p-5 rounded-xl">
                                      <div className="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2 flex justify-between">
                                        <span>Dynamic Attributes Parser</span>
                                        <span className="text-cyan-400">Universal Actuation & Sensor Dashboard</span>
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {Object.entries(telemetry)
                                          .filter(([key]) => !['device_id', 'device_type', 'timestamp', 'status', 'tenant_id'].includes(key))
                                          .map(([key, value]) => {
                                            const isBoolean = typeof value === 'boolean' || value === 'true' || value === 'false';
                                            const boolVal = typeof value === 'boolean' ? value : value === 'true';

                                            if (isBoolean) {
                                              return (
                                                <div key={key} className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl font-mono flex items-center justify-between transition-all hover:border-slate-700">
                                                  <div>
                                                    <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">{key.replace(/_/g, ' ')}</div>
                                                    <div className={`text-xs font-bold mt-1 ${boolVal ? 'text-cyan-400' : 'text-slate-400'}`}>
                                                      {boolVal ? 'ACTIVE / ON' : 'INACTIVE / OFF'}
                                                    </div>
                                                  </div>
                                                  
                                                  {/* Toggle Switch */}
                                                  <button
                                                    onClick={() => handleActuateDevice(activeDevice.device_id, key, !boolVal)}
                                                    className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-all duration-300 focus:outline-none ${boolVal ? 'bg-cyan-500 justify-end' : 'bg-slate-800 justify-start'}`}
                                                  >
                                                    <span className="w-5 h-5 rounded-full bg-slate-950 shadow-md transform transition-transform duration-300"></span>
                                                  </button>
                                                </div>
                                              );
                                            }

                                            return (
                                              <div key={key} className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl font-mono transition-all hover:border-slate-700">
                                                <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">{key.replace(/_/g, ' ')}</div>
                                                <div className="text-lg font-bold text-slate-200 mt-1.5 orbitron">
                                                  {typeof value === 'number' ? value.toFixed(2) : String(value)}
                                                </div>
                                              </div>
                                            );
                                          })}
                                      </div>
                                    </div>
                                  )}

                                </div>
                              )}
                            </div>

                            {/* Footer */}
                            <div className="border-t border-slate-850 pt-4 mt-6 text-[10px] text-slate-500 font-mono flex justify-between items-center z-10">
                              <span>Ingestion Mode: <span className="text-cyan-500 font-bold uppercase">MQTT Gateway</span></span>
                              <span>Timestamp: <span className="text-slate-400 font-semibold">{telemetry ? telemetry.timestamp : 'Awaiting Connection'}</span></span>
                            </div>
                            
                          </div>
                        );
                      })()
                    ) : (
                      <div className="bg-[#0c1222] border border-slate-800 rounded-2xl p-12 text-center text-slate-500 font-mono text-xs">
                        Select a device from the list on the left to monitor live telemetry.
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* VIEW B: DEVICE REGISTRY (THINGS) */}
              {activeTab === 'devices' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Request Form (Tenant Admin only) */}
                  {tenant.role === 'ADMIN' && (
                    <div className="lg:col-span-5 flex flex-col gap-6">
                      <div className="bg-[#0c1222] border border-slate-800 rounded-2xl p-6 shadow-xl">
                        <h3 className="text-sm font-bold orbitron text-white mb-1">Request Device Setup</h3>
                        <p className="text-[10px] text-slate-500 font-mono mb-6">Submit a setup initiation request. A Coreboard administrator will complete the cloud registration on-site.</p>

                        <form onSubmit={handleRequestDevice} className="space-y-4 font-mono text-xs">
                          <div>
                            <label className="block text-slate-400 mb-1.5 font-bold uppercase tracking-wide">Unique Device ID / Thing Name</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. PUMP-02"
                              value={newDeviceId}
                              onChange={(e) => setNewDeviceId(e.target.value)}
                              className="w-full bg-[#0d1321] border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-400 mb-1.5 font-bold uppercase tracking-wide">Device Hardware Profile</label>
                            <select
                              value={newDeviceType}
                              onChange={(e) => setNewDeviceType(e.target.value)}
                              className="w-full bg-[#0d1321] border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer font-bold text-cyan-400"
                            >
                              <option value="pump">Industrial Water Pump</option>
                              <option value="temp_sensor">Ambient Temperature & Humidity Node</option>
                              <option value="pressure_sensor">Pipeline Pressure Gauge</option>
                              <option value="power_meter">Energy Power Smart Meter</option>
                              <option value="custom_sensor">Custom Sensor Node (Generic Object)</option>
                            </select>
                          </div>

                          <button
                            type="submit"
                            disabled={isProvisioning}
                            className={`w-full py-3 rounded-xl font-bold uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all ${
                              isProvisioning
                                ? 'bg-slate-850 text-slate-500 cursor-not-allowed border border-slate-800'
                                : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-cyan-500/25'
                            }`}
                          >
                            {isProvisioning ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                Submitting request...
                              </>
                            ) : (
                              'Initiate Setup Request'
                            )}
                          </button>
                        </form>
                      </div>

                      {/* Request logs console */}
                      <div className="bg-[#0c1222] border border-slate-800 rounded-2xl p-6 flex flex-col h-[220px]">
                        <div className="flex items-center gap-2 mb-3">
                          <Terminal className="w-4 h-4 text-cyan-400" />
                          <h3 className="text-xs font-bold orbitron text-white uppercase tracking-wider">Request Logs</h3>
                        </div>
                        <div className="flex-1 bg-black/60 rounded-lg p-4 font-mono text-[10px] overflow-y-auto border border-slate-900 flex flex-col gap-2">
                          {provLogs.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-slate-655 font-bold">
                              &gt;&gt; CONSOLE READY &lt;&lt;
                            </div>
                          ) : (
                            provLogs.map((log, idx) => {
                              let color = 'text-slate-400';
                              if (log.includes('[ERROR]')) color = 'text-rose-500 font-bold';
                              if (log.includes('[SUCCESS]')) color = 'text-emerald-400 font-bold';
                              if (log.includes('[INFO]')) color = 'text-cyan-400';
                              return <div key={idx} className={`${color} border-l border-slate-850 pl-2`}>{log}</div>;
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Logs & Device listing */}
                  <div className={tenant.role === 'USER' ? "lg:col-span-12 flex flex-col gap-6" : "lg:col-span-7 flex flex-col gap-6"}>
                    {/* Device list */}
                    <div className="bg-[#0c1222] border border-slate-800 rounded-2xl p-6 shadow-xl">
                      <h3 className="text-sm font-bold orbitron text-white mb-4 uppercase tracking-wide">Registered Devices Registry</h3>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-left font-mono text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-500 uppercase text-[10px] tracking-wider pb-3">
                              <th className="pb-3 font-bold">Device ID</th>
                              <th className="pb-3 font-bold">Hardware Classification</th>
                              <th className="pb-3 font-bold">Created Date</th>
                              <th className="pb-3 font-bold">State</th>
                              <th className="pb-3 font-bold text-right">Integration Specifications</th>
                            </tr>
                          </thead>
                          <tbody>
                            {devices.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="py-8 text-center text-slate-600">
                                  No devices registered under this tenant.
                                </td>
                              </tr>
                            ) : (
                              devices.map((d) => (
                                <tr key={d.device_id} className="border-b border-slate-900/60 hover:bg-slate-900/10 transition-all">
                                  <td className="py-3.5 text-slate-200 font-bold">{d.device_id}</td>
                                  <td className="py-3.5 text-slate-400 uppercase text-[10px] tracking-wider">{d.device_type}</td>
                                  <td className="py-3.5 text-slate-500">{new Date(d.created_at || Date.now()).toLocaleDateString()}</td>
                                  <td className="py-3.5">
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] uppercase font-bold text-slate-500">
                                      Registered
                                    </span>
                                  </td>
                                  <td className="py-3.5 text-right">
                                    <button
                                      onClick={() => {
                                        setSelectedTemplateDevice(d);
                                        setIsCopied(false);
                                      }}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/40 border border-cyan-500/20 text-[10px] font-bold text-cyan-400 hover:bg-cyan-500 hover:text-black transition-all"
                                    >
                                      <Code className="w-3.5 h-3.5" />
                                      View MQTT & JSON
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* SDK logs console */}
                    <div className="bg-[#0c1222] border border-slate-800 rounded-2xl p-6 flex flex-col h-[220px]">
                      <div className="flex items-center gap-2 mb-3">
                        <Terminal className="w-4 h-4 text-cyan-400" />
                        <h3 className="text-xs font-bold orbitron text-white uppercase tracking-wider">AWS Provisioning Logs</h3>
                      </div>
                      <div className="flex-1 bg-black/60 rounded-lg p-4 font-mono text-[10px] overflow-y-auto border border-slate-900 flex flex-col gap-2">
                        {provLogs.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-slate-600">
                            &gt;&gt; CONSOLE READY. SUBMIT PROVISIONING FORM &lt;&lt;
                          </div>
                        ) : (
                          provLogs.map((log, idx) => {
                            let color = 'text-slate-400';
                            if (log.includes('[ERROR]')) color = 'text-rose-500 font-bold';
                            if (log.includes('[SUCCESS]')) color = 'text-emerald-400 font-bold';
                            if (log.includes('[AWS')) color = 'text-cyan-400';
                            return <div key={idx} className={`${color} border-l border-slate-850 pl-2`}>{log}</div>;
                          })
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* VIEW C: ALARMS CONSOLE */}
              {activeTab === 'alarms' && (
                <div className="space-y-6">
                  
                  {/* Alarm Control Filters Panel */}
                  <div className="bg-[#0c1222] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-wrap gap-4 items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold orbitron text-white uppercase tracking-wide flex items-center gap-2">
                        <Bell className="w-4 h-4 text-rose-500 animate-pulse" />
                        Incident Management Center
                      </h3>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">Real-time active and resolved telemetry alarms logged in DynamoDB.</p>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-900/80 p-1 rounded-xl border border-slate-800 font-mono text-2xs">
                      <button
                        onClick={() => setAlarmFilter('ACTIVE_ACK')}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                          alarmFilter === 'ACTIVE_ACK' 
                            ? 'bg-rose-500 text-white' 
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        ACTIVE & ACK ({alarms.filter(a => a.status === 'ACTIVE' || a.status === 'ACKNOWLEDGED').length})
                      </button>
                      <button
                        onClick={() => setAlarmFilter('CLEARED')}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                          alarmFilter === 'CLEARED' 
                            ? 'bg-emerald-600 text-white' 
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        CLEARED ({alarms.filter(a => a.status === 'CLEARED').length})
                      </button>
                      <button
                        onClick={() => setAlarmFilter('ALL')}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                          alarmFilter === 'ALL' 
                            ? 'bg-slate-700 text-white' 
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        ALL HISTORY ({alarms.length})
                      </button>
                    </div>
                  </div>

                  {/* Alarms Board */}
                  <div className="bg-[#0c1222] border border-slate-800 rounded-2xl p-6 shadow-xl">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left font-mono text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-500 uppercase text-[10px] tracking-wider pb-3">
                            <th className="pb-3 font-bold">Severity</th>
                            <th className="pb-3 font-bold">Device Name</th>
                            <th className="pb-3 font-bold">Incident Type</th>
                            <th className="pb-3 font-bold">Alarm Message</th>
                            <th className="pb-3 font-bold">Trigger Metric</th>
                            <th className="pb-3 font-bold">Timestamp</th>
                            <th className="pb-3 font-bold">Status</th>
                            <th className="pb-3 font-bold text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAlarms.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="py-8 text-center text-slate-600 italic">
                                No alarms matching current filter rules found.
                              </td>
                            </tr>
                          ) : (
                            filteredAlarms.map((a) => {
                              const isCritical = a.severity === 'CRITICAL';
                              let statusColor = 'text-rose-500 bg-rose-950/20 border-rose-900/40';
                              if (a.status === 'ACKNOWLEDGED') statusColor = 'text-amber-400 bg-amber-950/20 border-amber-900/40';
                              if (a.status === 'CLEARED') statusColor = 'text-emerald-400 bg-emerald-950/20 border-emerald-900/20';

                              return (
                                <tr key={a.alarm_id} className="border-b border-slate-900/60 hover:bg-slate-900/10 transition-all">
                                  <td className="py-4">
                                    <span className={`px-2 py-0.5 rounded font-bold text-[9px] uppercase border ${
                                      isCritical ? 'bg-rose-950 text-rose-400 border-rose-800/30' : 'bg-amber-950 text-amber-400 border-amber-800/30'
                                    }`}>
                                      {a.severity}
                                    </span>
                                  </td>
                                  <td className="py-4 text-slate-200 font-bold">{a.device_id}</td>
                                  <td className="py-4 text-slate-400 uppercase text-[10px]">{a.alarm_type.replace(/_/g, ' ')}</td>
                                  <td className="py-4 text-slate-300 max-w-xs truncate" title={a.message}>{a.message}</td>
                                  <td className="py-4 text-cyan-400 font-bold">{a.trigger_value}</td>
                                  <td className="py-4 text-slate-500 text-[10px]">{new Date(a.updated_at || a.created_at).toLocaleTimeString()}</td>
                                  <td className="py-4">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${statusColor}`}>
                                      {a.status}
                                    </span>
                                  </td>
                                  <td className="py-4 text-right">
                                    {tenant.role === 'ADMIN' ? (
                                      <>
                                        {a.status === 'ACTIVE' && (
                                          <button
                                            onClick={() => handleAcknowledgeAlarm(a.alarm_id)}
                                            className="px-2 py-1 rounded bg-[#102431] hover:bg-[#122e3e] border border-cyan-500/20 text-cyan-400 font-bold mr-2 hover:text-cyan-300 transition-all text-[10px]"
                                          >
                                            Acknowledge
                                          </button>
                                        )}
                                        {a.status !== 'CLEARED' && (
                                          <button
                                            onClick={() => handleClearAlarm(a.alarm_id)}
                                            className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-600 text-slate-400 hover:text-white font-bold transition-all text-[10px]"
                                          >
                                            Resolve
                                          </button>
                                        )}
                                        {a.status === 'CLEARED' && (
                                          <span className="text-[10px] text-slate-600 italic">Resolved</span>
                                        )}
                                      </>
                                    ) : (
                                      <span className="text-[10px] text-slate-500 italic">Read-Only</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Dual Pane: logs bottom */}
                  <section className="bg-[#0c1222] border border-slate-800 rounded-2xl p-6 flex flex-col h-[220px] shadow-xl">
                    <h2 className="text-xs font-bold tracking-wider uppercase text-slate-400 font-mono mb-3 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-slate-400 shrink-0" />
                        Live Raw Telemetry Streams ({logs.length} events logged)
                      </span>
                    </h2>
                    
                    <div className="flex-1 bg-black/60 rounded-lg p-4 font-mono text-[9px] overflow-y-auto border border-slate-900 flex flex-col gap-2">
                      {logs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-650">
                          <span>&gt;&gt; STREAM BUFFER EMPTY &lt;&lt;</span>
                        </div>
                      ) : (
                        logs.map((log) => {
                          const color = getDeviceColor(log.data.device_type);
                          return (
                            <div key={log.id} className={`border-l border-${color}-800 pl-2 text-slate-400`}>
                              <span className="text-slate-600">[{log.timestamp}]</span>{' '}
                              <span className="text-slate-500 font-bold">[{log.data.device_id}]</span>{' '}
                              <span className="text-slate-300 font-mono truncate">{JSON.stringify(log.data)}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </section>

                </div>
              )}

              {/* VIEW D: TESTING HARNESS */}
              {activeTab === 'simulator' && (
                <div className="max-w-2xl mx-auto bg-[#0c1222] border border-slate-800 rounded-2xl p-6 shadow-xl">
                  <div className="flex items-center gap-2.5 mb-2 border-b border-slate-800 pb-4">
                    <Radio className="w-5 h-5 text-cyan-400 animate-pulse" />
                    <div>
                      <h3 className="text-base font-bold orbitron text-white">Device Telemetry Simulator Harness</h3>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">Simulates device telemetry payloads directly from your browser.</p>
                    </div>
                  </div>

                  {devices.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 font-mono text-xs border border-dashed border-slate-800 rounded-xl mt-4">
                      You must register at least one device in the Registry tab before testing.
                    </div>
                  ) : (
                    <form onSubmit={handleSimulateTelemetry} className="space-y-6 font-mono text-xs mt-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-slate-400 mb-1.5 font-bold uppercase tracking-wide">1. Select Target Device</label>
                          <select
                            value={simDeviceId}
                            onChange={(e) => setSimDeviceId(e.target.value)}
                            className="w-full bg-[#0d1321] border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer font-bold text-cyan-400"
                          >
                            {devices.map(d => (
                              <option key={d.device_id} value={d.device_id}>
                                {d.device_id} ({d.device_type.toUpperCase()})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-400 mb-1.5 font-bold uppercase tracking-wide">2. Status Code</label>
                          <select
                            value={simStatus}
                            onChange={(e) => setSimStatus(e.target.value)}
                            className="w-full bg-[#0d1321] border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer font-bold"
                          >
                            <option value="optimal">Optimal (Normal)</option>
                            <option value="warning">Warning Threshold</option>
                            <option value="high">Critical/Emergency Breach</option>
                          </select>
                        </div>
                      </div>

                      {/* Configurable telemetry inputs */}
                      {(() => {
                        const targetDevice = devices.find(d => d.device_id === simDeviceId) || devices[0];
                        const type = targetDevice.device_type;
                        
                        return (
                          <div className="bg-[#10192e]/40 border border-slate-850 p-5 rounded-xl space-y-4">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                              3. Telemetry Payload Metric Inputs ({type.toUpperCase()})
                            </h4>

                            {type === 'pump' && (
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-slate-500 mb-1">Flow Rate (L/min) [Normal: 15-50]</label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={simFields.flow_rate}
                                    onChange={(e) => setSimFields({ ...simFields, flow_rate: parseFloat(e.target.value) })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-300 font-bold"
                                  />
                                </div>
                                <div>
                                  <label className="block text-slate-500 mb-1">Pump Temp (°C) [Alarm &gt;60 / &gt;70]</label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={simFields.temperature}
                                    onChange={(e) => setSimFields({ ...simFields, temperature: parseFloat(e.target.value) })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-300 font-bold"
                                  />
                                </div>
                              </div>
                            )}

                            {type === 'temp_sensor' && (
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-slate-500 mb-1">Ambient Temp (°C) [Alarm &gt;38]</label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={simFields.temperature}
                                    onChange={(e) => setSimFields({ ...simFields, temperature: parseFloat(e.target.value) })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-300 font-bold"
                                  />
                                </div>
                                <div>
                                  <label className="block text-slate-500 mb-1">Humidity (%) [Alarm &gt;90]</label>
                                  <input
                                    type="number"
                                    step="1"
                                    value={simFields.humidity}
                                    onChange={(e) => setSimFields({ ...simFields, humidity: parseFloat(e.target.value) })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-300 font-bold"
                                  />
                                </div>
                              </div>
                            )}

                            {type === 'pressure_sensor' && (
                              <div>
                                <label className="block text-slate-500 mb-1">Pipeline Pressure (Bar) [Alarm &gt;4.5 / &gt;5.0]</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={simFields.pressure}
                                  onChange={(e) => setSimFields({ ...simFields, pressure: parseFloat(e.target.value) })}
                                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-300 font-bold"
                                />
                              </div>
                            )}

                            {type === 'power_meter' && (
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-slate-500 mb-1">Line Voltage (V)</label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={simFields.voltage}
                                    onChange={(e) => setSimFields({ ...simFields, voltage: parseFloat(e.target.value) })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-300 font-bold"
                                  />
                                </div>
                                <div>
                                  <label className="block text-slate-500 mb-1">Line Current Draw (A) [Alarm Power &gt;1.2 / &gt;1.5 kW]</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={simFields.current}
                                    onChange={(e) => setSimFields({ ...simFields, current: parseFloat(e.target.value) })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-300 font-bold"
                                  />
                                </div>
                              </div>
                            )}

                            {(!['pump', 'temp_sensor', 'pressure_sensor', 'power_meter'].includes(type)) && (
                              <p className="text-[10px] text-slate-500 italic">
                                Generic device types submit mock dynamic numeric values.
                              </p>
                            )}

                          </div>
                        );
                      })()}

                      <button
                        type="submit"
                        disabled={isSimulating}
                        className={`w-full py-4 rounded-xl font-bold uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all ${
                          isSimulating
                            ? 'bg-slate-850 text-slate-500 cursor-not-allowed border border-slate-800'
                            : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/25'
                        }`}
                      >
                        {isSimulating ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Ingesting Mock Telemetry Payload...
                          </>
                        ) : (
                          'Inject Simulated Message'
                        )}
                      </button>
                    </form>
                  )}
                </div>
              )}

            </main>

            {/* Footer */}
            <footer className="bg-[#0b101c] border-t border-slate-800/80 px-6 py-4 flex items-center justify-between text-[10px] font-mono text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                <span>Active Operator Session</span>
              </div>
              <div>
                <span>Coreboard Multi-Tenant Gateway v3.2.0</span>
              </div>
            </footer>

          </div>
        </div>
      )}

      {/* Modal: View MQTT & JSON Payload Specifications */}
      {selectedTemplateDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-[#0c1222] border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-[scaleIn_0.2s_ease-out] font-mono text-xs">
            
            {/* Modal Header */}
            <div className="bg-slate-900/60 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold orbitron text-white uppercase tracking-wide flex items-center gap-2">
                  <Code className="w-4 h-4 text-cyan-400" />
                  Integration Specifications
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Specifications for device: <span className="text-cyan-400 font-bold">{selectedTemplateDevice.device_id}</span></p>
              </div>
              <button 
                onClick={() => setSelectedTemplateDevice(null)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              
              {/* MQTT Topics */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">MQTT Topics</h4>
                <div className="bg-black/40 border border-slate-900 rounded-lg p-3 space-y-2 text-[10px]">
                  <div>
                    <span className="text-slate-500 block uppercase text-[8px] tracking-wide">Uplink (Publish Telemetry)</span>
                    <code className="text-emerald-400 select-all block">tenants/{tenant?.tenantId}/devices/{selectedTemplateDevice.device_id}/pub</code>
                  </div>
                  {["smart_lock", "smart_switch"].includes(selectedTemplateDevice.device_type) && (
                    <div>
                      <span className="text-slate-500 block uppercase text-[8px] tracking-wide">Downlink (Subscribe to commands)</span>
                      <code className="text-cyan-400 select-all block">tenants/{tenant?.tenantId}/devices/{selectedTemplateDevice.device_id}/sub</code>
                    </div>
                  )}
                </div>
              </div>

              {/* JSON Payload */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">JSON Body Payload</h4>
                  <button
                    onClick={() => {
                      const payloadStr = JSON.stringify(
                        {
                          ...DEVICE_JSON_TEMPLATES[selectedTemplateDevice.device_type] || DEVICE_JSON_TEMPLATES.custom_sensor,
                          device_id: selectedTemplateDevice.device_id
                        },
                        null,
                        2
                      );
                      navigator.clipboard.writeText(payloadStr);
                      setIsCopied(true);
                      setTimeout(() => setIsCopied(false), 2000);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-cyan-400 hover:text-white transition-all font-bold"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy JSON
                      </>
                    )}
                  </button>
                </div>

                <div className="bg-black/60 border border-slate-900 rounded-lg p-4 max-h-[220px] overflow-y-auto">
                  <pre className="text-slate-300 text-2xs leading-relaxed select-all">
                    {JSON.stringify(
                      {
                        ...DEVICE_JSON_TEMPLATES[selectedTemplateDevice.device_type] || DEVICE_JSON_TEMPLATES.custom_sensor,
                        device_id: selectedTemplateDevice.device_id
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
              </div>

              {/* TLS warning */}
              <div className="bg-amber-950/20 border border-amber-500/20 text-amber-300/80 p-3 rounded-lg text-[9px] leading-relaxed">
                ⚠️ <span className="font-bold">Important:</span> Connections require dynamic X.509 client certificates and private keys generated by the SuperAdmin team. Secure handshakes run over TLS port 8883.
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-900/40 px-6 py-3.5 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedTemplateDevice(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-[11px] font-bold"
              >
                Close Specifications
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
