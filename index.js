/**
 * SHER LOCK PRO - TITAN ULTRA (INDUSTRIAL CORE)
 * --------------------------------------------
 * VERSION: 4.0.0 - MAXIMUM CAPACITY
 * * DESIGNED FOR: HIGH-TRAFFIC DISCORD ENVIRONMENTS
 * * * MODULES:
 * - Security Grid: Anti-Link, Anti-Nuke, Anti-Ghost Ping, Anti-Mass Mention
 * - Auto-Mod: Role/Bot/Thread Sensitive Auto-Deletion
 * - Help Desk: Secure Uplink Ticketing with Web-Based Transcript Previews
 * - Mainframe: Telemetry, Analytics, and Multi-Node Audit Logging
 * - Admin Panel: Password-Protected Glassmorphism Dashboard
 */

require('dotenv').config();
const { 
    Client, GatewayIntentBits, Partials, ActivityType, PermissionFlagsBits, 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    ChannelType, REST, Routes, SlashCommandBuilder, Events, Collection,
    AuditLogEvent
} = require('discord.js');
const express = require('express');
const session = require('cookie-session');
const bodyParser = require('body-parser');
const crypto = require('crypto');

// --- SYSTEM ARCHITECTURE CONFIG ---
const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    PORT: process.env.PORT || 10000,
    SESSION_SECRET: process.env.SESSION_SECRET || 'titan-industrial-v4-ultra',
    BASE_URL: process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 10000}`,
    BOOT_TIME: Date.now(),
    VERSION: "4.0.0-ULTRA"
};

// --- DATA PERSISTENCE GRIDS ---
const db = new Map();
const serverPasswords = new Map();
const auditLogs = new Map(); 
const analytics = new Map();
const ghostPingCache = new Collection();
const ticketCache = new Map();
const ticketTranscripts = new Map(); 
const nukeRadar = new Map(); // Detects rapid guild changes/deletions

/**
 * SETTINGS MANIFEST
 * The core configuration for every connected Discord Node.
 */
const getSettings = (gid) => {
    if (!db.has(gid)) {
        db.set(gid, {
            logChannelId: "",
            modRoleIds: [],
            antiLink: true,
            antiGhostPing: true,
            antiMassMention: true,
            maxMentions: 5,
            ignoreAdmins: true, 
            ignoreBots: true,   
            ignoreThreads: true, // NEW: Prevent thread interference
            blacklist: ["discord.gg/", "token-grabber"],
            autoDeleteChannels: [],
            deleteDelay: 3000,
            panelColor: "#0ea5e9",
            panelTitle: "📡 TITAN SECURITY HUB",
            panelDesc: "High-fidelity security protocols active. Uplink status: ONLINE."
        });
    }
    return db.get(gid);
};

/**
 * TELEMETRY ENGINE
 */
const trackEvent = (gid, key, value = 1) => {
    if (!analytics.has(gid)) {
        analytics.set(gid, { messages: 0, threats: 0, tickets: 0, deletions: 0 });
    }
    const data = analytics.get(gid);
    if (data[key] !== undefined) data[key] += value;
};

/**
 * AUDIT LOGGING BUFFER
 */
const logToAudit = (gid, action, user, reason) => {
    if (!auditLogs.has(gid)) auditLogs.set(gid, []);
    const logs = auditLogs.get(gid);
    logs.unshift({ 
        id: crypto.randomBytes(4).toString('hex').toUpperCase(), 
        time: new Date().toLocaleTimeString(), 
        action, 
        user: user?.tag || user || "System", 
        reason 
    });
    if (logs.length > 100) logs.pop();
};

// --- CLIENT INITIALIZATION ---
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

// --- MESSAGE PROCESSING LOGIC ---

client.on(Events.MessageCreate, async (msg) => {
    if (!msg.guild || !msg.author) return;
    
    const s = getSettings(msg.guild.id);
    trackEvent(msg.guild.id, 'messages');

    // PROTOCOL: THREAD PROTECTION
    if (s.ignoreThreads && msg.channel.isThread()) return;

    // PROTOCOL: TICKET TRANSCRIPT RECORDING
    for (const [userId, channelId] of ticketCache.entries()) {
        if (channelId === msg.channel.id) {
            if (!ticketTranscripts.has(channelId)) ticketTranscripts.set(channelId, []);
            const log = ticketTranscripts.get(channelId);
            log.push({ 
                author: msg.author.tag, 
                content: msg.content || "[Non-Text Media]", 
                time: new Date().toLocaleTimeString() 
            });
            if (log.length > 200) log.shift();
        }
    }

    // PROTOCOL: GHOST PING DETECTION
    if (msg.mentions.users.size > 0 || msg.mentions.everyone || msg.mentions.roles.size > 0) {
        ghostPingCache.set(msg.id, { 
            author: msg.author, 
            content: msg.content, 
            ts: Date.now(),
            channel: msg.channel.name 
        });
        setTimeout(() => ghostPingCache.delete(msg.id), 120000); 
    }

    // PROTOCOL: AUTO-DELETION ENGINE
    if (s.autoDeleteChannels.includes(msg.channel.id)) {
        // Apply bypass checks even to auto-delete
        const isAdmin = msg.member?.permissions.has(PermissionFlagsBits.Administrator);
        const isBot = msg.author.bot;
        
        if (!(s.ignoreAdmins && isAdmin) && !(s.ignoreBots && isBot)) {
            setTimeout(() => {
                msg.delete().catch(() => {});
                trackEvent(msg.guild.id, 'deletions');
            }, s.deleteDelay);
        }
    }

    // GLOBAL BYPASS: IGNORE BOTS
    if (s.ignoreBots && msg.author.bot) return;

    // GLOBAL BYPASS: IGNORE ADMINS
    if (s.ignoreAdmins && msg.member?.permissions.has(PermissionFlagsBits.Administrator)) return;
    if (msg.member?.permissions.has(PermissionFlagsBits.ManageMessages)) return;

    // PROTOCOL: MODERATION FILTERS
    let violation = null;
    if (s.antiLink && /(https?:\/\/[^\s]+)/g.test(msg.content)) violation = "Link Sharing";
    if (s.antiMassMention && msg.mentions.users.size > s.maxMentions) violation = "Mass Mention";
    if (s.blacklist.some(w => msg.content.toLowerCase().includes(w.toLowerCase()))) violation = "Restricted Phrase";

    if (violation) {
        trackEvent(msg.guild.id, 'threats');
        msg.delete().catch(() => {});
        logToAudit(msg.guild.id, "INTERCEPT", msg.author, violation);
        
        const guard = await msg.channel.send({
            embeds: [
                new EmbedBuilder()
                .setDescription(`🛡️ **TITAN INTERCEPT:** Warning for <@${msg.author.id}> (\`${violation}\`)`)
                .setColor("#f43f5e")
            ]
        });
        setTimeout(() => guard.delete().catch(() => {}), 5000);
    }
});

