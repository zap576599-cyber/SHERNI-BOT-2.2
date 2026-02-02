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
  Bot
} from 'lucide-react';

/**
 * SHER BOT MAINFRAME v9.0 - AI ENHANCED
 * * INTEGRATIONS:
 * - Gemini 2.5 Flash for Support Response Generation
 * - Gemini 2.5 Flash for Terminal Command Suggestions
 * - Gemini TTS for Audio Feedback
 */

const apiKey = ""; // Runtime provides key

const App = () => {
  // --- AUTH & SESSION ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionUser, setSessionUser] = useState(null); 
  const [loginKey, setLoginKey] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // --- GLOBAL EMERGENCY STATE ---
  const [lockdownActive, setLockdownActive] = useState(false);

  // --- AI STATE ---
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState("");

  // --- TICKET STATE ---
  const [tickets, setTickets] = useState([
    { id: '1024', user: 'Nexus_User', subject: 'Billing Inquiry', status: 'open', priority: 'high', time: '12m ago', messages: ["User: Why was I charged twice?", "System: Automated check in progress."] },
    { id: '1025', user: 'Ghost_Admin', subject: 'Permission Error', status: 'pending', priority: 'medium', time: '45m ago', messages: ["User: Can't access the database logs."] },
    { id: '1026', user: 'Viper_99', subject: 'Bug Report: Login UI', status: 'closed', priority: 'low', time: '2h ago', messages: ["User: The login button is misaligned on mobile."] },
  ]);
  const [activeTicketFilter, setActiveTicketFilter] = useState('all');

  // --- SYSTEM STATE ---
  const [activeTab, setActiveTab] = useState('tickets');
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState("");
  const [terminalLogs, setTerminalLogs] = useState([{ type: 'sys', msg: 'SHER BOT MAINFRAME v9.0 AI-CORE Initialized.' }]);

  // --- GEMINI API UTILS ---
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
          contents: [{ parts: [{ text: `Say in a calm, professional robotic voice: ${text}` }] }],
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
      console.error("TTS Failed", e);
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

  // --- AI FEATURES ---
  const generateSupportReply = async (ticket) => {
    setIsAiLoading(true);
    try {
      const prompt = `Generate a professional, helpful support reply for this ticket: 
      User: ${ticket.user} 
      Subject: ${ticket.subject} 
      Context: ${ticket.messages.join(" | ")}`;
      const reply = await callGemini(prompt, "You are SHER BOT, a helpful AI management assistant. Keep replies concise, professional, and bold.");
      setAiSuggestion(reply);
      triggerNotification("AI Response Drafted ✨");
    } catch (e) {
      triggerNotification("AI Engine Timeout");
    } finally {
      setIsAiLoading(false);
    }
  };

  const suggestCommand = async () => {
    setIsAiLoading(true);
    try {
      const logs = terminalLogs.slice(-5).map(l => l.msg).join("\n");
      const prompt = `Based on these terminal logs, suggest the most logical next administrative command (e.g., /ban, /lockdown, /clear): \n${logs}`;
      const suggestion = await callGemini(prompt, "Suggest only the command string, nothing else.");
      setTerminalLogs(prev => [...prev, { type: 'sys', msg: `✨ AI Suggestion: ${suggestion}` }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  // --- CORE LOGIC ---
  const handleLogin = (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setTimeout(() => {
      if (loginKey === "ADMIN-MASTER") {
        setIsAuthenticated(true);
        setSessionUser({ id: 'Root_Admin', role: 'Owner' });
        speakText("Welcome back, Root Admin. AI modules are online.");
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
    speakText(newState ? "Initiating emergency lockdown. All systems secured." : "Lockdown lifted. Resuming normal operations.");
    triggerNotification(newState ? "EMERGENCY LOCKDOWN ACTIVATED" : "System Lockdown Rescinded");
  };

  // --- COMPONENTS ---
  const SherBotLogo = ({ size = "text-2xl", color = "text-white" }) => (
    <div className={`font-black tracking-[0.2em] uppercase ${size} ${color} select-none flex items-center gap-3`}>
      <span className="bg-white text-black px-2 py-0.5 rounded">SHER</span>
      <span>BOT</span>
    </div>
  );

  const TicketManagementView = () => {
    const filteredTickets = tickets.filter(t => activeTicketFilter === 'all' || t.status === activeTicketFilter);

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
        {lockdownActive && (
          <div className="bg-red-600 p-4 rounded-2xl flex items-center justify-between border border-red-500 shadow-xl shadow-red-600/20 animate-pulse">
            <div className="flex items-center gap-3">
              <AlertTriangle className="text-white" size={24} />
              <div>
                <p className="font-black text-sm uppercase">Emergency Lockdown Active</p>
                <p className="text-xs opacity-80">All messaging and modifications are currently suspended.</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'AI Health', val: 'OPTIMAL ✨', color: 'text-blue-400' },
            { label: 'Active Tickets', val: tickets.length, color: 'text-white' },
            { label: 'AI Tokens Used', val: '4.2k', color: 'text-gray-400' },
            { label: 'Security Status', val: lockdownActive ? 'LOCKED' : 'NOMINAL', color: lockdownActive ? 'text-red-500' : 'text-green-500' },
          ].map((s, i) => (
            <div key={i} className="p-5 bg-white/5 border border-white/10 rounded-[1.5rem]">
              <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-1">{s.label}</p>
              <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {filteredTickets.map(ticket => (
            <div key={ticket.id} className={`group relative bg-white/5 border border-white/10 rounded-[2rem] p-6 transition-all ${lockdownActive ? 'opacity-60 grayscale' : 'hover:border-white/40 hover:bg-white/[0.07]'}`}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-lg font-black text-white">
                    {ticket.user.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-black text-lg">{ticket.subject}</h4>
                    <p className="text-xs text-gray-500 font-medium">@{ticket.user} • {ticket.time}</p>
                  </div>
                </div>
                <button 
                  onClick={() => generateSupportReply(ticket)}
                  disabled={isAiLoading || lockdownActive}
                  className="flex items-center gap-2 bg-blue-600/20 text-blue-400 px-3 py-1.5 rounded-xl text-[10px] font-black hover:bg-blue-600 hover:text-white transition-all border border-blue-500/30"
                >
                  {isAiLoading ? <RefreshCcw className="animate-spin" size={12} /> : <Sparkles size={12} />}
                  ✨ AI DRAFT
                </button>
              </div>

              {aiSuggestion && (
                 <div className="mb-4 p-4 bg-blue-600/5 border border-blue-500/20 rounded-2xl text-xs text-blue-300 font-medium leading-relaxed italic">
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-[10px] font-black text-blue-500 uppercase tracking-tighter">AI-Generated Draft</span>
                       <button onClick={() => setAiSuggestion("")}><X size={12} /></button>
                    </div>
                    "{aiSuggestion}"
                 </div>
              )}

              <div className="flex gap-3 mt-6">
                <button disabled={lockdownActive} className="flex-grow flex items-center justify-center gap-2 py-3 bg-white text-black hover:bg-gray-200 rounded-xl text-xs font-black transition-all disabled:opacity-50">
                   <MessageSquare size={14} /> SEND MESSAGE
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!isAuthenticated) return (
    <div className="fixed inset-0 bg-neutral-950 flex items-center justify-center p-6 font-sans overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.05),transparent_50%)]" />
      <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-700">
        <div className="text-center mb-12">
          <SherBotLogo size="text-4xl" />
          <p className="text-gray-500 font-bold tracking-[0.3em] text-[10px] uppercase mt-4">AI Autonomous Management Core</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4 p-10 rounded-[2.5rem] bg-white/5 border border-white/10 backdrop-blur-2xl">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest ml-1">Master Access Key</label>
            <input 
              type="password" 
              value={loginKey}
              onChange={(e) => setLoginKey(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-white/40 transition-all font-mono"
              required
            />
          </div>
          <button type="submit" className="w-full py-4 bg-white text-black hover:bg-gray-200 font-black rounded-2xl transition-all flex items-center justify-center gap-2">
            {isLoggingIn ? <RefreshCcw className="animate-spin" size={20} /> : <Unlock size={20} />}
            AUTHENTICATE
          </button>
          {loginError && <p className="text-red-500 text-[10px] font-black text-center uppercase tracking-widest mt-4">{loginError}</p>}
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans">
      <nav className="fixed left-0 top-0 bottom-0 w-80 bg-black/40 border-r border-white/10 z-50 flex flex-col backdrop-blur-3xl">
        <div className="p-10 border-b border-white/10">
          <SherBotLogo />
        </div>
        <div className="p-8 flex-grow space-y-2">
          {[
            { id: 'tickets', label: 'Support Hub ✨', icon: <Ticket size={20}/> },
            { id: 'terminal', label: 'AI Terminal ✨', icon: <Terminal size={20}/> },
          ].map(item => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-5 px-6 py-4 rounded-[1.25rem] font-black text-sm transition-all ${activeTab === item.id ? 'bg-white text-black' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>
        <div className="p-8 border-t border-white/10 space-y-4">
          <button onClick={toggleEmergencyLockdown} className={`w-full flex items-center justify-center gap-3 px-6 py-4 rounded-[1.25rem] font-black text-xs transition-all border ${lockdownActive ? 'bg-red-600 border-red-500 text-white' : 'bg-transparent border-red-900/50 text-red-500 hover:bg-red-500/10'}`}>
            <Radio className={lockdownActive ? 'animate-pulse' : ''} size={18} />
            {lockdownActive ? "LOCKED" : "LOCKDOWN"}
          </button>
          <button onClick={() => setIsAuthenticated(false)} className="w-full flex items-center gap-4 px-6 py-4 text-gray-500 hover:text-white rounded-[1.25rem] font-black text-sm transition-all">
            <Power size={20} /> DISCONNECT
          </button>
        </div>
      </nav>

      <div className="pl-80 pt-20">
        <header className="fixed top-0 right-0 left-80 h-20 bg-black/20 backdrop-blur-xl border-b border-white/10 z-40 flex items-center justify-between px-12">
          <div className="flex items-center gap-3">
             <div className={`w-2 h-2 rounded-full ${lockdownActive ? 'bg-red-500' : 'bg-green-500'} animate-pulse`} />
             <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">
               {lockdownActive ? "AI Stasis Mode" : "AI Cognitive Link Active"}
             </span>
          </div>
          <div className="flex items-center gap-4">
             <span className="text-[10px] font-black text-gray-500 tracking-widest uppercase">✨ Gemini 2.5 Flash</span>
          </div>
        </header>

        <main className="p-12 max-w-7xl mx-auto min-h-screen">
          {activeTab === 'tickets' && <TicketManagementView />}
          {activeTab === 'terminal' && (
             <div className="space-y-4">
                <div className="flex justify-between items-center px-4">
                   <h2 className="font-black text-xs uppercase text-gray-500 tracking-[0.2em]">Neural Command Shell</h2>
                   <button 
                    onClick={suggestCommand}
                    disabled={isAiLoading || lockdownActive}
                    className="text-[10px] font-black bg-blue-600/10 text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded-xl hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2"
                   >
                    {isAiLoading ? <RefreshCcw size={12} className="animate-spin" /> : <Bot size={12} />}
                    ✨ GET AI SUGGESTION
                   </button>
                </div>
                <div className="bg-black rounded-[2rem] border border-white/10 h-[60vh] p-10 font-mono text-sm space-y-2 overflow-y-auto">
                   {terminalLogs.map((l, i) => (
                     <div key={i} className={l.type === 'err' ? 'text-red-500' : l.type === 'sys' ? 'text-blue-400 italic' : 'text-gray-400'}>{`> ${l.msg}`}</div>
                   ))}
                   {!lockdownActive && (
                     <div className="flex gap-2">
                        <span className="text-white font-black">AI-SHER@BOT:~$</span>
                        <input className="bg-transparent outline-none border-none text-white flex-grow" autoFocus />
                     </div>
                   )}
                </div>
             </div>
          )}
        </main>
      </div>

      {showNotification && (
        <div className={`fixed bottom-12 right-12 px-8 py-5 rounded-[2rem] shadow-2xl z-[100] animate-in slide-in-from-right-20 flex items-center gap-4 ${lockdownActive ? 'bg-red-600 text-white' : 'bg-white text-black'}`}>
          <p className="text-sm font-bold tracking-tight">{notificationMsg}</p>
        </div>
      )}
    </div>
  );
};

export default App;
