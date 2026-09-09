import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Cpu, 
  Wifi, 
  WifiOff, 
  Terminal, 
  Upload, 
  Sliders, 
  Play, 
  Pause, 
  AlertTriangle, 
  Trash2,
  Code,
  Copy,
  Check
} from 'lucide-react';

interface DeviceConnection {
  thingName: string;
  deviceType: string;
  tenantId: string;
  status: 'connected' | 'disconnected' | 'error';
  isAuto: boolean;
  lastData: Record<string, number | string>;
}

interface LogMessage {
  id: string;
  timestamp: string;
  thingName: string;
  type: 'publish' | 'error' | 'info';
  topic?: string;
  payload?: any;
  text?: string;
}

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [endpoint, setEndpoint] = useState('a3jn1jb4u5t66x-ats.iot.ap-south-1.amazonaws.com');
  const [tenantId, setTenantId] = useState('');
  const [thingName, setThingName] = useState('');
  const [deviceType, setDeviceType] = useState('pump');
  
  const [fetchedTenants, setFetchedTenants] = useState<{ tenantId: string; companyName: string }[]>([]);
  const [fetchedDevices, setFetchedDevices] = useState<{ deviceId: string; deviceType: string }[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [loadingDevices, setLoadingDevices] = useState(false);
  
  const [certFileContent, setCertFileContent] = useState('');
  const [keyFileContent, setKeyFileContent] = useState('');
  const [rootCaFileContent, setRootCaFileContent] = useState('');
  const [certFileName, setCertFileName] = useState('');
  const [keyFileName, setKeyFileName] = useState('');
  const [rootCaFileName, setRootCaFileName] = useState('');

  const [activeDevices, setActiveDevices] = useState<DeviceConnection[]>([]);
  const [selectedDeviceName, setSelectedDeviceName] = useState<string>('');
  
  // Simulation Mode & Custom Payload states
  const [simMode, setSimMode] = useState<'sliders' | 'freeform'>('sliders');
  const [customJsonStr, setCustomJsonStr] = useState<string>(
    JSON.stringify({ s1: 42.5, temp_c: 32.5, batt_v: 3.8, status: "optimal" }, null, 2)
  );
  const [customJsonError, setCustomJsonError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Slider states for the currently selected active device
  const [sliders, setSliders] = useState<Record<string, number>>({});
  const [isAuto, setIsAuto] = useState(false);
  
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Initialize Socket.io connection to simulator backend
  useEffect(() => {
    const s = io('http://localhost:5000');
    setSocket(s);

    s.on('connect', () => {
      console.log('Connected to Simulator backend server.');
    });

    s.on('active_devices_list', (list: DeviceConnection[]) => {
      setActiveDevices(list);
      if (list.length > 0 && !selectedDeviceName) {
        setSelectedDeviceName(list[0].thingName);
      }
    });

    s.on('device_status', (data: { thingName: string; status: 'connected' | 'disconnected' | 'error'; error?: string }) => {
      setActiveDevices(prev => {
        const idx = prev.findIndex(d => d.thingName === data.thingName);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], status: data.status };
          return updated;
        } else {
          // If a new device connected successfully, add it
          if (data.status === 'connected') {
            return [...prev, {
              thingName: data.thingName,
              deviceType,
              tenantId,
              status: 'connected',
              isAuto: false,
              lastData: {}
            }];
          }
          return prev;
        }
      });

      if (data.status === 'connected') {
        setSelectedDeviceName(data.thingName);
        addSystemLog(data.thingName, 'info', `Device connected successfully!`);
      } else if (data.status === 'error') {
        addSystemLog(data.thingName, 'error', `Connection error: ${data.error}`);
      } else if (data.status === 'disconnected') {
        addSystemLog(data.thingName, 'info', `Device disconnected.`);
      }
    });

    s.on('log_message', (log: any) => {
      setLogs(prev => [
        ...prev, 
        {
          id: Math.random().toString(36).substring(7),
          timestamp: new Date().toLocaleTimeString(),
          thingName: log.thingName,
          type: log.type,
          topic: log.topic,
          payload: log.payload,
          text: log.text
        }
      ].slice(-100)); // Limit to last 100 logs
    });

    s.on('auto_status', (data: { thingName: string; isAuto: boolean }) => {
      setActiveDevices(prev => prev.map(d => 
        d.thingName === data.thingName ? { ...d, isAuto: data.isAuto } : d
      ));
      if (selectedDeviceName === data.thingName) {
        setIsAuto(data.isAuto);
      }
    });

    s.on('actuator_command', (data: { thingName: string; topic: string; payload: any }) => {
      addSystemLog(data.thingName, 'info', `[DOWNLINK COMMAND RECEIVED] Field: "${data.payload.field}" -> Value: ${data.payload.value}`);
      
      const { field, value } = data.payload;
      if (field !== undefined && value !== undefined) {
        // Update connection state
        setActiveDevices(prev => prev.map(d => {
          if (d.thingName === data.thingName) {
            return {
              ...d,
              lastData: { ...d.lastData, [field]: value }
            };
          }
          return d;
        }));

        // Update local sliders if this is the active device on screen
        if (selectedDeviceName === data.thingName) {
          setSliders(prev => ({
            ...prev,
            [field]: typeof value === 'boolean' ? (value ? 1 : 0) : Number(value)
          }));
        }

        // Echo the state back as telemetry to simulate a successful hardware execution
        s.emit('publish_telemetry', {
          thingName: data.thingName,
          data: {
            [field]: value
          }
        });
      }
    });

    return () => {
      s.disconnect();
    };
  }, [selectedDeviceName]);

  // Fetch tenants on mount
  useEffect(() => {
    const getTenants = async () => {
      setLoadingTenants(true);
      try {
        const res = await fetch('http://localhost:4000/api/public/tenants');
        if (res.ok) {
          const data = await res.json();
          setFetchedTenants(data);
          if (data.length > 0) {
            setTenantId(data[0].tenantId);
          }
        }
      } catch (err) {
        console.error("Failed to fetch tenants for simulator:", err);
      } finally {
        setLoadingTenants(false);
      }
    };
    getTenants();
  }, []);

  // Fetch devices when tenantId changes
  useEffect(() => {
    if (!tenantId) {
      setFetchedDevices([]);
      setThingName('');
      return;
    }
    const getDevices = async () => {
      setLoadingDevices(true);
      try {
        const res = await fetch(`http://localhost:4000/api/public/tenants/${tenantId}/devices`);
        if (res.ok) {
          const data = await res.json();
          setFetchedDevices(data);
          if (data.length > 0) {
            setThingName(data[0].deviceId);
            setDeviceType(data[0].deviceType);
          } else {
            setThingName('');
          }
        }
      } catch (err) {
        console.error("Failed to fetch devices for simulator:", err);
      } finally {
        setLoadingDevices(false);
      }
    };
    getDevices();
  }, [tenantId]);

  // Scroll terminal logs to bottom
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Update local slider state when selected device changes
  const activeDevice = activeDevices.find(d => d.thingName === selectedDeviceName);
  useEffect(() => {
    if (activeDevice) {
      setIsAuto(activeDevice.isAuto);
      // Initialize default values for sliders if not already set
      const defaults: Record<string, number> = {};
      if (activeDevice.deviceType === 'pump') {
        defaults.flow_rate = Number(activeDevice.lastData.flow_rate) || 25.0;
        defaults.temperature = Number(activeDevice.lastData.temperature) || 32.0;
      } else if (activeDevice.deviceType === 'temp_sensor') {
        defaults.temperature = Number(activeDevice.lastData.temperature) || 22.5;
        defaults.humidity = Number(activeDevice.lastData.humidity) || 55.0;
      } else if (activeDevice.deviceType === 'pressure_sensor') {
        defaults.pressure = Number(activeDevice.lastData.pressure) || 4.0;
      } else if (activeDevice.deviceType === 'power_meter') {
        defaults.power = Number(activeDevice.lastData.power) || 1.1;
        defaults.voltage = Number(activeDevice.lastData.voltage) || 230.0;
        defaults.current = Number(activeDevice.lastData.current) || 4.8;
      } else if (activeDevice.deviceType === 'smart_lock') {
        defaults.lock_state = activeDevice.lastData.lock_state !== undefined 
          ? (typeof activeDevice.lastData.lock_state === 'boolean' ? (activeDevice.lastData.lock_state ? 1 : 0) : Number(activeDevice.lastData.lock_state)) 
          : 1;
      } else if (activeDevice.deviceType === 'motion_sensor') {
        defaults.motion_detected = activeDevice.lastData.motion_detected !== undefined 
          ? (typeof activeDevice.lastData.motion_detected === 'boolean' ? (activeDevice.lastData.motion_detected ? 1 : 0) : Number(activeDevice.lastData.motion_detected)) 
          : 0;
      } else if (activeDevice.deviceType === 'smart_switch') {
        defaults.switch_state = activeDevice.lastData.switch_state !== undefined 
          ? (typeof activeDevice.lastData.switch_state === 'boolean' ? (activeDevice.lastData.switch_state ? 1 : 0) : Number(activeDevice.lastData.switch_state)) 
          : 0;
      }
      setSliders(defaults);
    }
  }, [selectedDeviceName, activeDevices]);

  const addSystemLog = (thingName: string, type: 'info' | 'error', text: string) => {
    setLogs(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        timestamp: new Date().toLocaleTimeString(),
        thingName,
        type,
        text
      }
    ].slice(-100));
  };

  // Handle Certificate Uploads
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, target: 'cert' | 'key' | 'rootCa') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (target === 'cert') {
        setCertFileContent(content);
        setCertFileName(file.name);
      } else if (target === 'key') {
        setKeyFileContent(content);
        setKeyFileName(file.name);
      } else {
        setRootCaFileContent(content);
        setRootCaFileName(file.name);
      }
    };
    reader.readAsText(file);
  };

  // Submit device connection request to server
  const handleConnectDevice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket) return;

    if (!certFileContent || !keyFileContent) {
      alert('Please upload both the Certificate (.crt) and Private Key (.key) files first.');
      return;
    }

    socket.emit('connect_device', {
      endpoint,
      tenantId,
      thingName,
      deviceType,
      certPem: certFileContent,
      keyPem: keyFileContent,
      rootCaPem: rootCaFileContent || undefined
    });

    addSystemLog(thingName, 'info', `Initiating mTLS connection handshake...`);
  };

  const handleDisconnectDevice = (thing: string) => {
    if (!socket) return;
    socket.emit('disconnect_device', { thingName: thing });
  };

  const handleSliderChange = (metric: string, val: number) => {
    setSliders(prev => {
      const updated = { ...prev, [metric]: val };
      // Publish the new baseline metrics immediately
      if (socket && selectedDeviceName) {
        socket.emit('publish_telemetry', {
          thingName: selectedDeviceName,
          data: updated
        });
      }
      return updated;
    });
  };

  const toggleAutoSim = () => {
    if (!socket || !selectedDeviceName) return;
    socket.emit('toggle_auto', {
      thingName: selectedDeviceName,
      isAuto: !isAuto,
      baselineData: sliders
    });
  };

  const injectFault = (faultType: string) => {
    if (!socket || !selectedDeviceName || !activeDevice) return;

    let faultData: Record<string, number> = {};

    if (activeDevice.deviceType === 'pump') {
      if (faultType === 'high_temp') {
        faultData = { ...sliders, temperature: 76.2 };
      } else if (faultType === 'low_flow') {
        faultData = { ...sliders, flow_rate: 8.5 };
      }
    } else if (activeDevice.deviceType === 'pressure_sensor') {
      if (faultType === 'overpressure') {
        faultData = { ...sliders, pressure: 5.42 };
      }
    } else if (activeDevice.deviceType === 'power_meter') {
      if (faultType === 'overload') {
        faultData = { ...sliders, power: 1.85, current: 8.1 };
      }
    } else if (activeDevice.deviceType === 'temp_sensor') {
      if (faultType === 'heat') {
        faultData = { ...sliders, temperature: 41.5 };
      }
    }

    setSliders(prev => ({ ...prev, ...faultData }));
    socket.emit('publish_telemetry', {
      thingName: selectedDeviceName,
      data: faultData
    });
    addSystemLog(selectedDeviceName, 'info', `Fault injected: ${faultType.toUpperCase()}`);
  };

  const handlePublishCustomJson = () => {
    if (!socket || !selectedDeviceName) return;
    try {
      const parsed = JSON.parse(customJsonStr);
      setCustomJsonError(null);
      socket.emit('publish_telemetry', {
        thingName: selectedDeviceName,
        data: parsed
      });
      addSystemLog(selectedDeviceName, 'info', 'Injected freeform custom JSON telemetry payload.');
    } catch (err: any) {
      setCustomJsonError('Invalid JSON syntax: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-[#f1f5f9] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#1e293b] bg-[#0f172a] px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-cyan-500 to-blue-600 p-2 rounded-lg text-white shadow-lg shadow-cyan-500/20">
            <Cpu className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              Coreboard IoT Simulator
            </h1>
            <p className="text-xs text-cyan-400 font-mono font-medium uppercase tracking-wider">
              Universal mTLS Device Simulation Studio
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-mono text-slate-400">Simulator Engine (5000): Online</span>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Device Registration & Certificates (4 cols) */}
        <section className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Form panel */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5 shadow-xl">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Upload className="h-4 w-4 text-cyan-400" />
              Onboard Simulated Device
            </h2>

            <form onSubmit={handleConnectDevice} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">AWS IoT Endpoint URL</label>
                <input 
                  type="text" 
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  className="w-full text-xs font-mono bg-[#0b0f19] border border-[#334155] rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500 transition-colors" 
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1">
                    Select Tenant
                    {loadingTenants && <span className="text-[9px] text-cyan-400 animate-pulse">(...)</span>}
                  </label>
                  <select 
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                    className="w-full text-xs bg-[#0b0f19] border border-[#334155] rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500 transition-colors"
                    required
                  >
                    <option value="">-- Choose Tenant --</option>
                    {fetchedTenants.map(t => (
                      <option key={t.tenantId} value={t.tenantId}>
                        {t.companyName} ({t.tenantId})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1">
                    Select Device
                    {loadingDevices && <span className="text-[9px] text-cyan-400 animate-pulse">(...)</span>}
                  </label>
                  <select 
                    value={thingName}
                    onChange={(e) => {
                      setThingName(e.target.value);
                      const dev = fetchedDevices.find(d => d.deviceId === e.target.value);
                      if (dev) {
                        setDeviceType(dev.deviceType);
                      }
                    }}
                    className="w-full text-xs font-mono bg-[#0b0f19] border border-[#334155] rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500 transition-colors"
                    required
                  >
                    <option value="">-- Choose Device --</option>
                    {fetchedDevices.map(d => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.deviceId}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Device Profile Classification</label>
                <select 
                  value={deviceType}
                  onChange={(e) => setDeviceType(e.target.value)}
                  className="w-full text-xs font-bold bg-[#0b0f19] border border-[#334155] rounded px-3 py-2 text-cyan-300 focus:outline-none focus:border-cyan-500 transition-colors"
                >
                  <option value="custom">⚡ Flexible Custom Payload Device (100% Agnostic)</option>
                  <option value="pump">Industrial Water Pump Profile</option>
                  <option value="temp_sensor">Ambient Weather/Temp Sensor Profile</option>
                  <option value="pressure_sensor">High-Pressure Pipeline Gauge Profile</option>
                  <option value="power_meter">Smart Electricity Grid Meter Profile</option>
                  <option value="smart_lock">Domestic Smart Door Lock Profile</option>
                  <option value="motion_sensor">Home Security Motion Sensor Profile</option>
                  <option value="smart_switch">Smart Relay Power Switch Profile</option>
                </select>
              </div>

              {/* Cert File Inputs (mTLS 3-File Package) */}
              <div className="border border-dashed border-slate-700 rounded-lg p-3 space-y-3 bg-[#0b0f19]">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-cyan-500 mb-1">Device Certificate (.crt)</label>
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 text-xs px-3 py-1.5 rounded text-slate-200 transition-colors flex items-center gap-1.5">
                      <Upload className="h-3 w-3" />
                      Upload File
                      <input 
                        type="file" 
                        accept=".crt,.pem"
                        onChange={(e) => handleFileChange(e, 'cert')}
                        className="hidden" 
                      />
                    </label>
                    <span className="text-[10px] text-slate-400 truncate max-w-[180px]">
                      {certFileName || 'No file selected'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-cyan-500 mb-1">Private Key (.key)</label>
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 text-xs px-3 py-1.5 rounded text-slate-200 transition-colors flex items-center gap-1.5">
                      <Upload className="h-3 w-3" />
                      Upload File
                      <input 
                        type="file" 
                        accept=".key,.pem"
                        onChange={(e) => handleFileChange(e, 'key')}
                        className="hidden" 
                      />
                    </label>
                    <span className="text-[10px] text-slate-400 truncate max-w-[180px]">
                      {keyFileName || 'No file selected'}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[10px] uppercase font-bold text-cyan-500">Root CA (.pem)</label>
                    <span className="text-[9px] text-emerald-400 font-mono">Optional (Auto AmazonRootCA1)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 text-xs px-3 py-1.5 rounded text-slate-200 transition-colors flex items-center gap-1.5">
                      <Upload className="h-3 w-3" />
                      Upload File
                      <input 
                        type="file" 
                        accept=".pem,.crt"
                        onChange={(e) => handleFileChange(e, 'rootCa')}
                        className="hidden" 
                      />
                    </label>
                    <span className="text-[10px] text-slate-400 truncate max-w-[180px]">
                      {rootCaFileName || 'AmazonRootCA1.pem (Default)'}
                    </span>
                  </div>
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold py-2.5 px-4 rounded transition-all shadow-lg shadow-cyan-500/10 flex items-center justify-center gap-1.5"
              >
                <Wifi className="h-4 w-4" />
                Establish mTLS Tunnel
              </button>
            </form>
          </div>

          {/* Active device registry */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5 shadow-xl flex-1 flex flex-col">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
              Active Connections Pool ({activeDevices.length})
            </h2>

            {activeDevices.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-[#1e293b] rounded-lg p-6 text-center">
                <WifiOff className="h-8 w-8 text-slate-600 mb-2" />
                <p className="text-xs text-slate-400">No active simulated devices</p>
                <p className="text-[10px] text-slate-500 mt-1">Connect a device above to start streaming</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[300px]">
                {activeDevices.map((d) => {
                  const isSelected = d.thingName === selectedDeviceName;
                  return (
                    <div 
                      key={d.thingName} 
                      onClick={() => setSelectedDeviceName(d.thingName)}
                      className={`cursor-pointer p-3 rounded-lg border text-xs flex items-center justify-between transition-all ${
                        isSelected 
                          ? 'bg-slate-800/80 border-cyan-500 shadow-md shadow-cyan-500/5' 
                          : 'bg-[#0b0f19] border-[#1e293b] hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-200">{d.thingName}</span>
                          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-400 font-medium">
                            {d.deviceType}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Tenant: <span className="font-mono">{d.tenantId}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <span className={`inline-flex rounded-full h-2 w-2 ${
                          d.status === 'connected' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500'
                        }`} />
                        <button 
                          onClick={() => handleDisconnectDevice(d.thingName)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded hover:bg-rose-950/20 transition-colors"
                          title="Disconnect Device"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Active Simulation Panel & Sliders (8 cols) */}
        <section className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Active Controller */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-6 shadow-xl flex-1 flex flex-col">
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-4 mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Sliders className="h-5 w-5 text-cyan-400" />
                  Telemetry Modulation Panel
                </h2>
                {activeDevice ? (
                  <p className="text-xs text-slate-400 mt-0.5">
                    Modulating device <span className="font-mono text-cyan-400 font-semibold">{activeDevice.thingName}</span> ({activeDevice.deviceType.toUpperCase()})
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 mt-0.5">Select a device from the left to adjust telemetry</p>
                )}
              </div>

              {activeDevice && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={toggleAutoSim}
                    className={`text-xs px-3.5 py-1.5 rounded font-bold transition-all flex items-center gap-1.5 ${
                      isAuto 
                        ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-500/10' 
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                    }`}
                  >
                    {isAuto ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    {isAuto ? 'Stop Auto-Drift' : 'Start Auto-Drift'}
                  </button>
                </div>
              )}
            </div>

            {/* Slider Interfaces */}
            {!activeDevice ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <Sliders className="h-12 w-12 text-slate-700 mb-3" />
                <p className="text-slate-400 font-medium">No Active Connection Selected</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Please configure endpoint, upload mTLS certificates, and click "Establish mTLS Tunnel" to start modulating device signals.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Mode Switcher */}
                <div className="flex bg-[#0b0f19] p-1 rounded-xl border border-[#1e293b]">
                  <button
                    type="button"
                    onClick={() => setSimMode('sliders')}
                    className={`flex-1 py-2 text-center rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                      simMode === 'sliders'
                        ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" /> Hardware Profile Presets
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimMode('freeform')}
                    className={`flex-1 py-2 text-center rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                      simMode === 'freeform'
                        ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Code className="w-3.5 h-3.5" /> Freeform Custom JSON (Device-Agnostic)
                  </button>
                </div>

                {/* MODE A: Freeform Custom JSON Editor */}
                {simMode === 'freeform' && (
                  <div className="bg-[#0b0f19] border border-slate-800/90 rounded-xl p-5 space-y-4 font-mono text-xs">
                    <div className="flex justify-between items-center">
                      <div>
                        <label className="block text-[11px] text-cyan-400 font-bold uppercase tracking-wider">
                          Arbitrary Telemetry Payload Editor
                        </label>
                        <p className="text-[9px] text-slate-400 mt-0.5">
                          Type or paste any custom JSON payload. The system will auto-discover and map all fields dynamically.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(customJsonStr);
                          setIsCopied(true);
                          setTimeout(() => setIsCopied(false), 2000);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#0f172a] border border-slate-700 text-[10px] text-cyan-400 hover:text-white transition-all font-bold"
                      >
                        {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {isCopied ? 'Copied' : 'Copy Sample'}
                      </button>
                    </div>

                    <textarea
                      rows={9}
                      value={customJsonStr}
                      onChange={(e) => {
                        setCustomJsonStr(e.target.value);
                        setCustomJsonError(null);
                      }}
                      className="w-full bg-[#070b14] border border-[#334155] rounded-xl p-4 text-emerald-400 font-mono text-xs focus:outline-none focus:border-cyan-500 leading-relaxed shadow-inner"
                      placeholder='{"s1": 42.5, "temp_c": 32.5, "batt_v": 3.8, "status": "optimal"}'
                    />

                    {customJsonError && (
                      <div className="text-rose-400 text-[10px] bg-rose-950/40 p-2.5 rounded-lg border border-rose-500/30 font-sans">
                        ⚠️ {customJsonError}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handlePublishCustomJson}
                      className="w-full py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-xs"
                    >
                      <Play className="w-4 h-4" /> Inject Freeform Payload Message over mTLS
                    </button>
                  </div>
                )}

                {/* MODE B: Sliders Area */}
                {simMode === 'sliders' && (
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      {activeDevice.deviceType === 'pump' && (
                    <div className="space-y-5">
                      {/* Flow Rate */}
                      <div className="bg-[#0b0f19] p-4 rounded-lg border border-[#1e293b]">
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-xs font-medium text-slate-300">Fluid Flow Rate</label>
                          <span className="text-sm font-mono font-bold text-cyan-400">
                            {sliders.flow_rate !== undefined ? sliders.flow_rate.toFixed(1) : '25.0'} L/min
                          </span>
                        </div>
                        <input 
                          type="range" 
                          min="0" 
                          max="50" 
                          step="0.1"
                          value={sliders.flow_rate || 25.0} 
                          onChange={(e) => handleSliderChange('flow_rate', parseFloat(e.target.value))}
                          className="w-full accent-cyan-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                          <span>0 L/min</span>
                          <span className="text-amber-500/80">Normal Threshold: &gt;15</span>
                          <span>50 L/min</span>
                        </div>
                      </div>

                      {/* Temperature */}
                      <div className="bg-[#0b0f19] p-4 rounded-lg border border-[#1e293b]">
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-xs font-medium text-slate-300">Pump Core Temp</label>
                          <span className="text-sm font-mono font-bold text-cyan-400">
                            {sliders.temperature !== undefined ? sliders.temperature.toFixed(1) : '32.0'} °C
                          </span>
                        </div>
                        <input 
                          type="range" 
                          min="0" 
                          max="100" 
                          step="0.1"
                          value={sliders.temperature || 32.0} 
                          onChange={(e) => handleSliderChange('temperature', parseFloat(e.target.value))}
                          className="w-full accent-cyan-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                          <span>0 °C</span>
                          <span className="text-rose-500/80">Alarm Limits: 60 / 70</span>
                          <span>100 °C</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeDevice.deviceType === 'temp_sensor' && (
                    <div className="space-y-5">
                      {/* Ambient Temp */}
                      <div className="bg-[#0b0f19] p-4 rounded-lg border border-[#1e293b]">
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-xs font-medium text-slate-300">Ambient Temperature</label>
                          <span className="text-sm font-mono font-bold text-cyan-400">
                            {sliders.temperature !== undefined ? sliders.temperature.toFixed(1) : '22.5'} °C
                          </span>
                        </div>
                        <input 
                          type="range" 
                          min="-10" 
                          max="60" 
                          step="0.1"
                          value={sliders.temperature || 22.5} 
                          onChange={(e) => handleSliderChange('temperature', parseFloat(e.target.value))}
                          className="w-full accent-cyan-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                          <span>-10 °C</span>
                          <span className="text-amber-500/80">Alarm Limit: 38</span>
                          <span>60 °C</span>
                        </div>
                      </div>

                      {/* Humidity */}
                      <div className="bg-[#0b0f19] p-4 rounded-lg border border-[#1e293b]">
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-xs font-medium text-slate-300">Humidity Level</label>
                          <span className="text-sm font-mono font-bold text-cyan-400">
                            {sliders.humidity !== undefined ? sliders.humidity.toFixed(1) : '55.0'} %
                          </span>
                        </div>
                        <input 
                          type="range" 
                          min="0" 
                          max="100" 
                          step="0.1"
                          value={sliders.humidity || 55.0} 
                          onChange={(e) => handleSliderChange('humidity', parseFloat(e.target.value))}
                          className="w-full accent-cyan-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                          <span>0%</span>
                          <span className="text-amber-500/80">Alarm Limit: 90%</span>
                          <span>100%</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeDevice.deviceType === 'pressure_sensor' && (
                    <div className="bg-[#0b0f19] p-4 rounded-lg border border-[#1e293b] space-y-3">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-medium text-slate-300">Pipeline Gauge Pressure</label>
                        <span className="text-sm font-mono font-bold text-cyan-400">
                          {sliders.pressure !== undefined ? sliders.pressure.toFixed(2) : '4.00'} Bar
                        </span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="10" 
                        step="0.05"
                        value={sliders.pressure || 4.0} 
                        onChange={(e) => handleSliderChange('pressure', parseFloat(e.target.value))}
                        className="w-full accent-cyan-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                        <span>0 Bar</span>
                        <span className="text-rose-500/80">Alarm Limits: 4.5 / 5.0</span>
                        <span>10 Bar</span>
                      </div>
                    </div>
                  )}

                  {activeDevice.deviceType === 'power_meter' && (
                    <div className="space-y-4">
                      {/* Active Power */}
                      <div className="bg-[#0b0f19] p-4 rounded-lg border border-[#1e293b]">
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-xs font-medium text-slate-300">Smart Active Load</label>
                          <span className="text-sm font-mono font-bold text-cyan-400">
                            {sliders.power !== undefined ? sliders.power.toFixed(3) : '1.100'} kW
                          </span>
                        </div>
                        <input 
                          type="range" 
                          min="0" 
                          max="3" 
                          step="0.005"
                          value={sliders.power || 1.1} 
                          onChange={(e) => handleSliderChange('power', parseFloat(e.target.value))}
                          className="w-full accent-cyan-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                          <span>0 kW</span>
                          <span className="text-rose-500/80">Alarm Limits: 1.2 / 1.5</span>
                          <span>3 kW</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {/* Voltage */}
                        <div className="bg-[#0b0f19] p-3 rounded-lg border border-[#1e293b]">
                          <span className="block text-[10px] text-slate-400 mb-1">Voltage</span>
                          <span className="text-sm font-mono font-bold text-slate-200">
                            {sliders.voltage !== undefined ? sliders.voltage.toFixed(1) : '230.0'} V
                          </span>
                        </div>
                        {/* Current */}
                        <div className="bg-[#0b0f19] p-3 rounded-lg border border-[#1e293b]">
                          <span className="block text-[10px] text-slate-400 mb-1">Current</span>
                          <span className="text-sm font-mono font-bold text-slate-200">
                            {sliders.current !== undefined ? sliders.current.toFixed(2) : '4.80'} A
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeDevice.deviceType === 'smart_lock' && (
                    <div className="bg-[#0b0f19] p-5 rounded-lg border border-[#1e293b] flex items-center justify-between">
                      <div>
                        <label className="text-xs font-semibold text-slate-300">Lock Mechanism State</label>
                        <span className="block text-[10px] text-slate-500 mt-1">Simulate locking/unlocking action</span>
                      </div>
                      <button 
                        onClick={() => handleSliderChange('lock_state', sliders.lock_state === 1 ? 0 : 1)}
                        className={`w-12 h-7 flex items-center rounded-full p-1 transition-all duration-300 focus:outline-none ${sliders.lock_state === 1 ? 'bg-cyan-500 justify-end' : 'bg-slate-800 justify-start'}`}
                      >
                        <span className="w-5 h-5 rounded-full bg-slate-950 shadow-md"></span>
                      </button>
                    </div>
                  )}

                  {activeDevice.deviceType === 'motion_sensor' && (
                    <div className="bg-[#0b0f19] p-5 rounded-lg border border-[#1e293b] flex items-center justify-between">
                      <div>
                        <label className="text-xs font-semibold text-slate-300">Infrared Motion Sensor</label>
                        <span className="block text-[10px] text-slate-500 mt-1">Simulate presence detection</span>
                      </div>
                      <button 
                        onClick={() => handleSliderChange('motion_detected', sliders.motion_detected === 1 ? 0 : 1)}
                        className={`w-12 h-7 flex items-center rounded-full p-1 transition-all duration-300 focus:outline-none ${sliders.motion_detected === 1 ? 'bg-rose-500 justify-end animate-pulse' : 'bg-slate-800 justify-start'}`}
                      >
                        <span className="w-5 h-5 rounded-full bg-slate-950 shadow-md"></span>
                      </button>
                    </div>
                  )}

                  {activeDevice.deviceType === 'smart_switch' && (
                    <div className="bg-[#0b0f19] p-5 rounded-lg border border-[#1e293b] flex items-center justify-between">
                      <div>
                        <label className="text-xs font-semibold text-slate-300">Relay Switch State</label>
                        <span className="block text-[10px] text-slate-500 mt-1">Simulate power outlet relay switch</span>
                      </div>
                      <button 
                        onClick={() => handleSliderChange('switch_state', sliders.switch_state === 1 ? 0 : 1)}
                        className={`w-12 h-7 flex items-center rounded-full p-1 transition-all duration-300 focus:outline-none ${sliders.switch_state === 1 ? 'bg-cyan-500 justify-end' : 'bg-slate-800 justify-start'}`}
                      >
                        <span className="w-5 h-5 rounded-full bg-slate-950 shadow-md"></span>
                      </button>
                    </div>
                  )}

                </div>

                {/* Faults / Quick Trigger Panel */}
                <div className="space-y-6 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                      Inject Fault Scenarios
                    </h3>

                    {activeDevice.deviceType === 'pump' && (
                      <div className="grid grid-cols-1 gap-3">
                        <button 
                          onClick={() => injectFault('high_temp')}
                          className="bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/60 hover:border-rose-700 text-rose-200 text-xs px-4 py-3 rounded-lg flex items-center gap-2.5 transition-all text-left"
                        >
                          <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
                          <div>
                            <div className="font-bold">Fluid Temperature Overheat</div>
                            <div className="text-[10px] text-rose-400/80">Forces temperature to 76.2°C (Critical)</div>
                          </div>
                        </button>

                        <button 
                          onClick={() => injectFault('low_flow')}
                          className="bg-amber-950/20 hover:bg-amber-950/40 border border-amber-900/60 hover:border-amber-700 text-amber-200 text-xs px-4 py-3 rounded-lg flex items-center gap-2.5 transition-all text-left"
                        >
                          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                          <div>
                            <div className="font-bold">Low Intake Fluid Flow</div>
                            <div className="text-[10px] text-amber-400/80">Reduces pump flow rate to 8.5 L/min (Warning)</div>
                          </div>
                        </button>
                      </div>
                    )}

                    {activeDevice.deviceType === 'temp_sensor' && (
                      <button 
                        onClick={() => injectFault('heat')}
                        className="w-full bg-amber-950/20 hover:bg-amber-950/40 border border-amber-900/60 hover:border-amber-700 text-amber-200 text-xs px-4 py-3 rounded-lg flex items-center gap-2.5 transition-all text-left"
                      >
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <div>
                          <div className="font-bold">Abrupt Room Overheating</div>
                          <div className="text-[10px] text-amber-400/80">Sets ambient temperature to 41.5°C</div>
                        </div>
                      </button>
                    )}

                    {activeDevice.deviceType === 'pressure_sensor' && (
                      <button 
                        onClick={() => injectFault('overpressure')}
                        className="w-full bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/60 hover:border-rose-700 text-rose-200 text-xs px-4 py-3 rounded-lg flex items-center gap-2.5 transition-all text-left"
                      >
                        <AlertTriangle className="h-4 w-4 text-rose-500" />
                        <div>
                          <div className="font-bold">Pipeline Pipe Blast Overpressure</div>
                          <div className="text-[10px] text-rose-400/80">Surges line pressure to 5.42 Bar (Critical Blast Danger)</div>
                        </div>
                      </button>
                    )}

                    {activeDevice.deviceType === 'power_meter' && (
                      <button 
                        onClick={() => injectFault('overload')}
                        className="w-full bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/60 hover:border-rose-700 text-rose-200 text-xs px-4 py-3 rounded-lg flex items-center gap-2.5 transition-all text-left"
                      >
                        <AlertTriangle className="h-4 w-4 text-rose-500" />
                        <div>
                          <div className="font-bold">Smart Load Grid Overload</div>
                          <div className="text-[10px] text-rose-400/80">Spikes load draw to 1.85 kW (Critical Overload)</div>
                        </div>
                      </button>
                    )}
                  </div>

                  <div className="bg-[#0b0f19] border border-[#1e293b] p-3.5 rounded-lg text-[11px] text-slate-400 space-y-1 font-mono">
                    <div className="text-slate-300 font-bold uppercase tracking-wider text-[10px] mb-1">Device Details</div>
                    <div>Target Topic:</div>
                    <div className="text-cyan-400 text-[10px] truncate">
                      {`tenants/${activeDevice.tenantId}/devices/${activeDevice.thingName}/pub`}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

          {/* Logs Terminal */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5 shadow-xl h-[280px] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-2 mb-3">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Terminal className="h-4 w-4 text-cyan-400" />
                Outgoing Telemetry Log Stream
              </h2>
              <button 
                onClick={() => setLogs([])}
                className="text-[10px] text-slate-400 hover:text-rose-400 transition-colors"
              >
                Clear Stream
              </button>
            </div>

            <div className="flex-1 bg-[#0b0f19] border border-[#1e293b] rounded-lg p-3 font-mono text-xs overflow-y-auto space-y-1.5 select-text">
              {logs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-600 text-xs">
                  <span>Waiting for telemetry updates...</span>
                </div>
              ) : (
                logs.map((log) => {
                  let text = '';
                  let textClass = 'text-slate-300';
                  
                  if (log.type === 'publish') {
                    text = `[PUBLISHED] Topic: ${log.topic} | Payload: ${JSON.stringify(log.payload)}`;
                    textClass = 'text-emerald-400';
                  } else if (log.type === 'error') {
                    text = `[ERROR] ${log.text}`;
                    textClass = 'text-rose-400 font-bold';
                  } else {
                    text = `[SYSTEM] ${log.text}`;
                    textClass = 'text-cyan-400';
                  }

                  return (
                    <div key={log.id} className="leading-5">
                      <span className="text-slate-500 mr-2">[{log.timestamp}]</span>
                      <span className="text-slate-400 mr-2">({log.thingName})</span>
                      <span className={textClass}>{text}</span>
                    </div>
                  );
                })
              )}
              <div ref={terminalEndRef} />
            </div>
          </div>

        </section>

      </main>
    </div>
  );
}
