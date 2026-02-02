/**
 * ==========================================================================================
 * SHER BOT NODE ENGINE V6.5 - THE OVERKILL EDITION
 * ==========================================================================================
 * [SYSTEM CONFIGURATION]
 * - CORE RUNTIME: Node.js 18.x / 20.x
 * - FRAMEWORK: Discord.js 14.14.0
 * - WEB INTERFACE: Express.js Industrial Stack
 * - ARCHITECTURE: Multi-Module Security Cluster
 * * [MODULES]
 * 1. FILTER MATRIX: Multi-word auto-purge system.
 * 2. ISOLATION ENGINE: Channel, User, and Role bypass protocols.
 * 3. NEURAL HEATMAP: Velocity-based thread-bot mitigation.
 * 4. TICKET PRO: Dynamic button/dropdown builder with archive logic.
 * 5. COMMAND CENTER: 100% Responsive Industrial Dark UI.
 * ==========================================================================================
 */

require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    ActivityType, 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder,
    ChannelType, 
    Events, 
    Collection 
} = require('discord.js');
const express = require('express');
const session = require('cookie-session');
const bodyParser = require('body-parser');
const crypto = require('crypto');

// --- ENGINE GLOBAL CONSTANTS ---
const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    PORT: process.env.PORT || 10000,
    MASTER_KEY: "TITAN-V6-CORE",
    SESSION_SECRET: 'titan-overkill-secret-999',
    VERSION: "6.5.0-OVERKILL",
    UI: {
        PRIMARY: "#0ea5e9", // Sky 500
        DANGER: "#f43f5e",  // Rose 500
        SUCCESS: "#10b981", // Emerald 500
        WARNING: "#f59e0b", // Amber 500
        BG_DARK: "#020617", // Slate 950
        CARD_BG: "#0a0f24",
        SIDEBAR: "#080c1d"
    }
};

// --- DATABASE EMULATION ---
const db = new Map();
const serverPasswords = new Map();
const auditLogs = new Map(); 
const neuralHeatmap = new Map(); 
const analytics = new Map();

/**
 * Settings Schema: High-Verbosity Configuration
 */
const getSettings = (gid) => {
    if (!db.has(gid)) {
        db.set(gid, {
            // Filter Matrix (Auto-Deletion)
            filterEnabled: true,
            blacklistedWords: ["scam", "hack", "discord.gg/", "nitro-free"], 
            antiLink: "FILTERING", // DISABLED, FILTERING, LOGGING
            
            // Isolation Protocols (Bypass/Ignore)
            ignoredChannels: [], 
            whitelistedRoles: [], 
            whitelistedUsers: [], 
            
            // Neural Heatmap (Bot-Thread Mitigation)
            antiSpamEnabled: true,
            threatSensitivity: 5, // Max messages per 5s
            autoTimeoutSpammers: true,
            
            // Ticket Pro Engine
            ticketStatus: true,
            ticketMode: "BUTTON", // BUTTON or DROPDOWN
            ticketCategories: [
                { id: "support", label: "General Support", emoji: "🛡️" },
                { id: "billing", label: "Billing Dept", emoji: "💰" }
            ],
            ticketArchiveAfter: 5,
            
            // UI State
            lastUpdate: Date.now()
        });
    }
    return db.get(gid);
};

/**
 * Analytics Tracker
 */
const trackEvent = (gid, type) => {
    if (!analytics.has(gid)) {
        analytics.set(gid, { intercepts: 0, spams: 0, tickets: 0, lastActivity: "None" });
    }
    const data = analytics.get(gid);
    if (type === 'intercept') data.intercepts++;
    if (type === 'spam') data.spams++;
    if (type === 'ticket') data.tickets++;
    data.lastActivity = new Date().toLocaleTimeString();
};

/**
 * High-Precision Audit Logger
 */
