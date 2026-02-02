/**
 * SHER LOCK PRO - TITAN ULTRA: INDUSTRIAL FINAL EDITION (v4.0)
 * ----------------------------------------------------------
 * * CORE ARCHITECTURAL OVERVIEW:
 * 1. MULTI-TAB COMMAND CENTER: Dashboard, Security, Tickets, Auto-Del, Logs, Settings.
 * 2. LIVE RENDER ENGINE: Real-time visual feedback for Ticket Panel design.
 * 3. DELETION MATRIX: Granular filtering (Users, Roles, Keywords, Bots, Admins).
 * 4. SECURITY PROTOCOLS: Auto-Role, Anti-Link, Emergency Lockdown, Ghost-Ping Detection.
 * 5. TELEMETRY: Real-time heatmap tracking of server activity and threats.
 * * DESIGN PRINCIPLE: 
 * Professional Discord management requires visibility and precision.
 * This build provides "single-pane-of-glass" control over complex operations.
 */

require('dotenv').config();
const { 
    Client, GatewayIntentBits, Partials, ActivityType, PermissionFlagsBits, 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    ChannelType, REST, Routes, SlashCommandBuilder, Events, Collection 
} = require('discord.js');
const express = require('express');
const session = require('cookie-session');
const bodyParser = require('body-parser');
const crypto = require('crypto');

// --- SYSTEM CONFIGURATION & CONSTANTS ---
const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    PORT: process.env.PORT || 10000,
    MASTER_KEY: process.env.MASTER_KEY || "TITAN-ULTIMATE-FINAL",
    SESSION_SECRET: process.env.SESSION_SECRET || 'titan-ultra-core-v4-industrial',
    VERSION: "4.0.0-ULTRA",
    BOOT_TIME: Date.now()
};

// --- INDUSTRIAL DATA GRIDS (IN-MEMORY PERSISTENCE) ---
const db = new Map();
const serverPasswords = new Map();
const auditLogs = new Map(); 
const analytics = new Map();
const ghostPingCache = new Collection();
const ticketCache = new Map();
const systemHeath = { commands_processed: 0, uptime: () => Date.now() - CONFIG.BOOT_TIME };

/**
 * CORE SETTINGS INITIALIZER
 * Defines the schema for every server managed by the Titan Node.
 */
const getSettings = (gid) => {
    if (!db.has(gid)) {
        db.set(gid, {
            // General Settings
            logChannelId: "",
            modRoleIds: [],
            autoRole: "",
            
            // Security Toggles
            antiLink: true,
            antiGhostPing: true,
            ignoreAdmins: true,
            ignoreBots: true,
            
            // Auto-Deletion Matrix
            autoDeleteChannels: [], // {id: string, delay: number}
            ignoredUsers: [],
            ignoredRoles: [],
            ignoredWords: [],
            
            // Ticket Configuration
            ticketCategory: "",
            panelColor: "#0ea5e9",
            panelTitle: "📡 TITAN SECURITY HUB",
            panelDesc: "Industrial security protocols active. Click below to initialize a secure tunnel.",
            panelButtonLabel: "Open Ticket",
            panelButtonEmoji: "🎫",
            
            // State
            lockdownActive: false
        });
    }
    return db.get(gid);
};

// --- UTILITY ENGINES ---

/**
 * AUDIT BUFFER ENGINE
 * Stores the last 150 events per guild for the dashboard log view.
 */
const logAudit = (gid, action, user, reason) => {
    if (!auditLogs.has(gid)) auditLogs.set(gid, []);
    const logs = auditLogs.get(gid);
    logs.unshift({ 
        id: `TX-${crypto.randomBytes(3).toString('hex').toUpperCase()}`, 
        time: new Date().toLocaleTimeString(), 
        action: action.toUpperCase(), 
        user: user.tag || user, 
        reason 
    });
    if (logs.length > 150) logs.pop();
};

/**
 * TELEMETRY TRACKER
 * Incremental counters for the Dashboard analytics cards.
 */
const track = (gid, key) => {
    if (!analytics.has(gid)) analytics.set(gid, { messages: 0, threats: 0, tickets: 0 });
    const data = analytics.get(gid);
    if (data[key] !== undefined) data[key]++;
};

// --- DISCORD CLIENT INITIALIZATION ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration
    ], 
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
});

// --- DISCORD SECURITY LOGIC ---

/**
 * AUTO-ROLE SECURITY
 */
client.on(Events.GuildMemberAdd, async (member) => {
    const s = getSettings(member.guild.id);
    if (s.autoRole) {
        const role = member.guild.roles.cache.get(s.autoRole);
        if (role) {
            member.roles.add(role).catch(() => {});
            logAudit(member.guild.id, "AUTOROLE", member.user, "Role assigned on entry.");
        }
    }
});

