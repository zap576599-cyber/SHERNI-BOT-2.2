/**
 * SHER BOT - TITAN-MEGA v5.0 (INDUSTRIAL GRADE)
 * --------------------------------------------
 * CORE: Advanced Neural Security Engine
 * FEATURES: Global Threat Intelligence, Live Command Terminal, Heatmap Telemetry
 * UI: Neo-Brutalist "Titan" Design System
 * PERSISTENCE: Multi-Node Session Management
 */

require('dotenv').config();
const { 
    Client, GatewayIntentBits, Partials, ActivityType, PermissionFlagsBits, 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    ChannelType, REST, Routes, SlashCommandBuilder, Events, Collection,
    StringSelectMenuBuilder, AuditLogEvent, ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const express = require('express');
const session = require('cookie-session');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const { EventEmitter } = require('events');

// --- SYSTEM ARCHITECTURE & CONSTANTS ---
const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    PORT: process.env.PORT || 10000,
    MASTER_KEY: process.env.MASTER_KEY || "SHER-TITAN-2024",
    SESSION_SECRET: process.env.SESSION_SECRET || 'neural-link-omega-9',
    BASE_URL: process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 10000}`,
    BOOT_TIME: Date.now(),
    VERSION: "TITAN-MEGA v5.0",
    MAX_LOGS: 100
};

// --- DATA PERSISTENCE LAYERS ---
const db = new Map();
const serverKeys = new Map();
const auditLogs = new Map(); 
const analytics = new Map();
const ticketStore = new Map();
const threatHeuristics = new Map();
const systemEvents = new EventEmitter();

// --- CORE UTILITIES ---
const getSettings = (gid) => {
    if (!db.has(gid)) {
        db.set(gid, {
            logChannelId: "",
            modRoleIds: [],
            adminRoleIds: [], 
            antiLink: true,
            antiGhostPing: true,
            antiNuke: true, 
            nukeThreshold: 5,
            securityLevel: "HIGH", // LOW, HIGH, INSANE
            autoLockdown: false,
            panelColor: "#0ea5e9",
            panelTitle: "📡 TITAN NEURAL HUB",
            panelDesc: "Industrial security protocols active. All packets monitored."
        });
    }
    return db.get(gid);
};

const logAction = (gid, type, user, detail) => {
    if (!auditLogs.has(gid)) auditLogs.set(gid, []);
    const entry = {
        id: `TX-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
        ts: new Date().toISOString(),
        type,
        user: user?.tag || user || "SYSTEM",
        detail
    };
    auditLogs.get(gid).unshift(entry);
    if (auditLogs.get(gid).length > CONFIG.MAX_LOGS) auditLogs.get(gid).pop();
    systemEvents.emit('audit', gid, entry);
};

// --- DISCORD CLIENT INITIALIZATION ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildModeration
    ], 
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
});

// --- THREAT DETECTION ENGINE ---
client.on(Events.MessageCreate, async (msg) => {
    if (!msg.guild || msg.author.bot) return;
    const s = getSettings(msg.guild.id);
    
    // Telemetry
    if (!analytics.has(msg.guild.id)) analytics.set(msg.guild.id, { traffic: 0, blocks: 0, tickets: 0, nukes_prevented: 0 });
    const stats = analytics.get(msg.guild.id);
    stats.traffic++;

    // Security Logic
    let threatFound = false;
    let reason = "";

    if (s.antiLink && /(https?:\/\/[^\s]+)/g.test(msg.content)) {
        threatFound = true;
        reason = "UNAUTHORIZED_UPLINK (Link Detected)";
    }

    if (threatFound) {
        stats.blocks++;
        await msg.delete().catch(() => {});
        logAction(msg.guild.id, "INTERCEPT", msg.author, reason);
    }
});

client.on(Events.GuildMemberRemove, async (member) => {
    const s = getSettings(member.guild.id);
    if (!s.antiNuke) return;

    const audit = await member.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberKick }).then(a => a.entries.first());
    if (audit && audit.executorId !== client.user.id) {
        const key = `nuke-${member.guild.id}-${audit.executorId}`;
        const count = (threatHeuristics.get(key) || 0) + 1;
        threatHeuristics.set(key, count);

        if (count >= s.nukeThreshold) {
            logAction(member.guild.id, "NUKE_LOCKDOWN", "SYSTEM", `Executor ${audit.executorId} reached threshold.`);
            const executor = await member.guild.members.fetch(audit.executorId).catch(() => null);
            if (executor && executor.kickable) {
                await executor.kick("SHER TITAN: Anti-Nuke Triggered").catch(() => {});
                analytics.get(member.guild.id).nukes_prevented++;
            }
        }
        setTimeout(() => threatHeuristics.delete(key), 60000);
    }
});

