import React, { useState, useEffect } from 'react';
import { 
  Ticket, Unlock, Key, Send, Terminal, Power, Radio, Server, 
  RefreshCcw, Check, Sparkles, ShieldCheck, Activity, Database 
} from 'lucide-react';

/**
 * SHER BOT MAINFRAME v16.0 - CONSOLIDATED CORE
 * File: index.js
 * * This file contains the complete high-fidelity management dashboard.
 * Optimized for single-file deployment and zero-dependency resolution errors.
 */

const App = () => {
  // --- AUTHENTICATION STATE ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginKey, setLoginKey] = useState("");
  const [serverId, setServerId] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // --- APPLICATION STATE ---
  const [activeTab, setActiveTab] = useState('tickets');
  const [lockdownActive, setLockdownActive] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState([
    { type: 'sys', msg: 'CORE V16.0 VIRTUALIZED ENVIRONMENT READY.', time: new Date().toLocaleTimeString() }
  ]);
  const [commandInput, setCommandInput] = useState("");
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState("");

  // --- MOCK DATA ---
  const [tickets, setTickets] = useState([
    { id: '1024', user: 'Nexus_Alpha', subject: 'API Latency Issue', priority: 'High', time: '12m ago', content: "Seeing 500ms delay on bot responses." },
    { id: '1025', user: 'Shadow_Mod', subject: 'Auto-Mod False Positive', priority: 'Medium', time: '45m ago', content: "Bot banned a user for saying 'hello'." },
    { id: '1026', user: 'Root_User', subject: 'Database Scaling', priority: 'Low', time: '1h ago', content: "Requesting more shards for Server ID cluster." },
  ]);

  // --- LOGIC HANDLERS ---
  const botLog = (msg, type = 'sys') => {
    setTerminalLogs(prev => [...prev, { 
      type, 
      msg: `[MAINFRAME] ${msg}`, 
      time: new Date().toLocaleTimeString() 
    }].slice(-50));
  };

  const handleBotCommand = (cmd) => {
    if (lockdownActive && !cmd.startsWith('/unlock')) {
      botLog("SECURITY OVERRIDE: ACCESS DENIED.", "err");
      return;
    }
    
    const input = cmd.toLowerCase().trim();
    if (input === '/lockdown') {
      setLockdownActive(true);
      botLog(`EMERGENCY: LOCKDOWN INITIATED FOR ${serverId}`, "err");
      triggerNotification("SYSTEMS LOCKED");
    } else if (input === '/unlock') {
      setLockdownActive(false);
      botLog(`RECOVERY: LOCKDOWN LIFTED.`, "sys");
      triggerNotification("SYSTEMS ONLINE");
    } else if (input === '/clear') {
      setTerminalLogs([]);
    } else {
      botLog(`Processing instruction: ${cmd}`, "sys");
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (serverId.length < 3) return setLoginError("Invalid Server ID");
    setIsLoggingIn(true);
    
    // Simulate secure handshake
    setTimeout(() => {
      if (loginKey === "ADMIN-MASTER") {
        setIsAuthenticated(true);
        botLog(`Secure handshake established with node ${serverId}`);
      } else {
        setLoginError("Master Key Authentication Failed");
        setIsLoggingIn(false);
      }
    }, 1200);
  };

  const triggerNotification = (msg) => {
    setNotificationMsg(msg);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
  };

  // --- COMPONENTS ---
  const SherLogo = ({ size = "text-2xl" }) => (
    <div className={`font-black tracking-widest uppercase ${size} flex items-center gap-2 select-none`}>
      <span className="bg-white text-black px-3 py-1 rounded">SHER</span>
      <span className="text-white">BOT</span>
    </div>
  );

  // --- LOGIN VIEW ---
  if (!isAuthenticated) return (
    <div className="fixed inset-0 bg-neutral-950 flex items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden opacity-20">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-500/20 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-purple-500/20 blur-[120px] rounded-full" />
      </div>

      <div className="relative w-full max-w-md space-y-8 animate-in zoom-in-95 duration-500">
        <div className="text-center">
          <SherLogo size="text-5xl" />
          <p className="text-[10px] text-gray-600 font-black tracking-[0.5em] uppercase mt-4">Unified Autonomous Control</p>
        </div>

        <form onSubmit={handleLogin} className="p-10 bg-white/5 border border-white/10 backdrop-blur-3xl rounded-[2.5rem] shadow-2xl space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Mainframe Node</label>
            <div className="relative">
              <Server className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
              <input 
                type="text" 
                placeholder="SVR-7000" 
                value={serverId} 
                onChange={e => setServerId(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-2xl py-5 pl-14 pr-6 text-white font-mono uppercase focus:border-white/30 outline-none transition-all" 
                required 
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Master Access Key</label>
            <div className="relative">
              <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
              <input 
                type="password" 
                placeholder="••••••••" 
                value={loginKey} 
                onChange={e => setLoginKey(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-2xl py-5 pl-14 pr-6 text-white font-mono focus:border-white/30 outline-none transition-all" 
                required 
              />
            </div>
          </div>

          <button className="w-full py-5 bg-white text-black font-black rounded-2xl flex items-center justify-center gap-3 hover:bg-gray-200 active:scale-95 transition-all shadow-xl shadow-white/5">
            {isLoggingIn ? <RefreshCcw className="animate-spin" size={20} /> : <Unlock size={20} />}
            INITIATE LINK
          </button>

          {loginError && <p className="text-red-500 text-[10px] text-center font-black uppercase tracking-widest animate-pulse">{loginError}</p>}
        </form>
      </div>
    </div>
  );

  // --- DASHBOARD VIEW ---
  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans selection:bg-blue-500 selection:text-white flex">
      {/* Side Navigation */}
      <aside className="w-80 border-r border-white/10 bg-black/40 backdrop-blur-3xl flex flex-col fixed h-full z-50">
        <div className="p-10 border-b border-white/10">
          <SherLogo />
        </div>
        
        <nav className="p-6 flex-grow space-y-2">
          {[
            { id: 'tickets', label: 'Support Node', icon: <Ticket size={18}/> },
            { id: 'terminal', label: 'Command Console', icon: <Terminal size={18}/> },
            { id: 'database', label: 'System Logs', icon: <Database size={18}/> },
          ].map(item => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-5 px-6 py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all ${activeTab === item.id ? 'bg-white text-black shadow-lg shadow-white/10' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-white/10 space-y-4">
          <button 
            onClick={() => handleBotCommand(lockdownActive ? '/unlock' : '/lockdown')}
            className={`w-full py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 border transition-all ${lockdownActive ? 'bg-red-600 border-red-500 shadow-xl shadow-red-600/20' : 'text-red-500 border-red-900/30 hover:bg-red-500/10'}`}
          >
            <Radio size={16} className={lockdownActive ? 'animate-pulse' : ''} />
            {lockdownActive ? "LOCKDOWN ACTIVE" : "LOCK MAINFRAME"}
          </button>
          <button onClick={() => setIsAuthenticated(false)} className="w-full py-4 text-gray-600 hover:text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3">
            <Power size={16} /> Terminate Session
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow pl-80">
        <header className="h-24 sticky top-0 bg-black/20 backdrop-blur-2xl border-b border-white/10 flex items-center justify-between px-12 z-40">
          <div className="flex items-center gap-6">
            <div className={`w-3 h-3 rounded-full ${lockdownActive ? 'bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]'} animate-pulse`} />
            <div className="flex flex-col">
              <span className="text-[11px] font-black uppercase tracking-widest">{lockdownActive ? "SECURITY_PROTOCOL_X" : "SYSTEM_STATE: NOMINAL"}</span>
              <span className="text-[9px] text-gray-600 font-bold uppercase">ID: {serverId} • LOCALHOST</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-gray-500">COGNITIVE LOAD</span>
              <div className="w-32 h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-blue-500 w-1/4" />
              </div>
            </div>
            <ShieldCheck size={24} className="text-gray-400" />
          </div>
        </header>

        <section className="p-12 max-w-7xl mx-auto">
          {activeTab === 'terminal' ? (
            <div className="bg-black border border-white/10 rounded-[3rem] h-[70vh] p-10 font-mono text-xs shadow-2xl flex flex-col relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,100,255,0.03),transparent)]" />
              <div className="flex-grow overflow-y-auto space-y-3 relative z-10 scrollbar-hide">
                {terminalLogs.map((log, i) => (
                  <div key={i} className="flex gap-4">
                    <span className="text-gray-700 tabular-nums">[{log.time}]</span>
                    <span className={log.type === 'err' ? 'text-red-500 font-bold' : 'text-blue-400 italic'}>{`> ${log.msg}`}</span>
                  </div>
                ))}
              </div>
              <form 
                onSubmit={e => { e.preventDefault(); handleBotCommand(commandInput); setCommandInput(""); }}
                className="mt-6 pt-6 border-t border-white/5 flex gap-4 relative z-10"
              >
                <span className="text-white font-black">$</span>
                <input 
                  value={commandInput} 
                  onChange={e => setCommandInput(e.target.value)}
                  className="bg-transparent outline-none flex-grow caret-white" 
                  placeholder="Execute mainframe instruction..."
                  autoFocus
                />
              </form>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-bottom-10 duration-700">
              {tickets.map(ticket => (
                <div key={ticket.id} className="bg-white/5 border border-white/10 rounded-[3rem] p-10 hover:bg-white/[0.08] transition-all group relative overflow-hidden">
                  <div className="absolute top-0 right-10 w-20 h-1 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h4 className="font-black text-xl group-hover:text-blue-400 transition-colors">{ticket.subject}</h4>
                      <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-1">SENDER: {ticket.user} • {ticket.time}</p>
                    </div>
                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black border ${ticket.priority === 'High' ? 'bg-red-500/10 border-red-500/30 text-red-500' : 'bg-blue-500/10 border-blue-500/30 text-blue-500'}`}>
                      {ticket.priority}
                    </span>
                  </div>
                  <div className="bg-black/30 p-6 rounded-3xl border border-white/5 mb-8 text-sm text-gray-400 italic leading-relaxed">
                    "{ticket.content}"
                  </div>
                  <button 
                    onClick={() => { triggerNotification(`BOT REPLY QUEUED FOR ${ticket.user}`); botLog(`Reply sent to ${ticket.user}`); }}
                    className="w-full py-5 bg-white text-black font-black rounded-2xl text-[11px] uppercase tracking-[0.2em] hover:bg-gray-200 transition-all flex items-center justify-center gap-3"
                  >
                    <Send size={14} /> TRANSMIT REPLY
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Global Toast */}
      {showNotification && (
        <div className="fixed bottom-12 right-12 px-10 py-6 bg-white text-black rounded-[2.5rem] shadow-2xl z-[100] flex items-center gap-4 animate-in slide-in-from-right-10">
          <Check size={20} strokeWidth={4} />
          <span className="font-black text-[11px] uppercase tracking-widest">{notificationMsg}</span>
        </div>
      )}
    </div>
  );
};

export default App;