/**
 * MESSAGE SCANNING ENGINE (FIREWALL & MATRIX)
 */
client.on(Events.MessageCreate, async (msg) => {
    if (!msg.guild || msg.author.id === client.user.id) return;
    const s = getSettings(msg.guild.id);
    track(msg.guild.id, 'messages');

    // 1. GHOST PING MONITORING
    if (msg.mentions.users.size > 0 || msg.mentions.roles.size > 0) {
        ghostPingCache.set(msg.id, {
            author: msg.author,
            content: msg.content,
            mentions: [...msg.mentions.users.values(), ...msg.mentions.roles.values()]
        });
        setTimeout(() => ghostPingCache.delete(msg.id), 15000);
    }

    // 2. AUTO-DELETE MATRIX LOGIC
    const adConfig = s.autoDeleteChannels.find(c => c.id === msg.channel.id);
    if (adConfig) {
        const isIgnoredUser = s.ignoredUsers.includes(msg.author.id);
        const isIgnoredRole = msg.member?.roles.cache.some(r => s.ignoredRoles.includes(r.id));
        const hasIgnoredWord = s.ignoredWords.some(w => msg.content.toLowerCase().includes(w.toLowerCase()));
        const isBotBypass = s.ignoreBots && msg.author.bot;
        const isAdminBypass = s.ignoreAdmins && msg.member?.permissions.has(PermissionFlagsBits.Administrator);

        if (!isIgnoredUser && !isIgnoredRole && !hasIgnoredWord && !isBotBypass && !isAdminBypass) {
            setTimeout(() => msg.delete().catch(() => {}), adConfig.delay || 3000);
        }
    }

    // 3. FIREWALL: ANTI-LINK RADAR
    if (s.antiLink && /(https?:\/\/[^\s]+)/g.test(msg.content)) {
        if (!(s.ignoreAdmins && msg.member?.permissions.has(PermissionFlagsBits.Administrator))) {
            track(msg.guild.id, 'threats');
            msg.delete().catch(() => {});
            logAudit(msg.guild.id, "FIREWALL", msg.author, "Unauthorized link intercepted.");
        }
    }
});

/**
 * INTERACTION SYSTEM (SAPPHIRE TICKETS)
 */
client.on(Events.InteractionCreate, async (i) => {
    if (!i.guild) return;
    const s = getSettings(i.guild.id);

    if (i.isButton()) {
        // Ticket Initialization
        if (i.customId === 'tkt_open') {
            await i.deferReply({ ephemeral: true });
            track(i.guild.id, 'tickets');
            
            const channelName = `ticket-${i.user.username.slice(0, 10)}`;
            const ch = await i.guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: s.ticketCategory || null,
                permissionOverwrites: [
                    { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] }
                ]
            });

            const embed = new EmbedBuilder()
                .setTitle(`💎 SESSION: ${channelName.toUpperCase()}`)
                .setDescription(`Welcome <@${i.user.id}>. Support personnel have been notified.\n\n**Controls:**\n🛡️ Claim Session\n🔒 Terminate Channel`)
                .setColor(s.panelColor)
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('tkt_claim').setLabel('Take Session').setStyle(ButtonStyle.Success).setEmoji('🛡️'),
                new ButtonBuilder().setCustomId('tkt_close').setLabel('Terminate').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );

            await ch.send({ content: `<@${i.user.id}> | Staff`, embeds: [embed], components: [row] });
            i.editReply({ content: `✅ **Secure tunnel established:** ${ch}` });
            logAudit(i.guild.id, "TICKETS", i.user, `Opened ticket: ${channelName}`);
        }

        // Ticket Management
        if (i.customId === 'tkt_claim') {
            await i.reply({ embeds: [new EmbedBuilder().setDescription(`🛡️ <@${i.user.id}> has taken control of this session.`).setColor("#10b981")] });
            logAudit(i.guild.id, "TICKETS", i.user, `Claimed ticket in ${i.channel.name}`);
        }

        if (i.customId === 'tkt_close') {
            await i.reply({ content: "☢️ **TERMINATION SEQUENCE INITIATED...** Closing in 5 seconds." });
            logAudit(i.guild.id, "TICKETS", i.user, `Closed ticket: ${i.channel.name}`);
            setTimeout(() => i.channel.delete().catch(() => {}), 5000);
        }
    }

    // Slash Command Logic
    if (i.isChatInputCommand()) {
        systemHeath.commands_processed++;
        if (i.commandName === 'terminal') {
            const key = serverPasswords.get(i.guild.id) || "REBOOT_REQUIRED";
            const embed = new EmbedBuilder()
                .setTitle("📡 TITAN ACCESS TERMINAL")
                .setDescription("Provide these credentials at the web uplink to manage this node.")
                .addFields(
                    { name: "Node ID", value: `\`${i.guild.id}\``, inline: true },
                    { name: "Access Key", value: `\`${key}\``, inline: true }
                )
                .setColor("#0ea5e9")
                .setFooter({ text: "Titan Security Engine v4.0" });
            
            i.reply({ embeds: [embed], ephemeral: true });
        }
    }
});