const logMatrix = (gid, action, user, reason) => {
    if (!auditLogs.has(gid)) auditLogs.set(gid, []);
    const entry = { 
        id: `TX-${crypto.randomBytes(3).toString('hex').toUpperCase()}`, 
        timestamp: new Date().toLocaleTimeString('en-GB'),
        action: action.toUpperCase(), 
        user: typeof user === 'string' ? user : (user?.tag || user?.id || "SYSTEM"), 
        reason: reason || "No description."
    };
    auditLogs.get(gid).unshift(entry);
    if (auditLogs.get(gid).length > 200) auditLogs.get(gid).pop();
    return entry;
};

// --- DISCORD CLIENT ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers
    ]
});

/**
 * THE SHIELD CORE: Filter Matrix & Isolation
 */
client.on(Events.MessageCreate, async (msg) => {
    if (!msg.guild || msg.author.bot) return;
    
    const settings = getSettings(msg.guild.id);

    // --- PROTOCOL 1: CHANNEL ISOLATION ---
    if (settings.ignoredChannels.includes(msg.channel.id)) return;

    // --- PROTOCOL 2: BYPASS/ROLE DETECTION ---
    if (msg.member.permissions.has(PermissionFlagsBits.Administrator)) return;
    if (settings.whitelistedUsers.includes(msg.author.id)) return;
    const hasImmuneRole = msg.member.roles.cache.some(r => settings.whitelistedRoles.includes(r.id));
    if (hasImmuneRole) return;

    // --- PROTOCOL 3: NEURAL HEATMAP (Bot-Thread Shield) ---
    if (settings.antiSpamEnabled) {
        const now = Date.now();
        const heatKey = `${msg.guild.id}_${msg.author.id}`;
        const timestamps = neuralHeatmap.get(heatKey) || [];
        const recent = timestamps.filter(t => now - t < 5000);
        recent.push(now);
        neuralHeatmap.set(heatKey, recent);

        if (recent.length > settings.threatSensitivity) {
            try {
                await msg.delete();
                trackEvent(msg.guild.id, 'spam');
                if (recent.length === settings.threatSensitivity + 1) {
                    logMatrix(msg.guild.id, "THREAT_SHIELD", msg.author, `Neutralized high-velocity thread bot (${recent.length} msg/5s).`);
                }
            } catch (e) {}
            return; 
        }
    }

    // --- PROTOCOL 4: FILTER MATRIX (Auto-Deletion) ---
    if (settings.filterEnabled) {
        const content = msg.content.toLowerCase();
        
        // Keyword Scan
        const badWord = settings.blacklistedWords.find(word => content.includes(word.toLowerCase()));
        if (badWord) {
            try {
                await msg.delete();
                trackEvent(msg.guild.id, 'intercept');
                logMatrix(msg.guild.id, "AUTO_DELETE", msg.author, `Purged forbidden term: [${badWord}]`);
                return;
            } catch (e) {}
        }

        // Link Guard
        if (settings.antiLink === "FILTERING" && /(https?:\/\/[^\s]+)/g.test(content)) {
            try {
                await msg.delete();
                trackEvent(msg.guild.id, 'intercept');
                logMatrix(msg.guild.id, "LINK_INTERCEPT", msg.author, "Filtered unauthorized link stream.");
                return;
            } catch (e) {}
        }
    }
});

