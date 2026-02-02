import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShieldAlert, 
  Ticket, 
  Trash2, 
  Settings, 
  UserPlus, 
  Search, 
  Lock, 
  Unlock, 
  Plus, 
  X, 
  Check, 
  AlertCircle, 
  Eye, 
  MessageSquare, 
  Layout, 
  List, 
  UserCheck, 
  ChevronRight,
  ShieldCheck, 
  Power, 
  RefreshCcw, 
  Clock, 
  MoreVertical, 
  Bell, 
  HardDrive,
  Sparkles, 
  Zap, 
  Cpu, 
  Volume2, 
  Key, 
  Fingerprint, 
  Send, 
  Terminal, 
  ShieldX, 
  UserX, 
  MicOff, 
  Database, 
  Archive, 
  Filter, 
  Palette, 
  Layers, 
  Wrench, 
  AlertTriangle, 
  Radio, 
  BrainCircuit, 
  Languages, 
  Bot,
  ZapOff,
  Server
} from 'lucide-react';

/**
 * SHER BOT MAINFRAME v11.0 - RENDER OPTIMIZED
 * * FIXES:
 * - Resolved 'Unexpected token <' by ensuring code is processed as JSX.
 * - Added 'Server ID' requirement for authentication.
 * - Synchronized Bot and Web logic for unified management.
 */

const apiKey = ""; // Runtime provides key