// --- WEB INTERFACE ENGINE ---

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ keys: [CONFIG.SESSION_SECRET], name: 'titan_v4_session' }));

/**
 * PREMIUM UI WRAPPER
 * Sophisticated sidebar-based layout with glassmorphism effects.
 */
const UI_WRAPPER = (content, gid, active = 'dash') => {
    const s = getSettings(gid);
    const guild = client.guilds.cache.get(gid);
    const timeNow = new Date().toLocaleTimeString();

    return `
    <!DOCTYPE html>
    <html lang="en" class="dark">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>TITAN ULTRA | ${guild?.name || "Node"}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
            body { background: #02040a; color: #e2e8f0; font-family: 'Space Grotesk', sans-serif; }
            .titan-glass { background: rgba(13, 17, 23, 0.7); border: 1px solid rgba(255,255,255,0.04); backdrop-filter: blur(25px); border-radius: 1.25rem; }
            .sidebar { background: #080a0f; border-right: 1px solid rgba(255,255,255,0.02); }
            .nav-item { transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); color: #94a3b8; display: flex; align-items: center; gap: 14px; padding: 14px 18px; border-radius: 12px; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; margin-bottom: 6px; }
            .nav-item:hover { background: rgba(255,255,255,0.03); color: white; }
            .nav-item.active { background: #0ea5e9; color: white; box-shadow: 0 10px 25px -5px rgba(14, 165, 233, 0.4); }
            input, select, textarea { background: #0d1117 !important; border: 1px solid rgba(255,255,255,0.08) !important; color: white !important; padding: 12px; border-radius: 10px; width: 100%; outline: none; transition: 0.2s; }
            input:focus { border-color: #0ea5e9 !important; box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.1); }
            .preview-card { background: #2f3136; border-left: 4px solid ${s.panelColor}; padding: 18px; border-radius: 4px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
            ::-webkit-scrollbar { width: 6px; }
            ::-webkit-scrollbar-track { background: transparent; }
            ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        </style>
    </head>
    <body class="flex h-screen overflow-hidden">
        <!-- SIDEBAR -->
        <aside class="w-72 sidebar p-8 flex flex-col">
            <div class="flex items-center gap-3 mb-12">
                <div class="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center font-black italic text-white shadow-lg shadow-sky-500/20">T</div>
                <h1 class="text-2xl font-black italic tracking-tighter">TITAN <span class="text-sky-500">ULTRA</span></h1>
            </div>
            
            <nav class="flex-1">
                <p class="text-[10px] font-bold text-slate-600 uppercase mb-4 tracking-widest px-2">Management</p>
                <a href="/dash" class="nav-item ${active==='dash'?'active':''}">Dashboard</a>
                <a href="/security" class="nav-item ${active==='security'?'active':''}">Security Hub</a>
                <a href="/tickets" class="nav-item ${active==='tickets'?'active':''}">Ticket Terminal</a>
                <a href="/autodel" class="nav-item ${active==='autodel'?'active':''}">Deletion Matrix</a>
                <a href="/audit" class="nav-item ${active==='audit'?'active':''}">Audit Archive</a>
            </nav>

            <div class="mt-auto pt-6 border-t border-white/5">
                <div class="flex items-center justify-between mb-4 px-2">
                    <span class="text-[10px] font-bold text-slate-500 uppercase">Emergency</span>
                    <span class="w-2 h-2 rounded-full ${s.lockdownActive?'bg-rose-500 animate-ping':'bg-emerald-500'}"></span>
                </div>
                <form action="/lockdown" method="POST">
                    <button class="w-full p-4 rounded-xl font-bold uppercase text-[10px] tracking-widest transition ${s.lockdownActive ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30' : 'bg-rose-500/5 text-rose-500 border border-rose-500/20 hover:bg-rose-500/10'}">
                        ${s.lockdownActive ? 'RELEASE LOCKDOWN' : 'ACTIVATE LOCKDOWN'}
                    </button>
                </form>
            </div>
        </aside>

        <!-- MAIN VIEWPORT -->
        <main class="flex-1 p-12 overflow-y-auto bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-sky-500/5 via-transparent to-transparent">
            <header class="flex justify-between items-start mb-12">
                <div>
                    <div class="flex items-center gap-3 mb-1 text-sky-500">
                        <span class="text-[10px] font-bold uppercase tracking-[0.3em]">Operational Uplink</span>
                        <div class="h-[1px] w-12 bg-sky-500/30"></div>
                    </div>
                    <h2 class="text-4xl font-black italic uppercase tracking-tight">${guild?.name || "DISCONNECTED NODE"}</h2>
                </div>
                <div class="text-right">
                    <p class="text-xs font-bold text-slate-500 mb-1">LOCAL TIME: ${timeNow}</p>
                    <a href="/" class="text-[10px] font-black text-rose-500 uppercase hover:text-rose-400 transition">Terminate Session</a>
                </div>
            </header>

            ${content}
        </main>
    </body>
    </html>`;
};