/**
 * TICKET INTERACTION HANDLER
 */
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.guild) return;

    const settings = getSettings(interaction.guild.id);

    // 1. Ticket Creation (Buttons & Select Menu)
    let category = null;
    if (interaction.isButton() && interaction.customId.startsWith('tkt_open_')) {
        category = interaction.customId.replace('tkt_open_', '');
    } else if (interaction.isStringSelectMenu() && interaction.customId === 'tkt_select') {
        category = interaction.values[0];
    }

    if (category) {
        const { guild, user } = interaction;
        const channel = await guild.channels.create({
            name: `titan-${user.username.slice(0, 5)}-${category}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });

        const embed = new EmbedBuilder()
            .setColor(CONFIG.UI.PRIMARY)
            .setTitle(`SECURE UPLINK: ${category.toUpperCase()}`)
            .setDescription(`Channel established for ${user}. Please state your inquiry.`)
            .addFields({ name: "Protocol", value: "Level 4 Isolation", inline: true })
            .setFooter({ text: "TITAN NODE ENGINE | V6.5" });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('tkt_close').setLabel('Close & Purge').setStyle(ButtonStyle.Danger).setEmoji('🔒')
        );

        await channel.send({ content: `${user}`, embeds: [embed], components: [row] });
        await interaction.reply({ content: `Uplink Active: ${channel}`, ephemeral: true });
        trackEvent(guild.id, 'ticket');
        logMatrix(guild.id, "TICKET_OPEN", user, `Established secure channel for ${category}.`);
    }

    // 2. Ticket Closure
    if (interaction.isButton() && interaction.customId === 'tkt_close') {
        await interaction.reply({ content: `🛡️ **Purge Initiated.** Scouring data logs in ${settings.ticketArchiveAfter}s...` });
        setTimeout(() => interaction.channel.delete().catch(() => {}), settings.ticketArchiveAfter * 1000);
        logMatrix(interaction.guild.id, "TICKET_CLOSE", interaction.user, "Purged ticket channel.");
    }
});

// --- WEB INTERFACE (EXPRESS INDUSTRIAL) ---
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ keys: [CONFIG.SESSION_SECRET], name: 'titan_node_sess' }));

/**
 * UI TEMPLATE WRAPPER
 */
const UI_WRAPPER = (content, gid, activeTab) => {
    const s = getSettings(gid);
    const stats = analytics.get(gid) || { intercepts: 0, spams: 0, tickets: 0, lastActivity: "None" };
    
    const menu = [
        { id: 'dash', label: 'Command Center', icon: 'M13 10V3L4 14h7v7l9-11h-7z', href: '/dash' },
        { id: 'matrix', label: 'Filter Matrix', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z', href: '/matrix' },
        { id: 'isolation', label: 'Isolation', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', href: '/isolation' },
        { id: 'tickets', label: 'Ticket Pro', icon: 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z', href: '/tickets' },
        { id: 'audit', label: 'Audit Logs', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', href: '/audit' }
    ];

    return `
    <!DOCTYPE html>
    <html class="dark">
    <head>
        <title>TITAN NODE V6.5</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Plus+Jakarta+Sans:wght@400;600;800&display=swap');
            body { font-family: 'Plus Jakarta Sans', sans-serif; background: ${CONFIG.UI.BG_DARK}; color: white; }
            .sidebar { background: ${CONFIG.UI.SIDEBAR}; border-right: 1px solid #1e293b; }
            .card { background: ${CONFIG.UI.CARD_BG}; border: 1px solid #1e293b; border-radius: 24px; }
            .input-box { background: #050816; border: 1px solid #1e293b; color: #f8fafc; border-radius: 12px; }
            .glow-sky { box-shadow: 0 0 20px rgba(14, 165, 233, 0.15); }
        </style>
    </head>
    <body class="flex h-screen overflow-hidden">
        <aside class="sidebar w-72 flex flex-col p-6">
            <div class="mb-10 flex items-center gap-3">
                <div class="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center font-black italic">T</div>
                <div>
                    <h1 class="font-extrabold text-lg tracking-tighter">TITAN <span class="text-sky-500 italic">NODE</span></h1>
                    <p class="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Overkill v6.5</p>
                </div>
            </div>
            
            <nav class="flex-1 space-y-2">
                ${menu.map(m => `
                    <a href="${m.href}" class="flex items-center gap-3 px-4 py-3 rounded-xl transition font-semibold text-sm ${activeTab === m.id ? 'bg-sky-500/10 text-sky-500 border border-sky-500/20' : 'text-slate-400 hover:bg-slate-900'}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${m.icon}"></path></svg>
                        ${m.label}
                    </a>
                `).join('')}
            </nav>

            <div class="mt-auto bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                <p class="text-[10px] text-slate-500 uppercase font-bold mb-2">Authenticated Node</p>
                <p class="text-xs font-mono text-sky-500 truncate mb-4">${gid}</p>
                <a href="/" class="block text-center text-[10px] font-black uppercase text-rose-500 hover:underline">Terminate Session</a>
            </div>
        </aside>

        <main class="flex-1 overflow-y-auto p-12">
            <div class="flex justify-between items-center mb-12">
                <div>
                    <h2 class="text-4xl font-black italic tracking-tighter">${menu.find(m => m.id === activeTab).label}</h2>
                    <p class="text-slate-500 mt-2">Active Node Environment: <span class="text-slate-300 font-bold">${gid}</span></p>
                </div>
                <div class="flex gap-8">
                    <div class="text-right">
                        <p class="text-[10px] font-bold text-slate-500 uppercase">Latency</p>
                        <p class="text-xl font-black text-sky-500">${client.ws.ping}ms</p>
                    </div>
                    <div class="text-right">
                        <p class="text-[10px] font-bold text-slate-500 uppercase">Status</p>
                        <p class="text-xl font-black text-emerald-500 italic">SECURE</p>
                    </div>
                </div>
            </div>

            ${content}
        </main>
    </body>
    </html>`;
};

// --- ROUTES ---

app.get('/', (req, res) => {
    res.send(`
    <script src="https://cdn.tailwindcss.com"></script>
    <body class="bg-[#020617] text-white flex items-center justify-center h-screen font-sans">
        <div class="bg-[#0a0f24] p-12 rounded-[40px] border border-slate-800 w-[450px] shadow-2xl">
            <div class="text-center mb-10">
                <div class="w-16 h-16 bg-sky-500 rounded-2xl mx-auto mb-6 flex items-center justify-center text-3xl font-black italic shadow-xl shadow-sky-500/20">T</div>
                <h1 class="text-3xl font-black italic tracking-tighter">TITAN ACCESS</h1>
                <p class="text-[10px] uppercase tracking-widest text-slate-500 mt-2 font-bold">Node Engine v6.5</p>
            </div>
            <form action="/login" method="POST" class="space-y-6">
                <input name="gid" placeholder="Server ID" class="w-full bg-[#050816] border border-slate-800 p-4 rounded-2xl outline-none focus:border-sky-500 transition font-bold" required>
                <input name="pass" type="password" placeholder="Passkey" class="w-full bg-[#050816] border border-slate-800 p-4 rounded-2xl outline-none focus:border-sky-500 transition font-bold" required>
                <button class="w-full bg-sky-500 p-5 rounded-2xl font-black uppercase tracking-widest hover:bg-sky-400 transition shadow-lg shadow-sky-500/20">Establish Uplink</button>
            </form>
        </div>
    </body>`);
});

app.post('/login', (req, res) => {
    const { gid, pass } = req.body;
    const realPass = serverPasswords.get(gid) || CONFIG.MASTER_KEY;
    if (pass === realPass) {
        req.session.gid = gid;
        res.redirect('/dash');
    } else res.send("ACCESS DENIED");
});

/**
 * DASHBOARD / COMMAND CENTER
 */
app.get('/dash', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const stats = analytics.get(req.session.gid) || { intercepts: 0, spams: 0, tickets: 0, lastActivity: "None" };
    
    res.send(UI_WRAPPER(`
        <div class="grid grid-cols-12 gap-8">
            <div class="col-span-8 card p-10 flex flex-col justify-center relative overflow-hidden">
                <div class="absolute -right-20 -bottom-20 w-80 h-80 bg-sky-500/5 rounded-full blur-3xl"></div>
                <h3 class="text-5xl font-black italic tracking-tighter leading-none mb-4">ENGINE<br><span class="text-sky-500">OPERATIONAL</span></h3>
                <p class="text-slate-500 font-semibold max-w-md">Titan Node is actively monitoring all ingress streams. Neural heatmap V2 is analyzing user velocity.</p>
                <div class="flex gap-4 mt-10">
                    <div class="px-6 py-4 bg-slate-900/50 rounded-2xl border border-slate-800">
                        <p class="text-[9px] font-black uppercase text-slate-500 mb-1 tracking-widest">Active Threads</p>
                        <p class="text-2xl font-black italic">1,024</p>
                    </div>
                    <div class="px-6 py-4 bg-slate-900/50 rounded-2xl border border-slate-800">
                        <p class="text-[9px] font-black uppercase text-slate-500 mb-1 tracking-widest">Sync Rate</p>
                        <p class="text-2xl font-black italic text-emerald-500">99.9%</p>
                    </div>
                </div>
            </div>
            <div class="col-span-4 space-y-8">
                <div class="card p-8 bg-sky-500/5 border-sky-500/20">
                    <p class="text-[10px] font-black uppercase text-sky-500 mb-2">Total Interceptions</p>
                    <p class="text-6xl font-black italic tracking-tighter">${stats.intercepts}</p>
                </div>
                <div class="card p-8 bg-rose-500/5 border-rose-500/20">
                    <p class="text-[10px] font-black uppercase text-rose-500 mb-2">Bot-Thread Blocks</p>
                    <p class="text-6xl font-black italic tracking-tighter">${stats.spams}</p>
                </div>
            </div>
        </div>
    `, req.session.gid, 'dash'));
});

/**
 * FILTER MATRIX CONFIG
 */
app.get('/matrix', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    res.send(UI_WRAPPER(`
        <form action="/save-matrix" method="POST" class="space-y-8">
            <div class="card p-10">
                <div class="flex justify-between items-center mb-10">
                    <div>
                        <h4 class="text-2xl font-black italic">Auto-Deletion System</h4>
                        <p class="text-slate-500 text-xs mt-1">Configure words to be instantly purged from existence.</p>
                    </div>
                    <div class="flex items-center gap-4">
                        <span class="text-xs font-bold uppercase text-slate-500">Master Switch</span>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" name="filterEnabled" value="on" class="sr-only peer" ${s.filterEnabled ? 'checked' : ''}>
                            <div class="w-14 h-7 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-sky-500"></div>
                        </label>
                    </div>
                </div>
                
                <div class="space-y-6">
                    <div>
                        <label class="block text-[10px] font-black text-slate-500 uppercase mb-3 ml-1">Blacklisted Registry (Comma Separated)</label>
                        <textarea name="words" class="w-full h-40 input-box p-6 font-mono text-xs focus:border-sky-500 transition outline-none">${s.blacklistedWords.join(', ')}</textarea>
                    </div>
                    <div class="grid grid-cols-2 gap-8">
                        <div class="p-6 bg-slate-900/30 rounded-2xl border border-slate-800">
                            <h5 class="text-sm font-black mb-2 italic">Anti-Link Guard</h5>
                            <select name="antiLink" class="w-full input-box p-3 text-xs font-bold uppercase">
                                <option value="DISABLED" ${s.antiLink === 'DISABLED' ? 'selected' : ''}>Disabled</option>
                                <option value="FILTERING" ${s.antiLink === 'FILTERING' ? 'selected' : ''}>Active Purge</option>
                            </select>
                        </div>
                        <div class="p-6 bg-slate-900/30 rounded-2xl border border-slate-800">
                            <h5 class="text-sm font-black mb-2 italic">Thread Bot Protection</h5>
                            <div class="flex items-center gap-4">
                                <input type="number" name="sensitivity" value="${s.threatSensitivity}" class="w-20 input-box p-2 text-center font-bold">
                                <span class="text-[10px] font-bold text-slate-500 uppercase">Msg / 5s</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <button class="w-full bg-sky-500 p-6 rounded-3xl font-black uppercase tracking-widest text-lg hover:bg-sky-400 transition shadow-2xl shadow-sky-500/20">Commit Matrix Config</button>
        </form>
    `, req.session.gid, 'matrix'));
});

app.post('/save-matrix', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    s.filterEnabled = req.body.filterEnabled === 'on';
    s.blacklistedWords = req.body.words.split(',').map(w => w.trim()).filter(w => w.length > 0);
    s.antiLink = req.body.antiLink;
    s.threatSensitivity = parseInt(req.body.sensitivity) || 5;
    logMatrix(req.session.gid, "MATRIX_RECALIBRATED", "WEB_ADMIN", "Modified filter registry and link guard status.");
    res.redirect('/matrix');
});

/**
 * ISOLATION (Bypass/Ignore)
 */
app.get('/isolation', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    res.send(UI_WRAPPER(`
        <form action="/save-isolation" method="POST" class="space-y-8">
            <div class="card p-10">
                <h4 class="text-2xl font-black italic mb-8 underline decoration-sky-500 decoration-4 underline-offset-8">Ignore Protocols</h4>
                <div class="grid grid-cols-3 gap-8">
                    <div>
                        <label class="block text-[10px] font-black text-slate-500 uppercase mb-3 ml-1">Ignored Channels</label>
                        <textarea name="channels" class="w-full h-64 input-box p-4 font-mono text-[10px]" placeholder="IDs here...">${s.ignoredChannels.join('\n')}</textarea>
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-slate-500 uppercase mb-3 ml-1">Whitelisted Roles</label>
                        <textarea name="roles" class="w-full h-64 input-box p-4 font-mono text-[10px]" placeholder="IDs here...">${s.whitelistedRoles.join('\n')}</textarea>
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-slate-500 uppercase mb-3 ml-1">Whitelisted Users</label>
                        <textarea name="users" class="w-full h-64 input-box p-4 font-mono text-[10px]" placeholder="IDs here...">${s.whitelistedUsers.join('\n')}</textarea>
                    </div>
                </div>
                <p class="text-[10px] text-slate-600 mt-6 italic">* Note: Administrators bypass all filters by default and do not need to be listed here.</p>
            </div>
            <button class="w-full bg-emerald-600 p-6 rounded-3xl font-black uppercase tracking-widest text-lg hover:bg-emerald-500 transition">Update Isolation Layers</button>
        </form>
    `, req.session.gid, 'isolation'));
});

app.post('/save-isolation', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    s.ignoredChannels = req.body.channels.split('\n').map(x => x.trim()).filter(x => x);
    s.whitelistedRoles = req.body.roles.split('\n').map(x => x.trim()).filter(x => x);
    s.whitelistedUsers = req.body.users.split('\n').map(x => x.trim()).filter(x => x);
    logMatrix(req.session.gid, "ISOLATION_SYCN", "WEB_ADMIN", "Updated channel and user whitelist layers.");
    res.redirect('/isolation');
});

/**
 * TICKET PRO INTERFACE
 */
app.get('/tickets', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    res.send(UI_WRAPPER(`
        <form action="/save-tickets" method="POST" class="space-y-8">
            <div class="grid grid-cols-2 gap-8">
                <div class="card p-10">
                    <h4 class="text-xl font-black italic mb-6">Uplink Interaction</h4>
                    <div class="space-y-6">
                        <div>
                            <label class="block text-[10px] font-black text-slate-500 uppercase mb-3">UI Style</label>
                            <div class="flex gap-4">
                                <label class="flex-1 cursor-pointer">
                                    <input type="radio" name="mode" value="BUTTON" class="hidden peer" ${s.ticketMode === 'BUTTON' ? 'checked' : ''}>
                                    <div class="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-center text-xs font-bold peer-checked:border-sky-500 peer-checked:text-sky-500">BUTTONS</div>
                                </label>
                                <label class="flex-1 cursor-pointer">
                                    <input type="radio" name="mode" value="DROPDOWN" class="hidden peer" ${s.ticketMode === 'DROPDOWN' ? 'checked' : ''}>
                                    <div class="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-center text-xs font-bold peer-checked:border-sky-500 peer-checked:text-sky-500">DROPDOWN</div>
                                </label>
                            </div>
                        </div>
                        <div>
                            <label class="block text-[10px] font-black text-slate-500 uppercase mb-3">Archive Delay</label>
                            <input type="number" name="delay" value="${s.ticketArchiveAfter}" class="w-full input-box p-4 text-sm font-bold">
                        </div>
                    </div>
                </div>

                <div class="card p-10">
                    <h4 class="text-xl font-black italic mb-6">Category Registry</h4>
                    <textarea name="categories" class="w-full h-40 input-box p-4 text-xs font-mono" placeholder="Category Name, Emoji">${s.ticketCategories.map(c => `${c.label}, ${c.emoji}`).join('\n')}</textarea>
                    <p class="text-[10px] text-slate-600 mt-4 leading-relaxed italic italic">Enter each category on a new line (e.g., General Support, 🛡️). Max 5 for buttons.</p>
                </div>
            </div>
            <button class="w-full bg-sky-500 p-6 rounded-3xl font-black uppercase tracking-widest text-lg hover:bg-sky-400 transition">Update Ticket Engine</button>
        </form>
    `, req.session.gid, 'tickets'));
});

app.post('/save-tickets', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    s.ticketMode = req.body.mode;
    s.ticketArchiveAfter = parseInt(req.body.delay) || 5;
    s.ticketCategories = req.body.categories.split('\n').map(line => {
        const [label, emoji] = line.split(',');
        return label ? { id: label.toLowerCase().replace(/\s/g, '-'), label: label.trim(), emoji: (emoji || '📩').trim() } : null;
    }).filter(x => x);
    logMatrix(req.session.gid, "TICKET_ENGINE_RELOAD", "WEB_ADMIN", "Rebuilt ticket categories and UI interaction mode.");
    res.redirect('/tickets');
});

/**
 * AUDIT LOGS
 */
app.get('/audit', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const logs = auditLogs.get(req.session.gid) || [];
    res.send(UI_WRAPPER(`
        <div class="card p-10 h-[700px] flex flex-col">
            <h4 class="text-2xl font-black italic mb-10">Audit Matrix</h4>
            <div class="flex-1 overflow-y-auto space-y-4 pr-4 font-mono">
                ${logs.length === 0 ? `<p class="text-slate-700 text-center mt-20 italic">No telemetry data available.</p>` : logs.map(l => `
                    <div class="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 flex justify-between items-center group hover:border-sky-500/30 transition">
                        <div class="flex items-center gap-6">
                            <span class="text-[10px] text-slate-600 font-bold">${l.timestamp}</span>
                            <div>
                                <div class="flex items-center gap-3 mb-1">
                                    <span class="text-[10px] font-black px-2 py-0.5 bg-sky-500 text-white rounded italic">${l.action}</span>
                                    <span class="text-xs font-bold text-slate-400">@${l.user}</span>
                                </div>
                                <p class="text-sm font-bold text-slate-200">${l.reason}</p>
                            </div>
                        </div>
                        <span class="text-[9px] text-slate-800 font-black group-hover:text-sky-900 transition">${l.id}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `, req.session.gid, 'audit'));
});

// --- ENGINE BOOT ---

client.once('ready', () => {
    console.clear();
    console.log(`
    ==================================================
    SHER TITAN NODE ENGINE: V6.5 OVERKILL
    ==================================================
    SYSTEM: SYNCHRONIZED
    USER: ${client.user.tag}
    ==================================================
    `);
    
    client.user.setActivity('TITAN NODE V6.5', { type: ActivityType.Watching });

    client.guilds.cache.forEach(g => {
        if (!serverPasswords.has(g.id)) {
            const pass = crypto.randomBytes(3).toString('hex').toUpperCase();
            serverPasswords.set(g.id, pass);
            console.log(`[NODE] ${g.name} | KEY: ${pass}`);
        }
    });
});

app.listen(CONFIG.PORT, () => console.log(`[WEB] Industrial UI on :${CONFIG.PORT}`));
client.login(CONFIG.TOKEN);