// --- GHOST PING RADAR ---
client.on(Events.MessageDelete, async (msg) => {
    if (!msg.guild) return;
    const s = getSettings(msg.guild.id);
    
    if (s.antiGhostPing && ghostPingCache.has(msg.id)) {
        const data = ghostPingCache.get(msg.id);
        const logChannel = msg.guild.channels.cache.get(s.logChannelId);
        
        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle("🚨 GHOST PING RADAR")
                .setThumbnail(data.author.displayAvatarURL())
                .addFields(
                    { name: "Offender", value: `<@${data.author.id}> (${data.author.tag})`, inline: true },
                    { name: "Channel", value: `#${data.channel}`, inline: true },
                    { name: "Detected Content", value: data.content || "*Media/Embed Only*" }
                )
                .setTimestamp()
                .setColor("#fbbf24")
                .setFooter({ text: "Titan Ultra Security" });
            
            logChannel.send({ embeds: [embed] });
        }
        ghostPingCache.delete(msg.id);
    }
});

// --- ANTI-NUKE PROTOCOLS ---
client.on(Events.ChannelDelete, async (channel) => {
    if (!channel.guild) return;
    const s = getSettings(channel.guild.id);
    const gid = channel.guild.id;

    if (!nukeRadar.has(gid)) nukeRadar.set(gid, []);
    const deletions = nukeRadar.get(gid);
    deletions.push(Date.now());

    // Filter for rapid deletions (e.g., 4 in 15 seconds)
    const recent = deletions.filter(t => Date.now() - t < 15000);
    nukeRadar.set(gid, recent);

    if (recent.length >= 4) {
        logToAudit(gid, "ANTI_NUKE", "System", "Mass Channel Deletion Prevented/Logged");
        const logChannel = channel.guild.channels.cache.get(s.logChannelId);
        if (logChannel) {
            logChannel.send("☢️ **CRITICAL:** Rapid channel deletions detected. High alert.");
        }
    }
});