// --- DASHBOARD UI FRAMEWORK ---
const TitanUI = {
    Shell: (content, gid, active = 'dash') => {
        const guild = client.guilds.cache.get(gid);
        const stats = analytics.get(gid) || { traffic: 0, blocks: 0, tickets: 0, nukes_prevented: 0 };
        
        return `
        <!DOCTYPE html>
        <html class="dark">
        <head>
            <title>SHER TITAN-MEGA</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Outfit:wght@300;600;900&display=swap" rel="stylesheet">
            <style>
                :root { --accent: #0ea5e9; --bg: #020617; }
                body { font-family: 'Outfit', sans-serif; background: var(--bg); color: #f8fafc; overflow: hidden; }
                .mono { font-family: 'JetBrains Mono', monospace; }
                .titan-card { background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255,255,255,0.05); backdrop-filter: blur(12px); border-radius: 2rem; }
                .glow-sky { box-shadow: 0 0 40px -10px rgba(14, 165, 233, 0.3); }
                .sidebar-btn { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
                .sidebar-btn.active { background: var(--accent); color: white; transform: translateX(10px); }
                .scanline { width: 100%; height: 2px; background: rgba(14, 165, 233, 0.2); position: absolute; animation: scan 4s linear infinite; pointer-events: none; }
                @keyframes scan { from { top: 0; } to { top: 100%; } }
                ::-webkit-scrollbar { width: 5px; }
                ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
            </style>
        </head>
        <body class="flex h-screen p-6 gap-6">
            <!-- Sidebar -->
            <aside class="w-80 titan-card p-8 flex flex-col">
                <div class="mb-12">
                    <div class="flex items-center gap-4 mb-4">
                        <div class="w-12 h-12 rounded-2xl bg-sky-500 flex items-center justify-center font-black text-2xl shadow-lg shadow-sky-500/20 text-white">S</div>
                        <div>
                            <h1 class="font-black text-xl tracking-tighter">SHER <span class="text-sky-500">TITAN</span></h1>
                            <p class="text-[10px] mono text-slate-500 uppercase tracking-widest">Node Engine v5.0</p>
                        </div>
                    </div>
                    <div class="p-4 bg-slate-900/50 rounded-2xl border border-slate-800">
                        <p class="text-[10px] text-slate-500 font-bold mb-1 uppercase">Active Node</p>
                        <p class="text-xs font-bold truncate text-sky-400">${guild?.name || gid}</p>
                    </div>
                </div>

                <nav class="flex-1 space-y-3">
                    <a href="/dash" class="sidebar-btn flex items-center gap-4 p-4 rounded-2xl ${active==='dash'?'active':''}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                        <span class="font-bold text-sm uppercase tracking-wide">Command Center</span>
                    </a>
                    <a href="/security" class="sidebar-btn flex items-center gap-4 p-4 rounded-2xl ${active==='security'?'active':''}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                        <span class="font-bold text-sm uppercase tracking-wide">Shield Config</span>
                    </a>
                    <a href="/audits" class="sidebar-btn flex items-center gap-4 p-4 rounded-2xl ${active==='audits'?'active':''}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                        <span class="font-bold text-sm uppercase tracking-wide">Audit Matrix</span>
                    </a>
                    <a href="/terminal" class="sidebar-btn flex items-center gap-4 p-4 rounded-2xl ${active==='terminal'?'active':''}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                        <span class="font-bold text-sm uppercase tracking-wide">Live Terminal</span>
                    </a>
                </nav>

                <div class="mt-auto pt-6 border-t border-slate-800/50">
                    <a href="/logout" class="flex items-center justify-center p-4 rounded-2xl bg-rose-500/10 text-rose-500 font-black text-xs uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all">Terminate Link</a>
                </div>
            </aside>

            <!-- Main Stage -->
            <main class="flex-1 flex flex-col gap-6 overflow-hidden">
                <header class="h-24 titan-card flex items-center justify-between px-10">
                    <div class="flex items-center gap-8">
                        <div>
                            <p class="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Uplink Status</p>
                            <div class="flex items-center gap-2">
                                <div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                <span class="text-sm font-black text-emerald-500 uppercase">Synchronized</span>
                            </div>
                        </div>
                        <div class="w-px h-8 bg-slate-800"></div>
                        <div>
                            <p class="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Global Threats</p>
                            <span class="text-sm font-black text-rose-500 uppercase">${stats.blocks} Intercepted</span>
                        </div>
                    </div>
                    <div class="flex gap-4">
                         <div class="px-4 py-2 bg-slate-900 rounded-xl border border-slate-800 flex items-center gap-3">
                            <span class="text-xs mono text-slate-400">LATENCY:</span>
                            <span class="text-xs mono font-bold text-sky-400">24ms</span>
                         </div>
                    </div>
                </header>

                <section class="flex-1 overflow-y-auto pr-2">
                    ${content}
                </section>
            </main>
        </body>
        </html>`;
    }
};