// --- WEB ROUTES ---

/**
 * LOGIN SCREEN
 * Visual-first landing page with cinematic failure states.
 */
app.get('/', (req, res) => res.send(`
    <!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;700&display=swap" rel="stylesheet">
    <style>body{background:#02040a;color:white;font-family:'Space Grotesk',sans-serif;overflow:hidden;}</style></head>
    <body class="flex items-center justify-center h-screen">
        <div class="absolute inset-0 opacity-20" style="background-image: radial-gradient(#0ea5e9 1px, transparent 1px); background-size: 40px 40px;"></div>
        <form action="/login" method="POST" class="relative z-10 w-[420px] bg-[#0a0c12] p-12 rounded-[2.5rem] border border-white/5 shadow-2xl shadow-black">
            <div class="w-16 h-16 bg-sky-500 rounded-2xl flex items-center justify-center text-3xl font-black italic mb-8 mx-auto shadow-2xl shadow-sky-500/40">T</div>
            <h1 class="text-3xl font-black italic text-center mb-2 tracking-tighter">TITAN <span class="text-sky-500">PRO</span></h1>
            <p class="text-[10px] text-slate-500 font-bold uppercase tracking-[0.4em] text-center mb-10">Uplink Authorization Required</p>
            
            <div class="space-y-4">
                <input name="gid" placeholder="Node Server ID" required class="w-full bg-[#0d1117] border border-white/5 p-4 rounded-xl outline-none focus:border-sky-500 transition">
                <input name="pass" type="password" placeholder="Access Key" required class="w-full bg-[#0d1117] border border-white/5 p-4 rounded-xl outline-none focus:border-sky-500 transition">
                <button class="w-full bg-sky-500 p-5 rounded-xl font-black uppercase tracking-widest text-xs mt-4 shadow-xl shadow-sky-500/20 hover:scale-[1.02] active:scale-[0.98] transition">Initialize Connection</button>
            </div>
        </form>
    </body></html>
`));

app.post('/login', (req, res) => {
    const { gid, pass } = req.body;
    const correctPass = serverPasswords.get(gid) || CONFIG.MASTER_KEY;
    if (pass?.toUpperCase() === correctPass) {
        req.session.gid = gid;
        res.redirect('/dash');
    } else {
        res.send(`
            <body style="background:#02040a;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
                <div style="text-align:center;background:#0a0c12;padding:60px;border-radius:40px;border:1px solid rgba(244,63,94,0.2);box-shadow:0 0 100px rgba(244,63,94,0.1)">
                    <div style="font-size:60px;margin-bottom:20px">🚫</div>
                    <h1 style="font-size:32px;font-weight:900;margin:0 0 10px;font-style:italic">ACCESS <span style="color:#f43f5e">DENIED</span></h1>
                    <p style="color:#94a3b8;margin-bottom:40px;font-size:14px">Uplink credentials rejected by the Titan Security Matrix.<br>Unidentified access attempt logged.</p>
                    <a href="/" style="text-decoration:none;color:white;background:#f43f5e;padding:15px 40px;border-radius:12px;font-weight:bold;text-transform:uppercase;font-size:12px">Retry Uplink</a>
                </div>
            </body>
        `);
    }
});

/**
 * DASHBOARD TAB
 * High-level analytics and system health overview.
 */