// --- INTERACTION HANDLERS (TICKETS & SLASH COMMANDS) ---

client.on(Events.InteractionCreate, async (i) => {
    if (!i.guild) return;
    const s = getSettings(i.guild.id);

    if (i.isButton()) {
        const { customId, user, guild, channel } = i;

        if (customId === 'tkt_open') {
            if (ticketCache.has(user.id)) {
                return i.reply({ content: "⚠️ An active uplink session is already open.", ephemeral: true });
            }
            
            await i.deferReply({ ephemeral: true });
            
            try {
                const ticketChannel = await guild.channels.create({
                    name: `tkt-${user.username}`,
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                        ...s.modRoleIds.map(rid => ({ id: rid, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }))
                    ]
                });

                ticketCache.set(user.id, ticketChannel.id);
                trackEvent(guild.id, 'tickets');
                logToAudit(guild.id, "TICKET_OPEN", user, `Created: #${ticketChannel.name}`);

                const controls = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('tkt_claim').setLabel('Claim Session').setStyle(ButtonStyle.Success).setEmoji('🛡️'),
                    new ButtonBuilder().setCustomId('tkt_close').setLabel('Close Uplink').setStyle(ButtonStyle.Danger).setEmoji('🔒')
                );

                await ticketChannel.send({ 
                    content: `📡 **SECURE UPLINK ESTABLISHED** | <@${user.id}>`, 
                    embeds: [
                        new EmbedBuilder()
                        .setTitle("🔒 ENCRYPTED CHANNEL")
                        .setDescription("Titan Help Desk is active. State your inquiry. All messages are logged to the dashboard.")
                        .setColor(s.panelColor)
                        .setFooter({ text: "Titan Ultra Transcript Protocol" })
                    ], 
                    components: [controls] 
                });
                
                i.editReply(`✅ Uplink initialized: <#${ticketChannel.id}>`);
            } catch (err) {
                console.error(err);
                i.editReply("❌ System Failure: Could not create ticket channel.");
            }
        }

        if (customId === 'tkt_claim') {
            i.reply(`🛡️ **Session Claimed** by <@${user.id}>.`);
            logToAudit(guild.id, "TICKET_CLAIM", user, `Claimed ticket in #${channel.name}`);
        }

        if (customId === 'tkt_close') {
            i.reply("☢️ **TERMINATING:** Wiping session data and archiving logs...");
            logToAudit(guild.id, "TICKET_CLOSE", user, `Terminated ticket #${channel.name}`);
            
            setTimeout(() => {
                for (const [uid, cid] of ticketCache.entries()) {
                    if (cid === channel.id) ticketCache.delete(uid);
                }
                ticketTranscripts.delete(channel.id);
                channel.delete().catch(() => {});
            }, 5000);
        }
    }

    if (i.isChatInputCommand()) {
        const { commandName, options, member } = i;

        if (commandName === 'terminal') {
            const pass = serverPasswords.get(i.guild.id) || "NOT_READY";
            const embed = new EmbedBuilder()
                .setTitle("📡 MAIN FRAME TERMINAL")
                .setThumbnail(client.user.displayAvatarURL())
                .addFields(
                    { name: "Access Node", value: `\`${i.guild.id}\``, inline: true },
                    { name: "Access Key", value: `\`${pass}\``, inline: true },
                    { name: "Uplink URL", value: CONFIG.BASE_URL }
                )
                .setColor("#0ea5e9")
                .setFooter({ text: "Do not share these credentials." });

            i.reply({ embeds: [embed], ephemeral: true });
        }

        if (commandName === 'deploy') {
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return i.reply({ content: "Insufficient clearance.", ephemeral: true });
            }
            const target = options.getChannel('channel');
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('tkt_open').setLabel('Contact Support').setStyle(ButtonStyle.Primary).setEmoji('🎫')
            );

            await target.send({ 
                embeds: [
                    new EmbedBuilder()
                    .setTitle(s.panelTitle)
                    .setDescription(s.panelDesc)
                    .setColor(s.panelColor)
                    .setThumbnail(i.guild.iconURL())
                ], 
                components: [row] 
            });

            i.reply({ content: `✅ Deployed Hub to <#${target.id}>`, ephemeral: true });
        }
    }
});

// --- BOOT SEQUENCE ---