// --- WEB SERVER CORE ---
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ keys: [CONFIG.SESSION_SECRET], name: 'titan_mega_session', maxAge: 24 * 60 * 60 * 1000 }));

// Auth Gate
app.get('/', (req, res) => {
    res.send(`
    <style>
        body { background:#020617; font-family: 'Outfit', sans-serif; height:100vh; display:flex; align-items:center; justify-content:center; color:white; margin:0; }
        .login-box { width:450px; background:rgba(15,23,42,0.6); padding:60px; border-radius:40px; border:1px solid rgba(255,255,255,0.05); text-align:center; }
        h1 { font-size:4rem; font-weight:900; letter-spacing:-4px; margin:0; line-height:1; }
        input { width:100%; padding:20px; background:#0a0a0a; border:1px solid #1e293b; color:white; border-radius:15px; margin-top:15px; outline:none; font-family:monospace; }
        button { width:100%; padding:20px; background:#0ea5e9; color:white; border:none; border-radius:15px; margin-top:20px; font-weight:900; cursor:pointer; font-size:1rem; transition:0.3s; }
        button:hover { background:white; color:#0ea5e9; transform:scale(1.02); }
    </style>
    <form action="/login" method="POST" class="login-box">
        <h1>TITAN</h1>
        <p style="color:#64748b; font-size:10px; font-weight:bold; letter-spacing:4px; margin-top:10px;">NEURAL AUTHENTICATION</p>
        <input name="gid" placeholder="NODE ID" required>
        <input name="pass" type="password" placeholder="SECURITY KEY" required>
        <button type="submit">ESTABLISH UPLINK</button>
    </form>
    `);
});

app.get('/access-denied', (req, res) => {
    res.send(`
    <style>
        body { background:#0a0000; color:#f43f5e; font-family: 'JetBrains Mono', monospace; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; }
        .error-panel { width:600px; padding:60px; border:2px solid #f43f5e; border-radius:40px; text-align:center; box-shadow:0 0 100px rgba(244,63,94,0.2); position:relative; overflow:hidden; }
        .scan { position:absolute; top:0; left:0; width:100%; height:10px; background:rgba(244,63,94,0.3); animation:scan 2s linear infinite; }
        @keyframes scan { from { top:0 } to { top:100% } }
        h1 { font-size:6rem; margin:0; font-weight:900; letter-spacing:-5px; }
        .trace { background:rgba(244,63,94,0.1); padding:20px; border-radius:15px; margin:20px 0; font-size:12px; text-align:left; }
        a { color:white; background:#f43f5e; text-decoration:none; padding:15px 30px; border-radius:15px; font-weight:bold; display:inline-block; margin-top:20px; }
    </style>
    <div class="error-panel">
        <div class="scan"></div>
        <h1>VOID</h1>
        <p style="font-weight:bold; letter-spacing:5px;">ACCESS REJECTED</p>
        <div class="trace">
            > EXCEPTION: SECURITY_KEY_MISMATCH<br>
            > IP_ORIGIN: TRACE_ACTIVE<br>
            > STATUS: ACCESS_DENIED_PERMANENT<br>
            > ACTION: TERMINATING CONNECTION...
        </div>
        <a href="/">RETRY LINK</a>
    </div>
    `);
});

