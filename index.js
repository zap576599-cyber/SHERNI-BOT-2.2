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

/**
 * SHER LOCK PRO - OMEGA SENTINEL (V10.FINAL)
 * -----------------------------------------
 * THE ULTIMATE MULTI-SERVER SECURITY SUITE
 * -----------------------------------------
 * SYSTEM CAPABILITIES:
 * - [RADAR] Ghost Ping Detection & Logging
 * - [SWEEP] Multi-Channel Auto-Deletion Engine
 * - [GUARD] Mass-Ping & Malicious Link Interceptor
 * - [UPLINK] Professional Claimable Ticket Tunnels
 * - [COMMAND] Animated Glassmorphism Web Interface
 */

const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    PORT: process.env.PORT || 10000,
    SESSION_SECRET: process.env.SESSION_SECRET || 'omega-sentinel-v10-key',
    BASE_URL: process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 10000}`,
    BOOT_TIME: Date.now()
};

// --- CORE MEMORY GRIDS ---
const db = new Map();
const serverPasswords = new Map();
const auditLogs = new Map(); 
const analytics = new Map();
const ghostPingCache = new Collection();
const ticketCache = new Map();

/**
 * DATABASE INITIALIZER
 * Ensures every server has a clean security manifest on first boot.
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
            blacklist: [],
            autoDeleteChannels: [],
            deleteDelay: 5000,
            ticketCategoryId: "",
            panelColor: "#6366f1",
            panelTitle: "🛡️ OMEGA SECURITY TERMINAL",
            panelDesc: "Establishing a secure connection with the moderation grid. Click below to initialize a private tunnel."
        });
    }
    return db.get(gid);
};

/**
 * AUDIT LOG ENGINE
 * Buffers the last 100 security events per server.
 */
const logAudit = (gid, action, user, reason) => {
    if (!auditLogs.has(gid)) auditLogs.set(gid, []);
    const logs = auditLogs.get(gid);
    logs.unshift({ 
        id: crypto.randomBytes(3).toString('hex').toUpperCase(), 
        time: new Date().toLocaleTimeString(), 
        action, 
        user: user.tag || user, 
        reason 
    });
    if (logs.length > 100) logs.pop();
};

/**
 * ANALYTICS TRACKER
 * Monitors real-time throughput for the dashboard.
 */
const track = (gid, key) => {
    if (!analytics.has(gid)) analytics.set(gid, { messages: 0, threats: 0, tickets: 0 });
    const data = analytics.get(gid);
    if (data[key] !== undefined) data[key]++;
};

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ], 
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
});

// --- DISCORD SECURITY ENGINE ---

client.on(Events.MessageCreate, async (msg) => {
    if (!msg.guild || msg.author.bot) return;
    const s = getSettings(msg.guild.id);
    track(msg.guild.id, 'messages');

    // 1. GHOST PING CACHE (RADAR)
    // We store any message containing pings. If deleted, we log the contents.
    if (msg.mentions.users.size > 0 || msg.mentions.everyone || msg.mentions.roles.size > 0) {
        ghostPingCache.set(msg.id, { 
            author: msg.author, 
            content: msg.content, 
            ts: Date.now(),
            channel: msg.channel.name 
        });
        setTimeout(() => ghostPingCache.delete(msg.id), 120000); // 2 minute cache
    }

    // 2. AUTO-DELETION ENGINE (SWEEP)
    // If the channel is marked for auto-deletion, trigger the countdown.
    if (s.autoDeleteChannels.includes(msg.channel.id)) {
        setTimeout(() => {
            msg.delete().catch(() => {});
        }, s.deleteDelay);
    }

    // 3. STAFF BYPASS
    if (msg.member.permissions.has(PermissionFlagsBits.ManageMessages)) return;

    // 4. THREAT INTERCEPTION (GUARD)
    let violation = null;
    
    // Check for unauthorized links
    if (s.antiLink && /(https?:\/\/[^\s]+)/g.test(msg.content)) {
        violation = "Malicious/Unauthorized Link";
    }
    
    // Check for mass-mention attacks
    if (s.antiMassMention && msg.mentions.users.size > s.maxMentions) {
        violation = `Mass Mention Violation (${msg.mentions.users.size} pings)`;
    }
    
    // Check for blacklisted phrases
    if (s.blacklist.some(w => msg.content.toLowerCase().includes(w.toLowerCase()))) {
        violation = "Blacklisted Phrase Detected";
    }

    if (violation) {
        track(msg.guild.id, 'threats');
        msg.delete().catch(() => {});
        logAudit(msg.guild.id, "INTERCEPTED", msg.author, violation);
        
        const guardMsg = await msg.channel.send({
            embeds: [
                new EmbedBuilder()
                .setDescription(`🛡️ **OMEGA GUARD:** Security violation by <@${msg.author.id}>. Session purged.\n**Reason:** \`${violation}\``)
                .setColor("#f43f5e")
            ]
        });
        setTimeout(() => guardMsg.delete().catch(() => {}), 5000);
    }
});