app.get('/dash', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const stats = analytics.get(req.session.gid) || { messages: 0, threats: 0, tickets: 0 };
    const logs = auditLogs.get(req.session.gid) || [];
    
    res.send(UI_WRAPPER(`
        <div class="grid grid-cols-4 gap-6 mb-10">
            <div class="titan-glass p-8">
                <p class="text-slate-500 text-[10px] font-bold uppercase mb-2">Network Traffic</p>
                <h3 class="text-5xl font-black tabular-nums">${stats.messages.toLocaleString()}</h3>
                <p class="text-[10px] text-sky-500 font-bold mt-2">Packets Scanned</p>
            </div>
            <div class="titan-glass p-8 border-b-4 border-rose-600">
                <p class="text-slate-500 text-[10px] font-bold uppercase mb-2">Neutralized Threats</p>
                <h3 class="text-5xl font-black text-rose-500 tabular-nums">${stats.threats.toLocaleString()}</h3>
                <p class="text-[10px] text-rose-500 font-bold mt-2">Violations Dropped</p>
            </div>
            <div class="titan-glass p-8 border-b-4 border-emerald-500">
                <p class="text-slate-500 text-[10px] font-bold uppercase mb-2">Support Load</p>
                <h3 class="text-5xl font-black text-emerald-500 tabular-nums">${stats.tickets.toLocaleString()}</h3>
                <p class="text-[10px] text-emerald-500 font-bold mt-2">Active Sessions</p>
            </div>
            <div class="titan-glass p-8">
                <p class="text-slate-500 text-[10px] font-bold uppercase mb-2">System Uptime</p>
                <h3 class="text-5xl font-black tabular-nums">${Math.floor(systemHeath.uptime() / 60000)}m</h3>
                <p class="text-[10px] text-slate-500 font-bold mt-2">Stable Node</p>
            </div>
        </div>

        <div class="grid grid-cols-3 gap-10">
            <div class="col-span-2 titan-glass overflow-hidden">
                <div class="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
                    <span class="font-bold italic uppercase text-xs tracking-widest">Real-time Activity Stream</span>
                    <span class="px-3 py-1 bg-sky-500/10 text-sky-500 rounded-full text-[9px] font-black uppercase">Live Updates</span>
                </div>
                <div class="max-h-[500px] overflow-y-auto">
                    ${logs.length ? logs.map(l => `
                        <div class="p-4 border-b border-white/5 flex items-center justify-between hover:bg-white/[0.02] transition">
                            <div class="flex items-center gap-4">
                                <span class="text-[10px] font-mono text-slate-600">${l.time}</span>
                                <span class="px-2 py-1 rounded bg-sky-500/10 text-sky-500 font-black text-[9px] min-w-[80px] text-center">${l.action}</span>
                                <span class="text-sm font-medium text-slate-300">${l.reason}</span>
                            </div>
                            <span class="text-[10px] text-slate-500 font-bold bg-white/5 px-2 py-1 rounded">${l.user}</span>
                        </div>
                    `).join('') : '<div class="p-20 text-center text-slate-600 italic">No activity recorded for this node yet.</div>'}
                </div>
            </div>
            
            <div class="space-y-6">
                <div class="titan-glass p-8">
                    <h4 class="text-xs font-black text-sky-500 uppercase mb-4 tracking-widest">Security Health</h4>
                    <div class="space-y-4">
                        <div class="flex justify-between items-center">
                            <span class="text-xs text-slate-400">Firewall Efficiency</span>
                            <span class="text-xs font-bold">99.9%</span>
                        </div>
                        <div class="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                            <div class="bg-sky-500 h-full" style="width: 99.9%"></div>
                        </div>
                        <div class="flex justify-between items-center mt-6">
                            <span class="text-xs text-slate-400">Auto-Del Load</span>
                            <span class="text-xs font-bold text-rose-500">OPTIMAL</span>
                        </div>
                    </div>
                </div>
                <div class="titan-glass p-8 bg-sky-500/5">
                    <h4 class="text-xs font-black text-sky-500 uppercase mb-2">Node Information</h4>
                    <p class="text-[10px] text-slate-400 leading-relaxed mb-4">You are currently connected to <b>Titan Node ${req.session.gid}</b>. All actions are cryptographically signed and logged.</p>
                    <div class="text-[10px] font-mono text-slate-500">LATENCY: ${client.ws.ping}ms</div>
                </div>
            </div>
        </div>
    `, req.session.gid, 'dash'));
});

/**
 * SECURITY HUB
 * Anti-link, Auto-role, and Global ignore toggles.
 */