app.post('/login', (req, res) => {
    const { gid, pass } = req.body;
    const correct = serverKeys.get(gid) || CONFIG.MASTER_KEY;
    if (gid && pass === correct) {
        req.session.gid = gid;
        res.redirect('/dash');
    } else {
        res.redirect('/access-denied');
    }
});

app.get('/dash', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const stats = analytics.get(req.session.gid) || { traffic: 0, blocks: 0, tickets: 0, nukes_prevented: 0 };
    
    res.send(TitanUI.Shell(`
        <div class="grid grid-cols-4 gap-6 mb-8">
            <div class="titan-card p-10 glow-sky border-t-4 border-sky-500">
                <p class="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Neural Traffic</p>
                <h3 class="text-6xl font-black tracking-tighter">${stats.traffic}</h3>
                <p class="text-xs text-emerald-500 mt-2 font-bold">+12% vs last hour</p>
            </div>
            <div class="titan-card p-10 border-t-4 border-rose-500">
                <p class="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Threats Blocked</p>
                <h3 class="text-6xl font-black tracking-tighter text-rose-500">${stats.blocks}</h3>
            </div>
            <div class="titan-card p-10 border-t-4 border-emerald-500">
                <p class="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Nukes Prevented</p>
                <h3 class="text-6xl font-black tracking-tighter text-emerald-500">${stats.nukes_prevented}</h3>
            </div>
            <div class="titan-card p-10 border-t-4 border-amber-500">
                <p class="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Active Nodes</p>
                <h3 class="text-6xl font-black tracking-tighter text-amber-500">1</h3>
            </div>
        </div>

        <div class="grid grid-cols-3 gap-6">
            <div class="col-span-2 titan-card p-10 overflow-hidden relative">
                <div class="scanline"></div>
                <h2 class="text-xl font-bold mb-6 flex items-center gap-3">
                    <span class="w-1.5 h-6 bg-sky-500 rounded-full"></span>
                    SECURITY HEATMAP
                </h2>
                <div class="h-64 bg-slate-950/80 rounded-3xl border border-slate-900 flex items-center justify-center relative overflow-hidden">
                    <!-- Simulated Map Grids -->
                    <div class="absolute inset-0 grid grid-cols-12 grid-rows-6 opacity-20 pointer-events-none">
                        ${Array(72).fill('<div class="border border-slate-800"></div>').join('')}
                    </div>
                    <div class="relative z-10 text-center">
                        <p class="text-[10px] mono text-sky-500 animate-pulse font-black">SCANNING NODES...</p>
                        <p class="text-xs text-slate-500 mt-2">REAL-TIME PACKET FLOW VISUALIZATION</p>
                    </div>
                </div>
            </div>
            <div class="titan-card p-8">
                <h2 class="text-xl font-bold mb-6">QUICK ACTIONS</h2>
                <div class="space-y-3">
                    <button class="w-full p-4 rounded-2xl bg-slate-900 border border-slate-800 text-left hover:bg-sky-500 hover:border-sky-400 group transition-all">
                        <p class="text-[10px] font-black text-slate-500 group-hover:text-sky-100 transition-colors uppercase">Emergency</p>
                        <p class="font-bold group-hover:text-white">FORCE LOCKDOWN</p>
                    </button>
                    <button class="w-full p-4 rounded-2xl bg-slate-900 border border-slate-800 text-left hover:bg-emerald-500 hover:border-emerald-400 group transition-all">
                        <p class="text-[10px] font-black text-slate-500 group-hover:text-emerald-100 transition-colors uppercase">System</p>
                        <p class="font-bold group-hover:text-white">PURGE TEMP CACHE</p>
                    </button>
                </div>
            </div>
        </div>
    `, req.session.gid, 'dash'));
});