client.on(Events.MessageDelete, async (msg) => {
    if (!msg.guild) return;
    const s = getSettings(msg.guild.id);
    
    if (s.antiGhostPing && ghostPingCache.has(msg.id)) {
        const data = ghostPingCache.get(msg.id);
        const logChannel = msg.guild.channels.cache.get(s.logChannelId);
        
        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle("🚨 Ghost Ping Detected")
                .setDescription(`A message containing mentions was deleted.`)
                .addFields(
                    { name: "Sender", value: `${data.author.tag} (${data.author.id})`, inline: true },
                    { name: "Channel", value: `#${data.channel}`, inline: true },
                    { name: "Message Content", value: data.content || "*No text content (Media/Embed)*" }
                )
                .setColor("#fbbf24")
                .setTimestamp();
            
            logChannel.send({ embeds: [embed] });
        }
        ghostPingCache.delete(msg.id);
    }
});

// --- INTERACTION HANDLERS (TICKETS & COMMANDS) ---

client.on(Events.InteractionCreate, async (i) => {
    if (!i.guild) return;
    const s = getSettings(i.guild.id);

    // 1. TICKET BUTTON LOGIC
    if (i.isButton()) {
        if (i.customId === 'tkt_open') {
            if (ticketCache.has(i.user.id)) {
                return i.reply({ content: "⚠️ **Access Denied:** You already have an active security tunnel.", ephemeral: true });
            }

            await i.deferReply({ ephemeral: true });

            try {
                const channel = await i.guild.channels.create({
                    name: `tunnel-${i.user.username}`,
                    type: ChannelType.GuildText,
                    parent: s.ticketCategoryId || null,
                    permissionOverwrites: [
                        { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory] },
                        ...s.modRoleIds.map(roleId => ({ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }))
                    ]
                });

                ticketCache.set(i.user.id, channel.id);
                track(i.guild.id, 'tickets');
                logAudit(i.guild.id, "TUNNEL_OPEN", i.user, `Channel: #${channel.name}`);

                const embed = new EmbedBuilder()
                    .setTitle("🔐 SECURE ENCRYPTED UPLINK")
                    .setDescription(`Welcome <@${i.user.id}>. This tunnel is encrypted and visible only to you and the server administration.\n\n**Instructions:**\nState your reason for contact. A staff member will claim this session shortly.`)
                    .setThumbnail(client.user.displayAvatarURL())
                    .setColor(s.panelColor)
                    .setFooter({ text: "Omega Sentinel v10 | Security Protocol Active" });

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('tkt_claim').setLabel('Claim Session').setStyle(ButtonStyle.Success).setEmoji('🛡️'),
                    new ButtonBuilder().setCustomId('tkt_close').setLabel('Decommission').setStyle(ButtonStyle.Danger).setEmoji('☢️')
                );

                await channel.send({ content: `<@${i.user.id}> | <@&${s.modRoleIds[0] || i.guild.ownerId}>`, embeds: [embed], components: [row] });
                i.editReply(`✅ **Uplink Established:** ${channel}`);

            } catch (err) {
                console.error(err);
                i.editReply("❌ **Critical Failure:** Unable to initialize channel permissions.");
            }
        }

        if (i.customId === 'tkt_claim') {
            await i.reply({ content: `🛡️ **Protocol Update:** Session claimed by <@${i.user.id}>.` });
            const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('tkt_close').setLabel('Terminate Session').setStyle(ButtonStyle.Danger).setEmoji('☢️')
            );
            await i.message.edit({ components: [disabledRow] });
            logAudit(i.guild.id, "TUNNEL_CLAIM", i.user, "Staff took control of session.");
        }

        if (i.customId === 'tkt_close') {
            await i.reply("☢️ **DECOMMISSIONING:** Purging tunnel data and deleting channel in 5 seconds...");
            for (const [userId, channelId] of ticketCache.entries()) {
                if (channelId === i.channel.id) ticketCache.delete(userId);
            }
            logAudit(i.guild.id, "TUNNEL_CLOSED", i.user, "Manual decommission.");
            setTimeout(() => i.channel.delete().catch(() => {}), 5000);
        }
    }

    // 2. SLASH COMMANDS
    if (i.isChatInputCommand()) {
        if (i.commandName === 'terminal') {
            const accessKey = serverPasswords.get(i.guild.id) || "UNCONFIGURED";
            const embed = new EmbedBuilder()
                .setTitle("📡 REMOTE TERMINAL ACCESS")
                .setDescription("Use the credentials below to access the high-performance security dashboard.")
                .addFields(
                    { name: "Terminal URL", value: `[Access Dashboard](${CONFIG.BASE_URL})` },
                    { name: "Node Identifier", value: `\`${i.guild.id}\``, inline: true },
                    { name: "Access Key", value: `\`${accessKey}\``, inline: true }
                )
                .setColor("#6366f1")
                .setFooter({ text: "Confidential: Authorized Personnel Only" });

            i.reply({ embeds: [embed], ephemeral: true });
        }

        if (i.commandName === 'deploy-panel') {
            if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return i.reply({ content: "❌ **Insufficient Clearance:** Admin permissions required.", ephemeral: true });
            }

            const targetChannel = i.options.getChannel('channel');
            const embed = new EmbedBuilder()
                .setTitle(s.panelTitle)
                .setDescription(s.panelDesc)
                .setColor(s.panelColor)
                .setThumbnail(i.guild.iconURL())
                .setImage('https://i.imgur.com/your-header-image.png'); // Aesthetic placeholder

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('tkt_open')
                    .setLabel('Initialize Uplink')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🎫')
            );

            await targetChannel.send({ embeds: [embed], components: [row] });
            i.reply({ content: `✅ **Deployment Successful:** Panel active in ${targetChannel}`, ephemeral: true });
            logAudit(i.guild.id, "PANEL_DEPLOY", i.user, `Channel: #${targetChannel.name}`);
        }
    }
});