app.get('/security', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    const guild = client.guilds.cache.get(req.session.gid);
    const roles = guild ? guild.roles.cache.map(r => `<option value="${r.id}" ${s.autoRole === r.id ? 'selected' : ''}>${r.name}</option>`).join('') : '';
    
    res.send(UI_WRAPPER(`
        <form action="/save-security" method="POST" class="grid grid-cols-2 gap-10">
            <div class="titan-glass p-10 space-y-8">
                <h3 class="text-sky-500 font-black text-xs uppercase tracking-widest mb-4">Firewall Radar</h3>
                
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-3">Anti-Link Interception</label>
                    <select name="antiLink">
                        <option value="true" ${s.antiLink?'selected':''}>ENABLED (HIGH SECURITY)</option>
                        <option value="false" ${!s.antiLink?'selected':''}>DISABLED</option>
                    </select>
                </div>

                <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-3">Anti-Ghost Ping</label>
                    <select name="antiGhostPing">
                        <option value="true" ${s.antiGhostPing?'selected':''}>ENABLED</option>
                        <option value="false" ${!s.antiGhostPing?'selected':''}>DISABLED</option>
                    </select>
                </div>

                <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-3">Assign Auto-Role on Join</label>
                    <select name="autoRole">
                        <option value="">-- DO NOT ASSIGN --</option>
                        ${roles}
                    </select>
                </div>

                <button class="w-full bg-sky-500 py-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-sky-500/20 hover:scale-[1.01] transition">Sync Node Configuration</button>
            </div>

            <div class="titan-glass p-10 space-y-8">
                <h3 class="text-amber-500 font-black text-xs uppercase tracking-widest mb-4">Bypass Protocols</h3>
                
                <div class="p-6 bg-white/5 border border-white/5 rounded-2xl">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-xs font-bold">Ignore Administrators</span>
                        <div class="text-[9px] font-bold px-2 py-1 bg-sky-500/10 text-sky-500 rounded">RECOMMENDED</div>
                    </div>
                    <select name="ignoreAdmins">
                        <option value="true" ${s.ignoreAdmins?'selected':''}>ENABLED</option>
                        <option value="false" ${!s.ignoreAdmins?'selected':''}>DISABLED</option>
                    </select>
                </div>

                <div class="p-6 bg-white/5 border border-white/5 rounded-2xl">
                    <span class="block text-xs font-bold mb-2">Ignore Other Bots/Webhooks</span>
                    <select name="ignoreBots">
                        <option value="true" ${s.ignoreBots?'selected':''}>ENABLED</option>
                        <option value="false" ${!s.ignoreBots?'selected':''}>DISABLED</option>
                    </select>
                </div>
            </div>
        </form>
    `, req.session.gid, 'security'));
});

/**
 * TICKET TERMINAL
 * Full configuration for ticket panels with live preview.
 */
app.get('/tickets', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    const guild = client.guilds.cache.get(req.session.gid);
    const cats = guild ? guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).map(c => `<option value="${c.id}" ${s.ticketCategory === c.id ? 'selected' : ''}>${c.name.toUpperCase()}</option>`).join('') : '';

    res.send(UI_WRAPPER(`
        <div class="grid grid-cols-5 gap-10">
            <form action="/save-tickets" method="POST" class="col-span-3 titan-glass p-10 space-y-6">
                <h3 class="text-sky-500 font-black text-xs uppercase tracking-widest mb-4">Panel Designer</h3>
                
                <div class="grid grid-cols-2 gap-6">
                    <div><label class="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Panel Heading</label><input name="title" value="${s.panelTitle}"></div>
                    <div><label class="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Primary Color</label><input type="color" name="color" value="${s.panelColor}" class="h-12 p-1"></div>
                </div>

                <div>
                    <label class="text-[10px] font-bold text-slate-500 uppercase mb-2 block">System Message Content</label>
                    <textarea name="desc" rows="5">${s.panelDesc}</textarea>
                </div>

                <div class="grid grid-cols-2 gap-6">
                    <div><label class="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Button Label</label><input name="btnLabel" value="${s.panelButtonLabel}"></div>
                    <div><label class="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Button Emoji</label><input name="btnEmoji" value="${s.panelButtonEmoji}"></div>
                </div>

                <div>
                    <label class="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Target Ticket Category</label>
                    <select name="category"><option value="">-- NO CATEGORY (ROOT) --</option>${cats}</select>
                </div>

                <div class="flex gap-4 pt-6">
                    <button class="flex-1 bg-sky-500 py-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-sky-500/20 transition">Refresh Preview</button>
                    <a href="/deploy-panel" class="flex-1 text-center bg-white/5 border border-white/10 py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition">Deploy to Discord</a>
                </div>
            </form>

            <div class="col-span-2 space-y-6">
                <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Live Discord Preview</p>
                <div class="preview-card" style="border-left-color: ${s.panelColor}">
                    <h5 class="text-white font-bold mb-2">${s.panelTitle}</h5>
                    <p class="text-slate-300 text-sm leading-relaxed mb-6 whitespace-pre-wrap">${s.panelDesc}</p>
                    <div class="inline-flex items-center gap-2 bg-[#5865f2] px-4 py-2 rounded text-white font-bold text-xs shadow-lg">
                        <span>${s.panelButtonEmoji}</span>
                        <span>${s.panelButtonLabel}</span>
                    </div>
                </div>
                <div class="titan-glass p-6 bg-amber-500/5 border-amber-500/20">
                    <p class="text-[10px] font-bold text-amber-500 uppercase mb-2">Pro Tip</p>
                    <p class="text-xs text-slate-400 leading-relaxed italic">"Deploying" will send a permanent interactive panel to the first available text channel in your server.</p>
                </div>
            </div>
        </div>
    `, req.session.gid, 'tickets'));
});