const App = () => {
  // --- AUTH & SESSION ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionUser, setSessionUser] = useState(null); 
  const [loginKey, setLoginKey] = useState("");
  const [serverId, setServerId] = useState(""); // NEW FIELD
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // --- GLOBAL STATE ---
  const [lockdownActive, setLockdownActive] = useState(false);
  const [tickets, setTickets] = useState([
    { id: '1024', user: 'Nexus_User', subject: 'Billing Inquiry', status: 'open', priority: 'high', time: '12m ago', messages: ["User: Why was I charged twice?"] },
    { id: '1025', user: 'Ghost_Admin', subject: 'Permission Error', status: 'pending', priority: 'medium', time: '45m ago', messages: ["User: Can't access the database logs."] },
  ]);

  // --- AI & TERMINAL STATE ---
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState([{ type: 'sys', msg: 'CORE V11.0 INITIALIZED ON RENDER NODE.' }]);
  const [commandInput, setCommandInput] = useState("");
  const [activeTab, setActiveTab] = useState('tickets');

  // --- NOTIFICATION STATE ---
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState("");

  const botLog = (msg, type = 'sys') => {
    setTerminalLogs(prev => [...prev, { type, msg: `[BOT_CORE] ${msg}`, time: new Date().toLocaleTimeString() }]);
  };

  const handleBotCommand = (cmd) => {
    if (lockdownActive && !cmd.startsWith('/unlock')) {
      botLog("Command rejected: Lockdown active.", "err");
      return;
    }
    
    switch (cmd.toLowerCase()) {
      case '/lockdown':
        setLockdownActive(true);
        botLog(`SYSTEM LOCKDOWN INITIATED FOR SERVER: ${serverId}`, "err");
        speakText("Global lockdown initiated.");
        break;
      case '/unlock':
        setLockdownActive(false);
        botLog(`Lockdown rescinded for server: ${serverId}`, "sys");
        speakText("Lockdown lifted.");
        break;
      case '/clear':
        setTerminalLogs([]);
        break;
      default:
        botLog(`Executing: ${cmd}`, "sys");
    }
  };

  // --- AI UTILS ---
  const callGemini = async (prompt, systemInstruction = "") => {
    let retries = 0;
    const delays = [1000, 2000, 4000, 8000, 16000];
    const fetchAi = async () => {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            systemInstruction: { parts: [{ text: systemInstruction }] }
          })
        });
        const result = await response.json();
        return result.candidates?.[0]?.content?.parts?.[0]?.text;
      } catch (error) {
        if (retries < 5) {
          await new Promise(res => setTimeout(res, delays[retries++]));
          return fetchAi();
        }
        throw error;
      }
    };
    return fetchAi();
  };

  const speakText = async (text) => {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Say authoritative: ${text}` }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } }
          }
        })
      });
      const result = await response.json();
      const pcmData = result.candidates[0].content.parts[0].inlineData.data;
      const audioBlob = pcmToWav(pcmData, 24000);
      const audio = new Audio(URL.createObjectURL(audioBlob));
      audio.play();
    } catch (e) { console.error("Audio Error", e); }
  };

  const pcmToWav = (base64Pcm, sampleRate) => {
    const binaryString = window.atob(base64Pcm);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);
    const writeString = (offset, string) => { for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i)); };
    writeString(0, 'RIFF'); view.setUint32(4, 32 + len, true); writeString(8, 'WAVE');
    writeString(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    writeString(36, 'data'); view.setUint32(40, len, true);
    return new Blob([wavHeader, bytes], { type: 'audio/wav' });
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (!serverId || serverId.length < 5) {
      setLoginError("Valid Server ID required");
      return;
    }
    setIsLoggingIn(true);
    setTimeout(() => {
      if (loginKey === "ADMIN-MASTER") {
        setIsAuthenticated(true);
        setSessionUser({ id: 'Root_Admin', server: serverId });
        botLog(`Sync established with Server ${serverId}`, "sys");
        speakText("Initialization complete.");
      } else {
        setLoginError("Invalid Master Key");
        setIsLoggingIn(false);
      }
    }, 800);
  };

  const triggerNotification = (msg) => {
    setNotificationMsg(msg);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
  };

  const toggleEmergencyLockdown = () => {
    const newState = !lockdownActive;
    setLockdownActive(newState);
    handleBotCommand(newState ? "/lockdown" : "/unlock");
    triggerNotification(newState ? "SERVER LOCKED" : "SERVER ONLINE");
  };

  const SherBotLogo = ({ size = "text-2xl" }) => (
    <div className={`font-black tracking-[0.25em] uppercase ${size} select-none flex items-center gap-2`}>
      <span className="bg-white text-black px-2 py-0.5 rounded">SHER</span>
      <span className="text-white">BOT</span>
    </div>
  );

  if (!isAuthenticated) return (
    <div className="fixed inset-0 bg-neutral-950 flex items-center justify-center p-6 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.05),transparent_50%)]" />
      <div className="relative w-full max-w-md animate-in zoom-in-95 fade-in duration-500">
        <div className="text-center mb-10">
          <SherBotLogo size="text-4xl" />
          <p className="text-gray-600 font-black tracking-[0.3em] text-[8px] uppercase mt-4">Unified Bot & Web Interface</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4 p-10 rounded-[2.5rem] bg-white/5 border border-white/10 backdrop-blur-3xl shadow-2xl">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest ml-1 flex items-center gap-2">
              <Server size={10} /> Server ID
            </label>
            <input 
              type="text" 
              value={serverId}
              onChange={(e) => setServerId(e.target.value)}
              placeholder="SVR-0000-0000"
              className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-white/30 transition-all font-mono uppercase text-center"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest ml-1 flex items-center gap-2">
              <Key size={10} /> Master Key
            </label>
            <input 
              type="password" 
              value={loginKey}
              onChange={(e) => setLoginKey(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-white/30 transition-all font-mono text-center"
              required
            />
          </div>
          <button type="submit" className="w-full py-4 bg-white text-black hover:bg-gray-200 font-black rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-white/5">
            {isLoggingIn ? <RefreshCcw className="animate-spin" size={20} /> : <Unlock size={20} />}
            CONNECT CORE
          </button>
          {loginError && <p className="text-red-500 text-[10px] font-black text-center uppercase tracking-widest mt-4">{loginError}</p>}
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans selection:bg-white selection:text-black">
      {/* Sidebar */}
      <nav className="fixed left-0 top-0 bottom-0 w-80 bg-black/40 border-r border-white/10 z-50 flex flex-col backdrop-blur-3xl">
        <div className="p-10 border-b border-white/10"><SherBotLogo /></div>
        <div className="p-8 flex-grow space-y-3">
          {[
            { id: 'tickets', label: 'Support Hub', icon: <Ticket size={18}/> },
            { id: 'terminal', label: 'Bot Terminal', icon: <Terminal size={18}/> },
          ].map(item => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-5 px-7 py-4 rounded-2xl font-black text-[10px] uppercase tracking-wider transition-all ${activeTab === item.id ? 'bg-white text-black' : 'text-gray-500 hover:text-white'}`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>
        <div className="p-8 border-t border-white/10 space-y-4">
          <button onClick={toggleEmergencyLockdown} className={`w-full flex items-center justify-center gap-3 px-6 py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border ${lockdownActive ? 'bg-red-600 border-red-500 text-white' : 'bg-transparent border-red-900/50 text-red-500 hover:bg-red-500/10'}`}>
            <Radio size={16} /> {lockdownActive ? "LOCKDOWN ACTIVE" : "INITIATE LOCKDOWN"}
          </button>
          <button onClick={() => setIsAuthenticated(false)} className="w-full flex items-center justify-center gap-4 py-4 text-gray-600 font-black text-[10px] uppercase">
            <Power size={18} /> DISCONNECT
          </button>
        </div>
      </nav>

      <div className="pl-80 pt-24">
        <header className="fixed top-0 right-0 left-80 h-24 bg-black/10 backdrop-blur-2xl border-b border-white/10 z-40 flex items-center justify-between px-16">
          <div className="flex items-center gap-4">
             <div className={`w-3 h-3 rounded-full ${lockdownActive ? 'bg-red-600' : 'bg-green-500'} animate-pulse`} />
             <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase text-white tracking-[0.2em]">{lockdownActive ? "PROTOCOL: STASIS" : "NODE: ACTIVE"}</span>
                <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">SERVER ID: {serverId}</span>
             </div>
          </div>
        </header>

        <main className="p-16 max-w-7xl mx-auto min-h-screen">
          {activeTab === 'tickets' && (
             <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 animate-in slide-in-from-bottom-4 duration-500">
                {tickets.map(ticket => (
                  <div key={ticket.id} className={`bg-white/5 border border-white/10 rounded-[2.5rem] p-8 transition-all ${lockdownActive ? 'opacity-40 grayscale' : 'hover:border-white/20'}`}>
                    <div className="flex justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center font-black">{ticket.user.charAt(0)}</div>
                        <div>
                          <h4 className="font-black text-lg">{ticket.subject}</h4>
                          <p className="text-[10px] text-gray-500 font-black uppercase">@{ticket.user}</p>
                        </div>
                      </div>
                      <div className="text-[10px] font-black text-gray-500">ID: {ticket.id}</div>
                    </div>
                    <button disabled={lockdownActive} className="w-full py-4 bg-white text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all flex items-center justify-center gap-2">
                       <Send size={14} /> SEND BOT REPLY
                    </button>
                  </div>
                ))}
             </div>
          )}

          {activeTab === 'terminal' && (
             <div className="space-y-4 animate-in fade-in duration-500">
                <div className="bg-black/90 rounded-[2.5rem] border border-white/10 h-[60vh] p-10 font-mono text-xs space-y-3 overflow-y-auto">
                   {terminalLogs.map((l, i) => (
                     <div key={i} className="flex gap-4">
                        <span className="text-gray-700">{l.time || '--:--'}</span>
                        <span className={l.type === 'err' ? 'text-red-500' : 'text-blue-400 italic'}>{`> ${l.msg}`}</span>
                     </div>
                   ))}
                   {!lockdownActive && (
                     <form onSubmit={(e) => { e.preventDefault(); handleBotCommand(commandInput); setCommandInput(""); }} className="flex gap-2">
                        <span className="text-white font-bold">SHER@BOT:~$</span>
                        <input value={commandInput} onChange={(e) => setCommandInput(e.target.value)} className="bg-transparent outline-none flex-grow" autoFocus />
                     </form>
                   )}
                </div>
             </div>
          )}
        </main>
      </div>

      {showNotification && (
        <div className={`fixed bottom-12 right-12 px-10 py-6 rounded-3xl shadow-2xl z-[100] animate-in slide-in-from-right-10 flex items-center gap-4 border ${lockdownActive ? 'bg-red-600 border-red-500' : 'bg-white text-black border-white'}`}>
          <p className="text-xs font-black uppercase tracking-widest">{notificationMsg}</p>
        </div>
      )}
    </div>
  );
};

export default App;