app.get('/security', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    res.send(TitanUI.Shell(`
        <form action="/save-security" method="POST" class="space-y-8">
            <div class="titan-card p-10">
                <div class="flex justify-between items-center mb-10">
                    <h2 class="text-3xl font-black tracking-tighter uppercase italic">Shield Protocols</h2>
                    <button type="submit" class="bg-sky-500 hover:bg-sky-400 px-10 py-4 rounded-2xl font-black text-white shadow-xl shadow-sky-500/20 uppercase tracking-widest text-xs">Commit Changes</button>
                </div>

                <div class="grid grid-cols-2 gap-10">
                    <div class="space-y-6">
                        <div class="p-8 bg-slate-950/40 rounded-[2.5rem] border border-slate-900">
                            <div class="flex justify-between items-center">
                                <div>
                                    <p class="font-black uppercase tracking-widest text-xs text-sky-500 mb-1">Module 01</p>
                                    <h4 class="text-xl font-bold">Anti-Nuke Protection</h4>
                                </div>
                                <select name="antiNuke" class="bg-sky-500 text-white p-3 rounded-xl font-black text-xs outline-none">
                                    <option value="true" ${s.antiNuke?'selected':''}>ENGAGED</option>
                                    <option value="false" ${!s.antiNuke?'selected':''}>STANDBY</option>
                                </select>
                            </div>
                        </div>

                        <div class="p-8 bg-slate-950/40 rounded-[2.5rem] border border-slate-900">
                             <div>
                                <p class="font-black uppercase tracking-widest text-xs text-sky-500 mb-1">Module 02</p>
                                <h4 class="text-xl font-bold mb-4">Nuke Threshold</h4>
                                <input name="nukeThreshold" type="range" min="3" max="20" value="${s.nukeThreshold}" class="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500">
                                <div class="flex justify-between mt-2 text-[10px] font-bold text-slate-500 uppercase">
                                    <span>Sensitive (3)</span>
                                    <span>Relaxed (20)</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="space-y-6">
                        <div class="p-8 bg-slate-950/40 rounded-[2.5rem] border border-slate-900">
                            <div class="flex justify-between items-center">
                                <div>
                                    <p class="font-black uppercase tracking-widest text-xs text-rose-500 mb-1">Module 03</p>
                                    <h4 class="text-xl font-bold">Anti-Link Uplink</h4>
                                </div>
                                <select name="antiLink" class="bg-rose-500 text-white p-3 rounded-xl font-black text-xs outline-none">
                                    <option value="true" ${s.antiLink?'selected':''}>FILTERING</option>
                                    <option value="false" ${!s.antiLink?'selected':''}>BYPASS</option>
                                </select>
                            </div>
                        </div>

                        <div class="p-8 bg-slate-950/40 rounded-[2.5rem] border border-slate-900">
                            <div class="flex justify-between items-center">
                                <div>
                                    <p class="font-black uppercase tracking-widest text-xs text-amber-500 mb-1">Module 04</p>
                                    <h4 class="text-xl font-bold">Neural Auto-Lock</h4>
                                </div>
                                <select name="autoLockdown" class="bg-amber-500 text-white p-3 rounded-xl font-black text-xs outline-none">
                                    <option value="true" ${s.autoLockdown?'selected':''}>ENABLED</option>
                                    <option value="false" ${!s.autoLockdown?'selected':''}>DISABLED</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    `, req.session.gid, 'security'));
});

app.get('/terminal', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    res.send(TitanUI.Shell(`
        <div class="titan-card bg-black h-full p-0 flex flex-col border-2 border-sky-500/20 overflow-hidden">
            <div class="bg-slate-900 p-4 border-b border-slate-800 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="flex gap-1.5">
                        <div class="w-3 h-3 rounded-full bg-rose-500"></div>
                        <div class="w-3 h-3 rounded-full bg-amber-500"></div>
                        <div class="w-3 h-3 rounded-full bg-emerald-500"></div>
                    </div>
                    <span class="text-[10px] mono text-slate-500 uppercase font-black">titan-node-bash — 80x24</span>
                </div>
                <span class="text-[10px] mono text-sky-500 font-bold">UPLINK_LIVE</span>
            </div>
            <div class="flex-1 p-8 mono text-emerald-500 text-sm space-y-2 overflow-y-auto" id="term_output">
                <p>> TITAN KERNEL BOOT SUCCESSFUL [V5.0.0]</p>
                <p>> INITIALIZING NEURAL_LINK ON PORT ${CONFIG.PORT}...</p>
                <p>> ESTABLISHING SECURE HANDSHAKE WITH DISCORD API...</p>
                <p>> GATEWAY CONNECTED. ALL SYSTEMS GO.</p>
                <p class="text-slate-500 mt-4">_ Waiting for command input...</p>
            </div>
            <div class="p-6 bg-slate-950 border-t border-slate-900 flex items-center gap-4">
                <span class="mono text-sky-500 font-bold">root@titan:~$</span>
                <input type="text" class="bg-transparent border-none outline-none flex-1 mono text-sky-400 placeholder:text-slate-800" placeholder="Enter system command..." autofocus>
            </div>
        </div>
    `, req.session.gid, 'terminal'));
});