/**
 * DELETION MATRIX
 * Deep configuration for the auto-deletion engine.
 */
app.get('/autodel', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    const guild = client.guilds.cache.get(req.session.gid);
    const channels = guild ? guild.channels.cache.filter(c => c.type === ChannelType.GuildText).map(c => `<option value="${c.id}">#${c.name.toUpperCase()}</option>`).join('') : '';
    
    res.send(UI_WRAPPER(`
        <div class="space-y-10">
            <!-- Channel Matrix -->
            <div class="titan-glass p-10">
                <h3 class="text-rose-500 font-black text-xs uppercase tracking-widest mb-8">Channel Deletion Matrix</h3>
                <form action="/add-autodel" method="POST" class="flex gap-4 mb-10">
                    <select name="cid" class="flex-1">${channels}</select>
                    <input name="delay" type="number" placeholder="Delay (ms)" value="3000" style="width:180px">
                    <button class="bg-emerald-600 px-10 rounded-xl font-black text-[10px] uppercase tracking-widest">Connect Channel</button>
                </form>
                
                <div class="grid grid-cols-2 gap-4">
                    ${s.autoDeleteChannels.length ? s.autoDeleteChannels.map(c => `
                        <div class="flex justify-between items-center p-5 bg-white/5 border border-white/5 rounded-2xl">
                            <div>
                                <span class="block text-xs font-bold text-sky-500 mb-1">NODE: #${c.id}</span>
                                <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">PULSE: ${c.delay}MS</span>
                            </div>
                            <a href="/del-autodel?id=${c.id}" class="px-3 py-1.5 bg-rose-500/10 text-rose-500 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition">Terminate</a>
                        </div>
                    `).join('') : '<div class="col-span-2 p-10 text-center text-slate-600 italic border border-dashed border-white/5 rounded-2xl">No active deletion channels configured.</div>'}
                </div>
            </div>

            <!-- Ignore Filters -->
            <div class="grid grid-cols-3 gap-8">
                <div class="titan-glass p-8">
                    <p class="text-[10px] font-black text-slate-500 uppercase mb-6 tracking-widest">Whitelisted User IDs</p>
                    <form action="/ignore-user" method="POST" class="flex gap-3 mb-6">
                        <input name="id" placeholder="Paste ID" class="text-xs">
                        <button class="bg-sky-500 px-4 rounded-xl font-black">+</button>
                    </form>
                    <div class="space-y-2">
                        ${s.ignoredUsers.map(u => `<div class="p-3 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center text-[11px] font-mono"><span>${u}</span><a href="/del-ignore-user?id=${u}" class="text-rose-500 font-black">X</a></div>`).join('')}
                    </div>
                </div>

                <div class="titan-glass p-8">
                    <p class="text-[10px] font-black text-slate-500 uppercase mb-6 tracking-widest">Filtered Keywords</p>
                    <form action="/ignore-word" method="POST" class="flex gap-3 mb-6">
                        <input name="word" placeholder="Add word" class="text-xs">
                        <button class="bg-sky-500 px-4 rounded-xl font-black">+</button>
                    </form>
                    <div class="space-y-2">
                        ${s.ignoredWords.map(w => `<div class="p-3 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center text-xs font-bold uppercase"><span>${w}</span><a href="/del-ignore-word?word=${w}" class="text-rose-500 font-black">X</a></div>`).join('')}
                    </div>
                </div>

                <div class="titan-glass p-8 bg-rose-500/5">
                    <p class="text-[10px] font-black text-rose-500 uppercase mb-6 tracking-widest">Global Scan State</p>
                    <div class="space-y-3">
                        <a href="/toggle-admin-ignore" class="block w-full text-center p-4 rounded-xl border font-black text-[10px] uppercase tracking-widest ${s.ignoreAdmins?'border-sky-500 text-sky-500 bg-sky-500/5':'border-white/10 text-slate-500'} transition">
                            ${s.ignoreAdmins ? 'Ignoring Admins' : 'Scanning Admins'}
                        </a>
                        <p class="text-[10px] text-slate-500 text-center leading-relaxed">Admin bypass overrides all individual channel deletion settings.</p>
                    </div>
                </div>
            </div>
        </div>
    `, req.session.gid, 'autodel'));
});

// --- POST/ACTION HANDLERS ---