// --- SYSTEM INITIALIZATION ---

client.once('ready', async () => {
    console.log(`[READY] Omega Sentinel V10 is online.`);
    client.user.setActivity("Omega-Grid Alpha", { type: ActivityType.Competing });

    const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
    client.guilds.cache.forEach(async (guild) => {
        try {
            await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), {
                body: [
                    new SlashCommandBuilder().setName('terminal').setDescription('Get your server-specific web dashboard access credentials.'),
                    new SlashCommandBuilder()
                        .setName('deploy-panel')
                        .setDescription('Deploy the high-end ticket interaction panel.')
                        .addChannelOption(o => o.setName('channel').setDescription('The channel to deploy to').setRequired(true))
                ]
            });
            // Auto-generate access key if missing
            if (!serverPasswords.has(guild.id)) {
                serverPasswords.set(guild.id, crypto.randomBytes(4).toString('hex').toUpperCase());
            }
        } catch (err) {
            console.error(`[REST_ERR] Failed for ${guild.id}`);
        }
    });
});

// --- OMEGA WEB INTERFACE (EXPRESS + TAILWIND) ---

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ keys: [CONFIG.SESSION_SECRET], name: 'omega_sess' }));

/**
 * MASTER UI WRAPPER
 * High-performance animated dashboard wrapper.
 */