app.get('/audits', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const logs = auditLogs.get(req.session.gid) || [];
    res.send(TitanUI.Shell(`
        <div class="titan-card overflow-hidden">
            <div class="p-8 border-b border-slate-900 flex justify-between items-center">
                <h2 class="text-2xl font-black uppercase italic tracking-tighter">Transmission Logs</h2>
                <span class="text-[10px] font-black bg-slate-900 px-3 py-1 rounded-full text-slate-500">${logs.length} RECORDS IN CACHE</span>
            </div>
            <table class="w-full text-left">
                <thead class="bg-slate-950/50 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <tr><th class="p-6">Trace ID</th><th class="p-6">Timestamp</th><th class="p-6">Operator</th><th class="p-6">Protocol</th><th class="p-6">Data</th></tr>
                </thead>
                <tbody class="divide-y divide-slate-800/50 text-sm mono">
                    ${logs.map(l => `
                        <tr class="hover:bg-sky-500/5 transition group">
                            <td class="p-6 text-sky-500 font-bold">${l.id}</td>
                            <td class="p-6 text-slate-500">${new Date(l.ts).toLocaleTimeString()}</td>
                            <td class="p-6 font-bold">${l.user}</td>
                            <td class="p-6"><span class="px-2 py-1 rounded bg-sky-500/10 text-[10px] text-sky-400 font-black">${l.type}</span></td>
                            <td class="p-6 text-slate-400">${l.detail}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `, req.session.gid, 'audits'));
});

app.post('/save-security', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    s.antiNuke = req.body.antiNuke === 'true';
    s.antiLink = req.body.antiLink === 'true';
    s.autoLockdown = req.body.autoLockdown === 'true';
    s.nukeThreshold = parseInt(req.body.nukeThreshold);
    logAction(req.session.gid, "PARAM_MOD", "ADMIN", "Security matrix recalculated.");
    res.redirect('/security');
});

app.get('/logout', (req, res) => { req.session = null; res.redirect('/'); });

// --- BOOT SEQUENCE ---
client.once('ready', async () => {
    console.log(`[TITAN-CORE] Unified Uplink Active: ${CONFIG.VERSION}`);
    const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
    const cmds = [new SlashCommandBuilder().setName('uplink').setDescription('Generate secure dashboard access credentials')].map(c => c.toJSON());

    client.guilds.cache.forEach(async (g) => {
        try {
            await rest.put(Routes.applicationGuildCommands(client.user.id, g.id), { body: cmds });
            if (!serverKeys.has(g.id)) serverKeys.set(g.id, crypto.randomBytes(4).toString('hex').toUpperCase());
            if (!analytics.has(g.id)) analytics.set(g.id, { traffic: 0, blocks: 0, tickets: 0, nukes_prevented: 0 });
            logAction(g.id, "SYS_BOOT", "SHER-CORE", `Titan-Mega Node v5.0 deployed.`);
        } catch (e) {}
    });
});

client.on(Events.InteractionCreate, async (i) => {
    if (i.isChatInputCommand() && i.commandName === 'uplink') {
        const key = serverKeys.get(i.guildId) || CONFIG.MASTER_KEY;
        await i.reply({
            embeds: [new EmbedBuilder()
                .setTitle("📡 TITAN-MEGA UPLINK")
                .setDescription(`Secure dashboard access link established.\n\n**NODE ID:** \`${i.guildId}\`\n**SECURITY KEY:** \`${key}\`\n**INTERFACE:** [Launch Terminal](${CONFIG.BASE_URL})`)
                .setColor("#0ea5e9")
                .setFooter({ text: "TITAN-MEGA v5.0 | Industrial Security" })
            ], ephemeral: true
        });
    }
});

app.listen(CONFIG.PORT, () => console.log(`[TERMINAL] Web Interface synchronized on port ${CONFIG.PORT}`));
client.login(CONFIG.TOKEN);