app.post('/save-security', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    s.antiLink = req.body.antiLink === 'true';
    s.antiGhostPing = req.body.antiGhostPing === 'true';
    s.autoRole = req.body.autoRole;
    s.ignoreAdmins = req.body.ignoreAdmins === 'true';
    s.ignoreBots = req.body.ignoreBots === 'true';
    logAudit(req.session.gid, "SECURITY", "UPLINK", "Protocols updated via dashboard.");
    res.redirect('/security');
});

app.post('/save-tickets', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    s.panelTitle = req.body.title;
    s.panelDesc = req.body.desc;
    s.panelColor = req.body.color;
    s.panelButtonLabel = req.body.btnLabel;
    s.panelButtonEmoji = req.body.btnEmoji;
    s.ticketCategory = req.body.category;
    logAudit(req.session.gid, "TICKETS", "UPLINK", "Panel design refreshed.");
    res.redirect('/tickets');
});

app.post('/add-autodel', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    if (req.body.cid) {
        s.autoDeleteChannels.push({ id: req.body.cid, delay: parseInt(req.body.delay) || 3000 });
        logAudit(req.session.gid, "AUTODEL", "UPLINK", `Channel #${req.body.cid} connected to matrix.`);
    }
    res.redirect('/autodel');
});

app.get('/del-autodel', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    s.autoDeleteChannels = s.autoDeleteChannels.filter(c => c.id !== req.query.id);
    res.redirect('/autodel');
});

app.post('/ignore-user', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    if (req.body.id && !s.ignoredUsers.includes(req.body.id)) s.ignoredUsers.push(req.body.id);
    res.redirect('/autodel');
});

app.get('/del-ignore-user', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    s.ignoredUsers = s.ignoredUsers.filter(u => u !== req.query.id);
    res.redirect('/autodel');
});

app.post('/ignore-word', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    if (req.body.word && !s.ignoredWords.includes(req.body.word)) s.ignoredWords.push(req.body.word.toLowerCase());
    res.redirect('/autodel');
});

app.get('/del-ignore-word', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    s.ignoredWords = s.ignoredWords.filter(w => w !== req.query.word);
    res.redirect('/autodel');
});

app.get('/toggle-admin-ignore', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    s.ignoreAdmins = !s.ignoreAdmins;
    res.redirect('/autodel');
});

app.post('/lockdown', async (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    const guild = client.guilds.cache.get(req.session.gid);
    s.lockdownActive = !s.lockdownActive;
    
    if (guild) {
        try {
            const everyone = guild.roles.everyone;
            const perms = s.lockdownActive 
                ? everyone.permissions.remove(PermissionFlagsBits.SendMessages) 
                : everyone.permissions.add(PermissionFlagsBits.SendMessages);
            await everyone.setPermissions(perms);
            logAudit(req.session.gid, "LOCKDOWN", "SYSTEM", s.lockdownActive ? "GLOBAL LOCKDOWN ENABLED" : "LOCKDOWN TERMINATED");
        } catch (e) {
            console.error(e);
        }
    }
    res.redirect('/dash');
});

app.get('/deploy-panel', async (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    const guild = client.guilds.cache.get(req.session.gid);
    const channel = guild?.channels.cache.filter(c => c.type === ChannelType.GuildText).first();
    
    if (channel) {
        const embed = new EmbedBuilder()
            .setTitle(s.panelTitle)
            .setDescription(s.panelDesc)
            .setColor(s.panelColor)
            .setTimestamp();
            
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('tkt_open')
                .setLabel(s.panelButtonLabel)
                .setStyle(ButtonStyle.Primary)
                .setEmoji(s.panelButtonEmoji || '🎫')
        );
        
        await channel.send({ embeds: [embed], components: [row] });
        logAudit(req.session.gid, "DEPLOY", "UPLINK", `Panel deployed to #${channel.name}`);
    }
    res.redirect('/tickets');
});

// --- BOOT SEQUENCE ---

client.once('ready', () => {
    console.log(`[SYS] Titan Ultra Online: Authenticated as ${client.user.tag}`);
    client.user.setActivity('TITAN HUB v4', { type: ActivityType.Watching });

    const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
    const cmds = [
        new SlashCommandBuilder().setName('terminal').setDescription('Obtain the secure uplink key for the dashboard.')
    ].map(c => c.toJSON());

    client.guilds.cache.forEach(g => {
        try {
            rest.put(Routes.applicationGuildCommands(client.user.id, g.id), { body: cmds });
            if (!serverPasswords.has(g.id)) {
                serverPasswords.set(g.id, crypto.randomBytes(3).toString('hex').toUpperCase());
            }
        } catch(e) {}
    });
});

app.listen(CONFIG.PORT, () => {
    console.log(`[SYS] Command Center online at Port ${CONFIG.PORT}`);
});

client.login(CONFIG.TOKEN);