client.once('ready', async () => {
    console.log(`[CORE] Titan Ultra Core v${CONFIG.VERSION} online.`);
    client.user.setActivity("Security Mainframe", { type: ActivityType.Watching });

    const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
    const commands = [
        new SlashCommandBuilder().setName('terminal').setDescription('Get dashboard access credentials'),
        new SlashCommandBuilder().setName('deploy').setDescription('Deploy the Ticket Hub').addChannelOption(o => o.setName('channel').setRequired(true).setDescription('Target channel'))
    ];

    client.guilds.cache.forEach(async (guild) => {
        try {
            await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: commands });
            if (!serverPasswords.has(guild.id)) {
                serverPasswords.set(guild.id, crypto.randomBytes(4).toString('hex').toUpperCase());
            }
        } catch (e) {
            console.error(`[REST] Guild ${guild.id} failed registration.`);
        }
    });
});

// --- DASHBOARD SYSTEM (EXPRESS) ---

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ 
    keys: [CONFIG.SESSION_SECRET], 
    name: 'titan_v4_session',
    maxAge: 24 * 60 * 60 * 1000 
}));

/**
 * GLASSMORPHISM UI WRAPPER
 */
const renderUI = (content, gid) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;500;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Space Grotesk', sans-serif; background: #020617; color: #f1f5f9; }
        .glass { background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.05); }
        .sidebar-item { transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .sidebar-item:hover { background: rgba(14, 165, 233, 0.15); color: #38bdf8; transform: translateX(5px); }
        .sidebar-item.active { background: #0ea5e9; color: white; box-shadow: 0 10px 25px -5px rgba(14, 165, 233, 0.4); }
        .card { background: rgba(30, 41, 59, 0.4); border-radius: 2rem; border: 1px solid rgba(255,255,255,0.03); transition: 0.3s; }
        .card:hover { border-color: rgba(14, 165, 233, 0.2); transform: translateY(-5px); }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 20px; }
    </style>
</head>
<body class="flex h-screen overflow-hidden">
    <nav class="w-80 glass m-6 rounded-[2.5rem] flex flex-col p-8 shadow-2xl overflow-y-auto">
        <div class="flex items-center gap-3 mb-10">
            <div class="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center font-bold text-white shadow-lg shadow-sky-500/20">T</div>
            <h1 class="text-2xl font-black tracking-tighter">TITAN <span class="text-sky-500">ULTRA</span></h1>
        </div>
        
        <div class="flex-1 space-y-2">
            <p class="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] px-4 mb-4">Operations</p>
            <a href="/dash" class="sidebar-item flex items-center gap-4 p-4 rounded-2xl font-medium">📊 Telemetry</a>
            <a href="/security" class="sidebar-item flex items-center gap-4 p-4 rounded-2xl font-medium">🛡️ Security Grids</a>
            <a href="/previews" class="sidebar-item flex items-center gap-4 p-4 rounded-2xl font-medium">🎫 Ticket Previews</a>
            <a href="/audits" class="sidebar-item flex items-center gap-4 p-4 rounded-2xl font-medium">📜 Audit Buffer</a>
        </div>

        <div class="pt-6 border-t border-slate-800">
            <a href="/logout" class="flex items-center gap-4 p-4 rounded-2xl font-bold text-rose-400 hover:bg-rose-500/10 transition">🔌 DISCONNECT</a>
        </div>
    </nav>

    <main class="flex-1 p-10 overflow-y-auto">
        <header class="flex justify-between items-center mb-10">
            <div>
                <h2 class="text-4xl font-black tracking-tight text-white">System Protocol</h2>
                <p class="text-slate-500">Active Uplink: ${gid}</p>
            </div>
            <div class="flex items-center gap-4">
                <div class="text-right">
                    <p class="text-xs text-slate-500 font-bold uppercase">Status</p>
                    <p class="text-sky-400 font-bold">NODE OPERATIONAL</p>
                </div>
            </div>
        </header>
        ${content}
    </main>
</body>
</html>`;

// --- ROUTE DEFINITIONS ---

app.get('/', (req, res) => {
    res.send(`
    <body style="background:#020617;display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;color:white">
        <form action="/login" method="POST" style="background:rgba(15,23,42,0.8);padding:60px;border-radius:50px;width:450px;text-align:center;backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.05)">
            <h1 style="color:#0ea5e9;font-size:3.5rem;font-weight:900;margin-bottom:10px;letter-spacing:-2px">TITAN</h1>
            <p style="color:#64748b;margin-bottom:40px;font-weight:500">Security Mainframe Uplink</p>
            <input name="gid" placeholder="Node ID (Guild)" style="width:100%;padding:20px;margin-bottom:15px;background:#020617;border:1px solid #1e293b;color:white;border-radius:20px;outline:none">
            <input name="pass" type="password" placeholder="Access Key" style="width:100%;padding:20px;margin-bottom:30px;background:#020617;border:1px solid #1e293b;color:white;border-radius:20px;outline:none">
            <button style="width:100%;padding:20px;background:#0ea5e9;color:white;border:none;border-radius:20px;font-weight:900;cursor:pointer;font-size:1.1rem;box-shadow:0 10px 20px -5px rgba(14,165,233,0.3)">AUTHENTICATE</button>
        </form>
    </body>`);
});

app.post('/login', (req, res) => {
    const { gid, pass } = req.body;
    if (serverPasswords.get(gid) === pass?.toUpperCase()) {
        req.session.gid = gid;
        res.redirect('/dash');
    } else {
        res.send("<script>alert('AUTHENTICATION FAILED');window.location='/';</script>");
    }
});

app.get('/dash', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const stats = analytics.get(req.session.gid) || { messages: 0, threats: 0, tickets: 0, deletions: 0 };
    res.send(renderUI(`
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div class="card p-8 border-b-4 border-sky-500"><p class="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Network Traffic</p><h3 class="text-5xl font-black mt-2">${stats.messages}</h3></div>
            <div class="card p-8 border-b-4 border-rose-500"><p class="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Neutralized</p><h3 class="text-5xl font-black mt-2">${stats.threats}</h3></div>
            <div class="card p-8 border-b-4 border-emerald-500"><p class="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Support Uplinks</p><h3 class="text-5xl font-black mt-2">${stats.tickets}</h3></div>
            <div class="card p-8 border-b-4 border-purple-500"><p class="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Auto-Purged</p><h3 class="text-5xl font-black mt-2">${stats.deletions}</h3></div>
        </div>
        <div class="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="card p-10"><h4 class="font-bold text-xl mb-4">Core Status</h4><p class="text-slate-400">Node v4.0.0-Ultra is currently syncing with Discord Gateway. Memory usage is nominal. All security modules are hot-loaded and operational.</p></div>
            <div class="card p-10"><h4 class="font-bold text-xl mb-4">Active Modules</h4><div class="flex flex-wrap gap-2"><span class="bg-sky-500/10 text-sky-400 px-3 py-1 rounded-full text-xs font-bold">ANTI-NUKE</span><span class="bg-sky-500/10 text-sky-400 px-3 py-1 rounded-full text-xs font-bold">RADAR-PULSE</span><span class="bg-sky-500/10 text-sky-400 px-3 py-1 rounded-full text-xs font-bold">AUTO-MOD</span></div></div>
        </div>
    `, req.session.gid));
});

app.get('/security', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    res.send(renderUI(`
        <form action="/save" method="POST" class="space-y-6">
            <div class="card p-10">
                <h3 class="text-2xl font-bold mb-8 flex items-center gap-4"><div class="w-2 h-8 bg-sky-500 rounded-full"></div> Grid Configuration</h3>
                <div class="space-y-8">
                    <div>
                        <label class="block text-slate-500 font-bold mb-4 uppercase text-xs tracking-widest">Auto-Delete Channels (Comma Separated IDs)</label>
                        <input name="autoDeleteChannels" value="${s.autoDeleteChannels.join(',')}" class="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl text-white outline-none focus:border-sky-500 transition">
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label class="block text-slate-500 font-bold mb-4 uppercase text-xs tracking-widest">Ignore Admins</label>
                            <select name="ignoreAdmins" class="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl text-white">
                                <option value="true" ${s.ignoreAdmins?'selected':''}>ENABLED</option>
                                <option value="false" ${!s.ignoreAdmins?'selected':''}>DISABLED</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-slate-500 font-bold mb-4 uppercase text-xs tracking-widest">Ignore Bots</label>
                            <select name="ignoreBots" class="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl text-white">
                                <option value="true" ${s.ignoreBots?'selected':''}>ENABLED</option>
                                <option value="false" ${!s.ignoreBots?'selected':''}>DISABLED</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-slate-500 font-bold mb-4 uppercase text-xs tracking-widest">Ignore Threads</label>
                            <select name="ignoreThreads" class="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl text-white">
                                <option value="true" ${s.ignoreThreads?'selected':''}>ENABLED</option>
                                <option value="false" ${!s.ignoreThreads?'selected':''}>DISABLED</option>
                            </select>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label class="block text-slate-500 font-bold mb-4 uppercase text-xs tracking-widest">Anti-Link Protocol</label>
                            <select name="antiLink" class="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl text-white">
                                <option value="true" ${s.antiLink?'selected':''}>ACTIVE</option>
                                <option value="false" ${!s.antiLink?'selected':''}>INACTIVE</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-slate-500 font-bold mb-4 uppercase text-xs tracking-widest">Purge Delay (ms)</label>
                            <input name="deleteDelay" type="number" value="${s.deleteDelay}" class="w-full bg-slate-950 border border-slate-800 p-5 rounded-2xl text-white outline-none">
                        </div>
                    </div>
                </div>
            </div>
            <button class="w-full bg-sky-600 hover:bg-sky-500 p-6 rounded-2xl font-black text-xl shadow-xl shadow-sky-500/20 transition transform active:scale-95">SYNCHRONIZE SECURITY GRID</button>
        </form>
    `, req.session.gid));
});

app.get('/previews', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    let html = ``;
    if (ticketTranscripts.size === 0) {
        html = `<div class="card p-20 text-center text-slate-500 font-bold text-xl italic">No active telemetry from support channels.</div>`;
    } else {
        for (const [chId, msgs] of ticketTranscripts.entries()) {
            html += `
            <div class="card p-10 mb-8 border-l-4 border-sky-500">
                <div class="flex justify-between items-center mb-6">
                    <h4 class="text-sky-400 font-black text-xl">UPLINK CHANNEL: ${chId}</h4>
                    <span class="bg-emerald-500/10 text-emerald-400 px-4 py-1 rounded-full text-[10px] font-bold">STREAMING DATA</span>
                </div>
                <div class="space-y-4 max-h-[400px] overflow-y-auto pr-4 font-mono text-sm bg-slate-950/50 p-6 rounded-3xl border border-slate-800">
                    ${msgs.map(m => `
                        <div class="flex gap-4">
                            <span class="text-slate-600 shrink-0">[${m.time}]</span>
                            <span class="text-sky-500 font-bold shrink-0">${m.author}:</span>
                            <span class="text-slate-300">${m.content}</span>
                        </div>`).join('')}
                </div>
            </div>`;
        }
    }
    res.send(renderUI(html, req.session.gid));
});

app.get('/audits', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const logs = auditLogs.get(req.session.gid) || [];
    res.send(renderUI(`
        <div class="card overflow-hidden">
            <table class="w-full text-left">
                <thead class="bg-slate-950 text-slate-500 uppercase text-[10px] font-bold tracking-[0.2em]">
                    <tr><th class="p-8">Stamp</th><th class="p-8">Action</th><th class="p-8">User</th><th class="p-8">Parameters</th></tr>
                </thead>
                <tbody class="divide-y divide-slate-800">
                    ${logs.map(l => `
                        <tr class="hover:bg-slate-800/30 transition">
                            <td class="p-8 text-slate-500 font-mono text-xs">${l.time}</td>
                            <td class="p-8"><span class="text-sky-400 font-bold">${l.action}</span></td>
                            <td class="p-8 text-slate-300 font-medium">${l.user}</td>
                            <td class="p-8 text-slate-500 italic">${l.reason}</td>
                        </tr>`).join('')}
                </tbody>
            </table>
            ${logs.length === 0 ? '<p class="p-10 text-center text-slate-500">Audit buffer empty.</p>' : ''}
        </div>
    `, req.session.gid));
});

app.post('/save', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    s.autoDeleteChannels = req.body.autoDeleteChannels.split(',').map(id => id.trim()).filter(id => id);
    s.antiLink = req.body.antiLink === 'true';
    s.ignoreAdmins = req.body.ignoreAdmins === 'true';
    s.ignoreBots = req.body.ignoreBots === 'true';
    s.ignoreThreads = req.body.ignoreThreads === 'true';
    s.deleteDelay = parseInt(req.body.deleteDelay) || 3000;
    
    logToAudit(req.session.gid, "GRID_SYNC", "Titan Admin", "Grid parameters updated via dashboard.");
    res.redirect('/security');
});

app.get('/logout', (req, res) => { req.session = null; res.redirect('/'); });

// --- SYSTEM INITIALIZATION ---

app.listen(CONFIG.PORT, () => console.log(`[HTTP] Titan Uplink operational on port ${CONFIG.PORT}`));

client.login(CONFIG.TOKEN).catch(e => {
    console.error("CRITICAL: Discord login failed. Verify token.");
});