const renderUI = (content, guildId) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Omega Sentinel | Command Center</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;500;700&display=swap" rel="stylesheet">
    <style>
        body { background-color: #020617; color: #f8fafc; font-family: 'Space Grotesk', sans-serif; overflow-x: hidden; }
        .glass { background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .animate-fade { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .sidebar-item { transition: all 0.3s ease; border-radius: 1rem; }
        .sidebar-item:hover { background: rgba(99, 102, 241, 0.15); color: #818cf8; transform: translateX(8px); }
        .cyber-grid { background-image: linear-gradient(rgba(99, 102, 241, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(99, 102, 241, 0.05) 1px, transparent 1px); background-size: 40px 40px; }
    </style>
</head>
<body class="flex h-screen cyber-grid">
    <!-- SIDE NAVIGATION -->
    <aside class="w-80 glass m-6 rounded-[2.5rem] flex flex-col p-8 shadow-2xl border-r-0">
        <div class="mb-12 flex items-center gap-4">
            <div class="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
                <span class="text-2xl font-black">Ω</span>
            </div>
            <div>
                <h1 class="text-xl font-bold tracking-tight">OMEGA</h1>
                <p class="text-xs text-slate-500 font-medium">SENTINEL V10</p>
            </div>
        </div>

        <nav class="flex-1 space-y-4">
            <a href="/dash" class="sidebar-item block p-5 font-medium">📊 Telemetry</a>
            <a href="/security" class="sidebar-item block p-5 font-medium">🛡️ Security Grids</a>
            <a href="/audits" class="sidebar-item block p-5 font-medium">📜 Audit Buffer</a>
        </nav>

        <div class="pt-8 border-t border-slate-800">
            <a href="/logout" class="p-5 text-rose-400 font-bold hover:bg-rose-500/10 rounded-2xl block transition text-center">DISCONNECT</a>
        </div>
    </aside>

    <!-- MAIN TERMINAL -->
    <main class="flex-1 overflow-y-auto p-12 animate-fade">
        ${content}
    </main>
</body>
</html>`;

// --- ROUTE DEFINITIONS ---

app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8"><title>Omega Login</title><script src="https://cdn.tailwindcss.com"></script>
        <style>body{background:#020617;font-family:sans-serif}.glass{background:rgba(15,23,42,0.8);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.05)}</style>
    </head>
    <body class="flex items-center justify-center h-screen">
        <form action="/login" method="POST" class="glass p-16 rounded-[3rem] w-[450px] text-center shadow-2xl">
            <h1 class="text-5xl font-black text-indigo-500 mb-2 tracking-tighter">OMEGA</h1>
            <p class="text-slate-500 mb-12 font-medium">Establish Secure Uplink</p>
            
            <input name="gid" placeholder="Node Identifier (Guild ID)" class="w-full bg-slate-900 border border-slate-800 p-6 rounded-2xl text-white mb-4 outline-none focus:border-indigo-500 transition">
            <input name="pass" type="password" placeholder="Access Key" class="w-full bg-slate-900 border border-slate-800 p-6 rounded-2xl text-white mb-10 outline-none focus:border-indigo-500 transition">
            
            <button class="w-full bg-indigo-600 text-white font-bold py-6 rounded-2xl shadow-xl shadow-indigo-600/20 hover:scale-[1.02] active:scale-[0.98] transition">INITIALIZE CONNECTION</button>
        </form>
    </body>
    </html>`);
});

app.post('/login', (req, res) => {
    const { gid, pass } = req.body;
    if (serverPasswords.get(gid) === pass?.toUpperCase()) {
        req.session.gid = gid;
        res.redirect('/dash');
    } else {
        res.send("<body style='background:#020617;color:#f43f5e;display:flex;justify-content:center;align-items:center;height:100vh'><h1>ACCESS DENIED: INVALID CREDENTIALS</h1></body>");
    }
});

app.get('/dash', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const stats = analytics.get(req.session.gid) || { messages: 0, threats: 0, tickets: 0 };
    const guild = client.guilds.cache.get(req.session.gid);
    
    res.send(renderUI(`
        <header class="mb-16">
            <h2 class="text-6xl font-black tracking-tighter mb-4">Command Center</h2>
            <p class="text-slate-400 text-xl font-light">Monitoring <span class="text-white font-bold">${guild ? guild.name : 'Unknown Node'}</span></p>
        </header>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-10 mb-16">
            <div class="glass p-12 rounded-[2.5rem] border-b-8 border-indigo-500 hover:scale-[1.03] transition duration-500">
                <span class="text-slate-500 font-bold uppercase tracking-widest text-xs">Security Scans</span>
                <div class="text-7xl font-black mt-4">${stats.messages}</div>
            </div>
            <div class="glass p-12 rounded-[2.5rem] border-b-8 border-rose-500 hover:scale-[1.03] transition duration-500">
                <span class="text-slate-500 font-bold uppercase tracking-widest text-xs">Intercepted</span>
                <div class="text-7xl font-black mt-4">${stats.threats}</div>
            </div>
            <div class="glass p-12 rounded-[2.5rem] border-b-8 border-emerald-500 hover:scale-[1.03] transition duration-500">
                <span class="text-slate-500 font-bold uppercase tracking-widest text-xs">Uptime (Mins)</span>
                <div class="text-7xl font-black mt-4">${Math.floor((Date.now() - CONFIG.BOOT_TIME) / 60000)}</div>
            </div>
        </div>

        <div class="glass p-16 rounded-[3rem] bg-gradient-to-tr from-indigo-500/5 to-transparent">
            <h3 class="text-3xl font-bold mb-8 flex items-center gap-4">
                <span class="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></span>
                Core Status: Operational
            </h3>
            <p class="text-slate-400 text-xl leading-relaxed max-w-4xl">
                The Omega-Grid is currently active and processing traffic. Ghost-Ping radar is sweeping all channels, and the Auto-Delete engine is engaged on specified target nodes. All telemetry is being mirrored to the Audit Buffer in real-time.
            </p>
        </div>
    `, req.session.gid));
});

app.get('/security', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    
    res.send(renderUI(`
        <h2 class="text-5xl font-black mb-12 tracking-tight">Security Grids</h2>
        <form action="/save" method="POST" class="space-y-12">
            <div class="glass p-12 rounded-[3rem] space-y-10">
                <div>
                    <label class="block text-slate-500 font-bold mb-4 uppercase text-xs tracking-widest">Auto-Delete Target Channels (IDs, Comma Separated)</label>
                    <textarea name="autoDeleteChannels" class="w-full bg-slate-900/50 border border-slate-800 p-8 rounded-3xl text-white h-40 outline-none focus:border-indigo-500 transition text-lg font-mono">${s.autoDeleteChannels.join(',')}</textarea>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div>
                        <label class="block text-slate-500 font-bold mb-4 uppercase text-xs tracking-widest">Anti-Link Protocol</label>
                        <select name="antiLink" class="w-full bg-slate-900/50 border border-slate-800 p-6 rounded-2xl text-white outline-none">
                            <option value="true" ${s.antiLink ? 'selected' : ''}>ENGAGED</option>
                            <option value="false" ${!s.antiLink ? 'selected' : ''}>DISENGAGED</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-slate-500 font-bold mb-4 uppercase text-xs tracking-widest">Ghost Ping Radar</label>
                        <select name="antiGhostPing" class="w-full bg-slate-900/50 border border-slate-800 p-6 rounded-2xl text-white outline-none">
                            <option value="true" ${s.antiGhostPing ? 'selected' : ''}>ENGAGED</option>
                            <option value="false" ${!s.antiGhostPing ? 'selected' : ''}>DISENGAGED</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label class="block text-slate-500 font-bold mb-4 uppercase text-xs tracking-widest">Phrase Blacklist (Comma Separated)</label>
                    <textarea name="blacklist" class="w-full bg-slate-900/50 border border-slate-800 p-8 rounded-3xl text-white h-40 outline-none focus:border-indigo-500 transition text-lg font-mono">${s.blacklist.join(',')}</textarea>
                </div>

                <button class="w-full bg-indigo-600 p-8 rounded-[2rem] font-black text-2xl hover:scale-[1.01] active:scale-[0.99] transition shadow-2xl shadow-indigo-600/30">SYNCHRONIZE SECURITY GRID</button>
            </div>
        </form>
    `, req.session.gid));
});

