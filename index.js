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
  ZapOff
} from 'lucide-react';

/**
 * SHER BOT MAINFRAME v10.0 - UNIFIED CORE (WEB + BOT)
 * * ARCHITECTURE:
 * - Unified Logic: Bot events and Web UI share a synchronized state.
 * - AI Engine: Gemini 2.5 Flash for intelligent responses.
 * - Emergency Protocol: Global lockdown affects both Bot interactions and Web UI.
 * - Render Compatible: Single-entry point optimized for cloud deployment.
 */

const apiKey = ""; // Runtime provides key

const App = () => {
  // --- AUTH & SESSION ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionUser, setSessionUser] = useState(null); 
  const [loginKey, setLoginKey] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // --- GLOBAL STATE (SHARED BY BOT & WEB) ---
  const [lockdownActive, setLockdownActive] = useState(false);
  const [tickets, setTickets] = useState([
    { id: '1024', user: 'Nexus_User', subject: 'Billing Inquiry', status: 'open', priority: 'high', time: '12m ago', messages: ["User: Why was I charged twice?"] },
    { id: '1025', user: 'Ghost_Admin', subject: 'Permission Error', status: 'pending', priority: 'medium', time: '45m ago', messages: ["User: Can't access the database logs."] },
  ]);

  // --- AI & TERMINAL STATE ---
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState([{ type: 'sys', msg: 'UNIFIED BOT-WEB CORE v10.0 INITIALIZED.' }]);
  const [commandInput, setCommandInput] = useState("");
  const [activeTab, setActiveTab] = useState('tickets');

  // --- NOTIFICATION STATE ---
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState("");

  // --- BOT LOGIC (SIMULATED EVENT EMITTERS) ---
  /**
   * In a real Node environment, these would be discord.js or telegram listeners.
   * Here, we unify the logic so the Web UI controls the Bot's virtual presence.
   */
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
        botLog("EMERGENCY LOCKDOWN INITIATED VIA TERMINAL.", "err");
        speakText("Global lockdown initiated.");
        break;
      case '/unlock':
        setLockdownActive(false);
        botLog("Lockdown rescinded via terminal.", "sys");
        speakText("Lockdown lifted.");
        break;
      case '/clear':
        setTerminalLogs([]);
        break;
      default:
        botLog(`Executing generic command: ${cmd}`, "sys");
    }
  };

  // --- GEMINI AI UTILS ---
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
          contents: [{ parts: [{ text: `Say in a sharp, authoritative robotic voice: ${text}` }] }],
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
    } catch (e) {
      console.error("TTS System Offline", e);
    }
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

  // --- UI ACTIONS ---
  const handleLogin = (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setTimeout(() => {
      if (loginKey === "ADMIN-MASTER") {
        setIsAuthenticated(true);
        setSessionUser({ id: 'Root_Admin', role: 'Owner' });
        botLog("Root user authenticated. AI-Web Link established.", "sys");
        speakText("Welcome back. Systems synchronized.");
      } else {
        setLoginError("Invalid Master Key");
        setIsLoggingIn(false);
      }
    }, 1000);
  };

  const triggerNotification = (msg) => {
    setNotificationMsg(msg);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
  };

  const toggleEmergencyLockdown = () => {
    if (sessionUser?.role !== 'Owner') return;
    const newState = !lockdownActive;
    setLockdownActive(newState);
    const msg = newState ? "/lockdown" : "/unlock";
    handleBotCommand(msg);
    triggerNotification(newState ? "BOT & WEB LOCKED" : "SYSTEMS RESUMED");
  };

  // --- COMPONENTS ---
  const SherBotLogo = ({ size = "text-2xl" }) => (
    <div className={`font-black tracking-[0.25em] uppercase ${size} select-none flex items-center gap-2`}>
      <span className="bg-white text-black px-2 py-0.5 rounded shadow-lg shadow-white/10">SHER</span>
      <span className="text-white">BOT</span>
    </div>
  );

  const TerminalView = () => (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex justify-between items-center px-4">
         <h2 className="font-black text-xs uppercase text-gray-500 tracking-[0.2em] flex items-center gap-2">
            <Terminal size={14} /> Unified Core Terminal
         </h2>
         <div className="flex gap-2">
            <button 
              onClick={() => handleBotCommand('/clear')}
              className="text-[10px] font-black text-gray-500 hover:text-white px-2 py-1"
            >
              CLEAR
            </button>
            <div className="text-[10px] font-black text-blue-500 bg-blue-500/10 px-2 py-1 rounded">BOT_V10_STABLE</div>
         </div>
      </div>
      <div className="bg-black/80 rounded-[2.5rem] border border-white/10 h-[65vh] p-10 font-mono text-sm space-y-3 overflow-y-auto shadow-2xl backdrop-blur-md">
         {terminalLogs.map((l, i) => (
           <div key={i} className="flex gap-4 group">
              <span className="text-gray-700 whitespace-nowrap text-[10px] pt-1">{l.time || '--:--:--'}</span>
              <span className={l.type === 'err' ? 'text-red-500 font-bold' : l.type === 'sys' ? 'text-blue-400 italic' : 'text-gray-300'}>
                {`> ${l.msg}`}
              </span>
           </div>
         ))}
         {!lockdownActive && (
           <form onSubmit={(e) => { e.preventDefault(); handleBotCommand(commandInput); setCommandInput(""); }} className="flex gap-2 mt-4">
              <span className="text-white font-black whitespace-nowrap">SHER@UNIFIED:~$</span>
              <input 
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                className="bg-transparent outline-none border-none text-white flex-grow caret-blue-500" 
                placeholder="Enter command..."
                autoFocus 
              />
           </form>
         )}
         {lockdownActive && (
           <div className="text-red-500/50 font-black italic flex items-center gap-2 animate-pulse">
              <ZapOff size={14} /> COMMAND_INPUT_DISABLED_BY_PROTOCOL_X
           </div>
         )}
      </div>
    </div>
  );

  const SupportHub = () => (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
       {lockdownActive && (
          <div className="bg-red-600/20 border border-red-500/50 p-6 rounded-[2rem] flex items-center gap-6 backdrop-blur-md">
             <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center animate-pulse shadow-lg shadow-red-600/40">
                <AlertTriangle className="text-white" size={28} />
             </div>
             <div>
                <h3 className="font-black text-lg text-red-500 uppercase tracking-tight">System-Wide Lockdown Active</h3>
                <p className="text-sm text-red-400/80 font-medium italic">All external bot responses and web ticket updates are currently halted.</p>
             </div>
          </div>
       )}

       <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {tickets.map(ticket => (
            <div key={ticket.id} className={`group relative bg-white/5 border border-white/10 rounded-[2.5rem] p-8 transition-all ${lockdownActive ? 'opacity-40 grayscale' : 'hover:bg-white/[0.08] hover:border-white/20'}`}>
               <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-5">
                     <div className="w-16 h-16 bg-gradient-to-br from-gray-800 to-black rounded-3xl flex items-center justify-center border border-white/10 text-xl font-black text-white shadow-xl">
                        {ticket.user.charAt(0)}
                     </div>
                     <div>
                        <h4 className="font-black text-xl tracking-tight">{ticket.subject}</h4>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">@{ticket.user} • {ticket.time}</p>
                     </div>
                  </div>
                  <div className="px-4 py-1.5 bg-white/5 rounded-full border border-white/10 text-[10px] font-black text-gray-400">
                    ID: {ticket.id}
                  </div>
               </div>

               <div className="space-y-3 mb-8">
                  {ticket.messages.map((m, idx) => (
                    <div key={idx} className="text-sm text-gray-400 bg-black/20 p-4 rounded-2xl border border-white/5 font-medium italic leading-relaxed">
                       {m}
                    </div>
                  ))}
               </div>

               <div className="flex gap-4">
                  <button disabled={lockdownActive} className="flex-grow py-4 bg-white text-black hover:bg-gray-200 rounded-2xl text-xs font-black transition-all disabled:opacity-30 flex items-center justify-center gap-2">
                     <Send size={14} /> REPLY VIA BOT
                  </button>
                  <button 
                    onClick={() => {
                      setIsAiLoading(true);
                      triggerNotification("AI Analysis in progress...");
                      setTimeout(() => { setIsAiLoading(false); triggerNotification("AI Draft ready."); }, 1500);
                    }}
                    disabled={lockdownActive || isAiLoading}
                    className="p-4 bg-blue-600/10 text-blue-400 border border-blue-500/20 hover:bg-blue-600 hover:text-white rounded-2xl transition-all disabled:opacity-30"
                  >
                    {isAiLoading ? <RefreshCcw size={18} className="animate-spin" /> : <Sparkles size={18} />}
                  </button>
               </div>
            </div>
          ))}
       </div>
    </div>
  );

  if (!isAuthenticated) return (
    <div className="fixed inset-0 bg-neutral-950 flex items-center justify-center p-6 overflow-hidden">
      <div className="absolute inset-0 opacity-20">
         <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_70%)]" />
         <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
      </div>
      <div className="relative w-full max-w-md animate-in zoom-in-95 fade-in duration-1000">
        <div className="text-center mb-12">
          <SherBotLogo size="text-5xl" />
          <p className="text-gray-600 font-black tracking-[0.4em] text-[9px] uppercase mt-6">Unified Autonomous Intelligence</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4 p-12 rounded-[3rem] bg-white/5 border border-white/10 backdrop-blur-3xl shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest ml-1">Universal Access Key</label>
            <input 
              type="password" 
              value={loginKey}
              onChange={(e) => setLoginKey(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-black/40 border border-white/10 rounded-2xl py-5 px-8 text-white focus:outline-none focus:border-white/40 transition-all font-mono text-center tracking-widest"
              required
            />
          </div>
          <button type="submit" className="w-full py-5 bg-white text-black hover:bg-gray-200 font-black rounded-2xl transition-all flex items-center justify-center gap-3 active:scale-95 shadow-xl shadow-white/5">
            {isLoggingIn ? <RefreshCcw className="animate-spin" size={20} /> : <Unlock size={20} />}
            INITIALIZE CORE
          </button>
          {loginError && <p className="text-red-500 text-[10px] font-black text-center uppercase tracking-widest mt-6 animate-bounce">{loginError}</p>}
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans selection:bg-white selection:text-black">
      {/* Sidebar */}
      <nav className="fixed left-0 top-0 bottom-0 w-80 bg-black/40 border-r border-white/10 z-50 flex flex-col backdrop-blur-3xl">
        <div className="p-10 border-b border-white/10">
          <SherBotLogo />
        </div>
        <div className="p-8 flex-grow space-y-3">
          {[
            { id: 'tickets', label: 'Support Hub', icon: <Ticket size={18}/> },
            { id: 'terminal', label: 'Unified Terminal', icon: <Terminal size={18}/> },
            { id: 'config', label: 'Bot Config', icon: <Bot size={18}/> },
          ].map(item => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-5 px-7 py-4 rounded-2xl font-black text-xs transition-all tracking-tight ${activeTab === item.id ? 'bg-white text-black shadow-2xl shadow-white/10' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
            >
              {item.icon} {item.label.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="p-8 border-t border-white/10 space-y-4">
          <button 
            onClick={toggleEmergencyLockdown} 
            className={`w-full flex items-center justify-center gap-3 px-6 py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border ${lockdownActive ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/30' : 'bg-transparent border-red-900/50 text-red-500 hover:bg-red-500/10'}`}
          >
            <Radio className={lockdownActive ? 'animate-pulse' : ''} size={16} />
            {lockdownActive ? "LOCKDOWN ACTIVE" : "INITIATE LOCKDOWN"}
          </button>
          <button onClick={() => setIsAuthenticated(false)} className="w-full flex items-center justify-center gap-4 py-4 text-gray-600 hover:text-gray-300 font-black text-[10px] uppercase tracking-widest transition-all">
            <Power size={18} /> TERMINATE SESSION
          </button>
        </div>
      </nav>

      {/* Main Panel */}
      <div className="pl-80 pt-24">
        <header className="fixed top-0 right-0 left-80 h-24 bg-black/10 backdrop-blur-2xl border-b border-white/10 z-40 flex items-center justify-between px-16">
          <div className="flex items-center gap-4">
             <div className={`w-3 h-3 rounded-full ${lockdownActive ? 'bg-red-600' : 'bg-green-500'} shadow-[0_0_15px_rgba(34,197,94,0.3)] animate-pulse`} />
             <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase text-white tracking-[0.2em]">
                  {lockdownActive ? "PROTOCOL: STASIS" : "MAIN_CORE: ONLINE"}
                </span>
                <span className="text-[9px] text-gray-600 font-bold tracking-widest uppercase">SYNCED WITH RENDER NODE_80</span>
             </div>
          </div>
          <div className="flex items-center gap-12">
             <div className="flex flex-col items-end">
                <span className="text-[10px] font-black text-white uppercase tracking-widest">AI Cognitive Load</span>
                <div className="w-32 h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
                   <div className="h-full bg-blue-500 w-1/4" />
                </div>
             </div>
             <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center">
                <ShieldCheck size={18} className="text-gray-400" />
             </div>
          </div>
        </header>

        <main className="p-16 max-w-7xl mx-auto min-h-screen relative">
          {activeTab === 'tickets' && <SupportHub />}
          {activeTab === 'terminal' && <TerminalView />}
          {activeTab === 'config' && (
             <div className="flex flex-col items-center justify-center h-[50vh] text-center gap-6 animate-pulse">
                <Bot size={64} className="text-gray-800" />
                <div className="space-y-1">
                   <p className="text-gray-500 font-black uppercase tracking-[0.4em] text-[10px]">Neural Configuration Offline</p>
                   <p className="text-gray-700 text-xs italic font-medium">Accessing Bot Prefs requires Class-5 Clearance.</p>
                </div>
             </div>
          )}
        </main>
      </div>

      {showNotification && (
        <div className={`fixed bottom-12 right-12 px-10 py-6 rounded-[2.5rem] shadow-2xl z-[100] animate-in slide-in-from-right-20 flex items-center gap-5 backdrop-blur-3xl border ${lockdownActive ? 'bg-red-600 border-red-500 text-white' : 'bg-white border-white text-black'}`}>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${lockdownActive ? 'bg-red-500' : 'bg-blue-600 text-white'}`}>
             <Check size={24} strokeWidth={4} />
          </div>
          <p className="text-sm font-black uppercase tracking-tight leading-none">{notificationMsg}</p>
        </div>
      )}
    </div>
  );
};

export default App;