app.get('/audits', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const logs = auditLogs.get(req.session.gid) || [];
    
    res.send(renderUI(`
        <h2 class="text-5xl font-black mb-12 tracking-tight">Audit Buffer</h2>
        <div class="glass rounded-[3rem] overflow-hidden">
            <table class="w-full text-left">
                <thead class="bg-slate-950/50 text-slate-500 uppercase text-xs font-bold tracking-widest">
                    <tr><th class="p-10">Timestamp</th><th class="p-10">Operation</th><th class="p-10">Target</th><th class="p-10">Event Detail</th></tr>
                </thead>
                <tbody class="divide-y divide-slate-800">
                    ${logs.map(l => `
                        <tr class="hover:bg-white/5 transition duration-300">
                            <td class="p-10 text-slate-500 font-mono text-sm">${l.time}</td>
                            <td class="p-10 font-black text-indigo-400 text-lg">${l.action}</td>
                            <td class="p-10 font-medium">${l.user}</td>
                            <td class="p-10 text-slate-400">${l.reason}</td>
                        </tr>
                    `).join('') || `<tr><td colspan="4" class="p-40 text-center text-slate-600 italic">No events recorded in the current session.</td></tr>`}
                </tbody>
            </table>
        </div>
    `, req.session.gid));
});

app.post('/save', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    
    s.autoDeleteChannels = req.body.autoDeleteChannels.split(',').map(id => id.trim()).filter(id => id);
    s.blacklist = req.body.blacklist.split(',').map(w => w.trim()).filter(w => w);
    s.antiLink = req.body.antiLink === 'true';
    s.antiGhostPing = req.body.antiGhostPing === 'true';
    
    logAudit(req.session.gid, "GRID_SYNC", "Dashboard Admin", "Manual configuration update.");
    res.redirect('/security');
});

app.get('/logout', (req, res) => { req.session = null; res.redirect('/'); });

// --- SYSTEM BOOT ---
app.listen(CONFIG.PORT, () => console.log(`[HTTP] Omega Terminal hosted on port ${CONFIG.PORT}`));
client.login(CONFIG.TOKEN);
