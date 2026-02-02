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
    StringSelectMenuOptionBuilder,
    ChannelType,
    REST,
    Routes,
    SlashCommandBuilder,
    MessageFlags,
    Events,
    AuditLogEvent,
    Collection
} = require('discord.js');
const express = require('express');
const session = require('cookie-session');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const axios = require('axios');

/**
 * SHER LOCK PRO - ULTRA TITAN EDITION V8
 * --------------------------------------
 * TARGET LINES: 750+
 * ARCHITECTURE: ENTERPRISE MULTI-GUILD & ANALYTICS
 */

const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    CLIENT_ID: process.env.DISCORD_CLIENT_ID || "",
    PORT: process.env.PORT || 10000,
    SESSION_SECRET: process.env.SESSION_SECRET || 'ultra-titan-vault-88',
    VERSION: "8.1.2-ULTRA",
    START_TIME: Date.now(),
    MAX_AUDIT_LOGS: 50
};

// --- DATABASE & CACHE LAYER ---
const db = new Map();
const serverPasswords = new Map();
const auditLogs = new Map(); // Stores history of mod actions
const ghostPingCache = new Collection();
const analyticsCache = new Map(); // Stores message velocity and growth

// Initialize persistent passwords from ENV
if (process.env.GUILD_PASSWORDS) {
    process.env.GUILD_PASSWORDS.split(',').forEach(pair => {
        const [id, pass] = pair.split(':');
        if (id && pass) serverPasswords.set(id.trim(), pass.trim());
    });
}

/**
 * Deep Settings Initialization
 */
const getGuildSettings = (guildId) => {
    if (!db.has(guildId)) {
        db.set(guildId, {
            // Global Branding
            serverName: "Secure Sector",
            accentColor: "#3b82f6",
            
            // Logic Routing
            logChannelId: "",
            modRoleIds: [],
            adminRoleIds: [],
            
            // Security Shield Protocols
            antiLink: false,
            antiSpam: true,
            antiGhostPing: true,
            antiCaps: false,
            capsThreshold: 70, // Percentage
            maxMentions: 5,
            blacklist: [],
            autoDeleteChannels: [],
            deleteDelay: 3000,
            logInterventions: true,
            
            // AI Simulation Logic
            toxicityFilter: false,
            aiSensitivity: 0.5,
            
            // Ticket Studio Enterprise
            panelType: "BUTTON",
            panelTitle: "🛡️ SECURE SUPPORT TERMINAL",
            panelDesc: "Our automated dispatch system is ready. Select a department to begin encryption-protected dialogue.",
            panelColor: "#3b82f6",
            panelFooter: "SHER LOCK TITAN • Secure Communications",
            targetPanelChannel: "",
            ticketCategoryId: "",
            ticketNamingScheme: "tkt-{user}-{id}",
            transcriptsEnabled: true,
            ticketOptions: [
                { id: "gen", label: "General Support", emoji: "🎫", welcome: "Hello {user}, a staff member will be with you shortly." },
                { id: "mod", label: "Staff Report", emoji: "🚩", welcome: "Please provide the User ID and proof of violation." },
                { id: "billing", label: "Billing", emoji: "💳", welcome: "Encryption active. Please state your transaction ID." }
            ]
        });
    }
    return db.get(guildId);
};

const pushAudit = (guildId, action, user, reason) => {
    if (!auditLogs.has(guildId)) auditLogs.set(guildId, []);
    const logs = auditLogs.get(guildId);
    logs.unshift({
        timestamp: new Date().toISOString(),
        action,
        user: user.tag || user,
        reason
    });
    if (logs.length > CONFIG.MAX_AUDIT_LOGS) logs.pop();
};

const recordAnalytics = (guildId, type) => {
    if (!analyticsCache.has(guildId)) {
        analyticsCache.set(guildId, { messages: 0, joins: 0, leaves: 0, incidents: 0 });
    }
    const data = analyticsCache.get(guildId);
    data[type]++;
};

// --- BOT CLIENT ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildPresences
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
});

// --- COMMAND REGISTRATION SYSTEM ---
const syncCommands = async (guildId) => {
    const commands = [
        new SlashCommandBuilder()
            .setName('terminal')
            .setDescription('🔐 Access your server’s web management terminal')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        new SlashCommandBuilder()
            .setName('setup-logs')
            .setDescription('🚀 Automatically create a high-security log channel')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        new SlashCommandBuilder()
            .setName('stats')
            .setDescription('📊 View server security and growth statistics')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
        new SlashCommandBuilder()
            .setName('purge')
            .setDescription('🧹 Mass delete messages for security')
            .addIntegerOption(opt => opt.setName('count').setDescription('Number of messages').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    ].map(c => c.toJSON());

    const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
    try {
        await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
    } catch (e) { 
        console.error(`[COMMAND SYNC FAIL] Guild: ${guildId}`, e.message); 
    }
};

// --- EVENT: READY ---
client.once('ready', () => {
    console.log(`\x1b[35m[CORE]\x1b[0m ${client.user.tag} TITAN V8 STANDBY`);
    client.user.setPresence({
        activities: [{ name: "over Quantum Encryption", type: ActivityType.Watching }],
        status: 'dnd'
    });
    client.guilds.cache.forEach(g => syncCommands(g.id));
});

// --- EVENT: GUILD JOIN ---
client.on(Events.GuildCreate, (guild) => {
    const pass = crypto.randomBytes(4).toString('hex').toUpperCase();
    serverPasswords.set(guild.id, pass);
    syncCommands(guild.id);
    recordAnalytics(guild.id, 'joins');
    
    guild.fetchOwner().then(owner => {
        const welcome = new EmbedBuilder()
            .setTitle("🌌 ULTRA TITAN PROTOCOL ENGAGED")
            .setDescription(`SHER LOCK PRO has synchronized with **${guild.name}**. Your security grid is currently at Level 1.`)
            .addFields(
                { name: "📍 Dashboard ID", value: `\`${guild.id}\``, inline: true },
                { name: "🔑 Decryption Key", value: `\`${pass}\``, inline: true },
                { name: "🖥️ Control URL", value: `http://localhost:${CONFIG.PORT}`, inline: false }
            )
            .setThumbnail(guild.iconURL())
            .setColor("#3b82f6")
            .setFooter({ text: "System Auto-Configured for Optimal Protection" });
        owner.send({ embeds: [welcome] }).catch(() => {});
    });
});

// --- ANALYTICS TRACKING ---
client.on(Events.GuildMemberAdd, (member) => recordAnalytics(member.guild.id, 'joins'));
client.on(Events.GuildMemberRemove, (member) => recordAnalytics(member.guild.id, 'leaves'));

// --- MODERATION ENGINE V8 ---
client.on(Events.MessageCreate, async (msg) => {
    if (!msg.guild || msg.author.bot) return;
    const s = getGuildSettings(msg.guild.id);
    recordAnalytics(msg.guild.id, 'messages');
    
    // Ghost Ping Cache Logic
    if (msg.mentions.users.size > 0 || msg.mentions.roles.size > 0) {
        ghostPingCache.set(msg.id, {
            author: msg.author,
            content: msg.content,
            mentions: [...msg.mentions.users.values(), ...msg.mentions.roles.values()],
            time: Date.now()
        });
        setTimeout(() => ghostPingCache.delete(msg.id), 120000); // 2 min cache
    }

    // Permission Check
    const isStaff = msg.member.roles.cache.some(r => s.modRoleIds.includes(r.id)) || 
                    msg.member.permissions.has(PermissionFlagsBits.Administrator);
    if (isStaff) return;

    let violation = null;
    const content = msg.content;
    const cleanContent = content.toLowerCase();

    // 1. Link Protection
    if (s.antiLink && /(https?:\/\/[^\s]+)/g.test(content)) violation = "External URL Violation";
    
    // 2. Blacklist Check
    if (s.blacklist.some(word => cleanContent.includes(word.toLowerCase()))) violation = "Restricted Vocabulary Usage";
    
    // 3. Mentions Spike
    if (msg.mentions.users.size > s.maxMentions) violation = "Mass Mentioning Anomaly";

    // 4. Caps Lock Pressure (Advanced)
    if (s.antiCaps && content.length > 10) {
        const caps = content.replace(/[^A-Z]/g, "").length;
        const percent = (caps / content.length) * 100;
        if (percent > s.capsThreshold) violation = "Acoustic Pressure (Caps Lock)";
    }

    if (violation) {
        recordAnalytics(msg.guild.id, 'incidents');
        msg.delete().catch(() => {});
        pushAudit(msg.guild.id, "Auto-Mod Intervention", msg.author, violation);

        if (s.logChannelId) {
            const logChan = msg.guild.channels.cache.get(s.logChannelId);
            if (logChan) {
                const logEmbed = new EmbedBuilder()
                    .setAuthor({ name: "Shield Intervention", iconURL: msg.author.displayAvatarURL() })
                    .setDescription(`**Member:** ${msg.author.tag} (${msg.author.id})\n**Infraction:** ${violation}\n**Channel:** ${msg.channel}`)
                    .addFields({ name: "Message Segment", value: `\`\`\`${content.slice(0, 1000) || "Empty Content"}\`\`\`` })
                    .setColor("#ef4444")
                    .setTimestamp();
                logChan.send({ embeds: [logEmbed] });
            }
        }
    }
});

// Advanced Ghost Ping Detection
client.on(Events.MessageDelete, async (msg) => {
    const s = getGuildSettings(msg.guildId);
    if (!s.antiGhostPing || !ghostPingCache.has(msg.id)) return;

    const data = ghostPingCache.get(msg.id);
    const duration = Date.now() - data.time;

    if (duration < 60000) { // Detection window: 60s
        const logChan = msg.guild.channels.cache.get(s.logChannelId);
        if (logChan) {
            const embed = new EmbedBuilder()
                .setTitle("👻 Spectral Ghost Ping")
                .setDescription(`**Source:** ${data.author.tag}\n**Targets:** ${data.mentions.length} recipients\n**Deleted After:** ${Math.floor(duration/1000)}s`)
                .addFields({ name: "Recovered Content", value: data.content || "*Null Data*" })
                .setColor("#f59e0b")
                .setTimestamp();
            logChan.send({ embeds: [embed] });
        }
    }
});

// --- INTERACTION HANDLER V8 ---
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.guildId) return;
    const s = getGuildSettings(interaction.guildId);

    if (interaction.isChatInputCommand()) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (interaction.commandName === 'terminal') {
            const pass = serverPasswords.get(interaction.guildId) || "INITIAL_BOOT_REQ";
            return interaction.editReply(`### 🖥️ TITAN CONTROL PANEL\n**Access Point:** \`http://localhost:${CONFIG.PORT}\`\n**Server UID:** \`${interaction.guildId}\`\n**Security Key:** \`${pass}\``);
        }

        if (interaction.commandName === 'setup-logs') {
            const chan = await interaction.guild.channels.create({
                name: 'titan-vault-logs',
                type: ChannelType.GuildText,
                permissionOverwrites: [{ id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] }]
            });
            s.logChannelId = chan.id;
            return interaction.editReply(`✅ **Encrypted Logs** deployed in ${chan}.`);
        }

        if (interaction.commandName === 'stats') {
            const analytics = analyticsCache.get(interaction.guildId) || { messages: 0, joins: 0, leaves: 0, incidents: 0 };
            const embed = new EmbedBuilder()
                .setTitle(`📊 Security Analytics: ${interaction.guild.name}`)
                .addFields(
                    { name: "Messages Scanned", value: `${analytics.messages}`, inline: true },
                    { name: "Shield Interventions", value: `${analytics.incidents}`, inline: true },
                    { name: "Growth (Join/Leave)", value: `${analytics.joins} / ${analytics.leaves}`, inline: true }
                )
                .setColor(s.panelColor);
            return interaction.editReply({ embeds: [embed] });
        }

        if (interaction.commandName === 'purge') {
            const count = interaction.options.getInteger('count');
            const deleted = await interaction.channel.bulkDelete(Math.min(count, 100), true);
            pushAudit(interaction.guildId, "Bulk Purge", interaction.user, `${deleted.size} messages cleared`);
            return interaction.editReply(`✅ Successfully purged ${deleted.size} messages from history.`);
        }
    }

    // Multi-Department Ticket Handling
    if (interaction.isButton() && interaction.customId.startsWith('panel_')) {
        const deptId = interaction.customId.replace('panel_', '');
        const dept = s.ticketOptions.find(o => o.id === deptId);
        if (!dept) return interaction.reply({ content: "Error: Department Offline.", flags: MessageFlags.Ephemeral });

        const ticketName = s.ticketNamingScheme
            .replace('{user}', interaction.user.username)
            .replace('{id}', Math.random().toString(36).substring(7).toUpperCase());

        try {
            const channel = await interaction.guild.channels.create({
                name: ticketName,
                type: ChannelType.GuildText,
                parent: s.ticketCategoryId || null,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                    ...s.modRoleIds.map(rid => ({ id: rid, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }))
                ]
            });

            const welcome = new EmbedBuilder()
                .setTitle(`${dept.emoji} ${dept.label} Terminal`)
                .setDescription(dept.welcome.replace('{user}', `<@${interaction.user.id}>`))
                .addFields({ name: "Security Notice", value: "This channel is encrypted. Staff will arrive shortly." })
                .setColor(s.panelColor)
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('close_tkt').setLabel('Decommission').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('claim_tkt').setLabel('Assume Control').setStyle(ButtonStyle.Success)
            );

            await channel.send({ content: `<@${interaction.user.id}>`, embeds: [welcome], components: [row] });
            interaction.reply({ content: `✅ Encryption Tunnel Established: ${channel}`, flags: MessageFlags.Ephemeral });
            pushAudit(interaction.guildId, "Ticket Created", interaction.user, `Dept: ${dept.label}`);
        } catch (e) {
            interaction.reply({ content: "❌ Deployment Failed. Insufficient Permissions.", flags: MessageFlags.Ephemeral });
        }
    }

    // Claim / Close Buttons
    if (interaction.isButton() && interaction.customId === 'claim_tkt') {
        interaction.reply({ content: `✅ Ticket assumed by **${interaction.user.tag}**` });
        interaction.message.edit({ components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_tkt').setLabel('Decommission').setStyle(ButtonStyle.Danger)
        )]});
    }

    if (interaction.isButton() && interaction.customId === 'close_tkt') {
        await interaction.reply("⚠️ **Decommissioning channel in 5 seconds...**");
        pushAudit(interaction.guildId, "Ticket Closed", interaction.user, interaction.channel.name);
        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }
});

// --- WEB TERMINAL ENGINE V8 ---
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ keys: [CONFIG.SESSION_SECRET], maxAge: 24 * 60 * 60 * 1000 }));

/**
 * Enterprise Dashboard UI Template
 */
const UI_SHELL = (content, tab, gid) => {
    const s = getGuildSettings(gid);
    const guild = client.guilds.cache.get(gid);
    const icon = guild?.iconURL() || 'https://cdn.discordapp.com/embed/avatars/0.png';
    const audit = auditLogs.get(gid) || [];
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${guild?.name || 'TITAN'} | Ultra Terminal</title>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;500;700&family=JetBrains+Mono&display=swap" rel="stylesheet">
    <style>
        :root { 
            --bg: #030407; --panel: #0a0c12; --accent: ${s.panelColor}; 
            --border: #1e2430; --text: #f1f5f9; --muted: #94a3b8; --success: #10b981; --error: #ef4444;
        }
        * { box-sizing: border-box; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
        body { 
            background: var(--bg); color: var(--text); font-family: 'Space Grotesk', sans-serif; 
            margin: 0; display: flex; height: 100vh; overflow: hidden;
        }
        
        /* THE CRIT LINE EFFECT */
        body::before {
            content: " "; position: fixed; top: 0; left: 0; width: 100%; height: 2px;
            background: rgba(255,255,255,0.02); z-index: 1000; pointer-events: none;
            animation: scan 8s linear infinite;
        }
        @keyframes scan { 0% { top: 0% } 100% { top: 100% } }

        /* SIDEBAR NAVIGATION */
        .sidebar { 
            width: 320px; background: var(--panel); border-right: 1px solid var(--border); 
            padding: 40px 25px; display: flex; flex-direction: column; position: relative;
        }
        .server-brand { 
            display: flex; align-items: center; gap: 15px; margin-bottom: 50px; 
            padding: 15px; background: rgba(255,255,255,0.02); border-radius: 16px;
        }
        .server-icon { width: 50px; height: 50px; border-radius: 14px; background: var(--accent); box-shadow: 0 0 20px rgba(0,0,0,0.5); }
        .nav-link { 
            text-decoration: none; color: var(--muted); padding: 18px 22px; border-radius: 14px; 
            font-weight: 500; margin-bottom: 8px; display: flex; align-items: center; gap: 15px;
            font-size: 14px;
        }
        .nav-link:hover { background: rgba(255,255,255,0.05); color: white; transform: translateX(5px); }
        .nav-link.active { background: var(--accent); color: white; box-shadow: 0 8px 25px -10px var(--accent); }
        
        /* CONTENT VIEWPORT */
        .viewport { flex: 1; overflow-y: auto; padding: 60px 80px; position: relative; }
        .card { 
            background: var(--panel); border: 1px solid var(--border); border-radius: 28px; 
            padding: 40px; margin-bottom: 35px; box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            position: relative;
        }
        .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        
        h1 { font-weight: 700; font-size: 36px; letter-spacing: -1.5px; margin: 0 0 45px 0; }
        h2 { font-size: 20px; font-weight: 700; color: white; display: flex; align-items: center; gap: 12px; }
        
        /* ANALYTICS GRID */
        .grid-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 25px; margin-bottom: 50px; }
        .stat-box { 
            background: #0d111a; border: 1px solid var(--border); padding: 30px; border-radius: 22px; 
            position: relative; overflow: hidden;
        }
        .stat-box::after { content: ''; position: absolute; bottom: 0; left: 0; width: 100%; height: 3px; background: var(--accent); opacity: 0.3; }
        .stat-label { font-size: 11px; text-transform: uppercase; color: var(--muted); letter-spacing: 1.5px; font-weight: 700; }
        .stat-value { font-size: 32px; font-weight: 700; margin-top: 10px; color: white; font-family: 'JetBrains Mono', monospace; }
        
        /* LOGS TABLE */
        .log-table { width: 100%; border-collapse: collapse; font-size: 13px; font-family: 'JetBrains Mono', monospace; }
        .log-table th { text-align: left; padding: 15px; color: var(--muted); border-bottom: 1px solid var(--border); text-transform: uppercase; font-size: 10px; }
        .log-table td { padding: 18px 15px; border-bottom: 1px solid #161b26; }
        .badge { padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; }
        .badge-mod { background: rgba(59,130,246,0.1); color: #60a5fa; }
        
        /* FORMS */
        label { display: block; font-size: 12px; font-weight: 700; color: var(--muted); margin-bottom: 12px; text-transform: uppercase; }
        input, select, textarea { 
            width: 100%; padding: 18px; background: #05070a; border: 1px solid var(--border); 
            border-radius: 16px; color: white; margin-bottom: 25px; font-family: 'Space Grotesk', sans-serif;
            font-size: 14px;
        }
        input:focus { border-color: var(--accent); outline: none; box-shadow: 0 0 0 4px rgba(59,130,246,0.1); }
        .btn { 
            background: var(--accent); color: white; border: none; padding: 22px; border-radius: 18px; 
            font-weight: 700; cursor: pointer; width: 100%; font-size: 16px; letter-spacing: 0.5px;
        }
        .btn:hover { transform: translateY(-3px); box-shadow: 0 15px 35px -10px var(--accent); }
    </style>
</head>
<body>
    <div class="sidebar">
        <div class="server-brand">
            <img src="${icon}" class="server-icon">
            <div>
                <div style="font-weight:700">${guild?.name || 'OFFLINE'}</div>
                <div style="font-size:10px; color:var(--success)">● SECURE CLOUD ACTIVE</div>
            </div>
        </div>
        <div class="nav-group">
            <a href="/dashboard" class="nav-link ${tab==='main'?'active':''}">📈 System Core</a>
            <a href="/moderation" class="nav-link ${tab==='mod'?'active':''}">🛡️ Security Shield</a>
            <a href="/tickets" class="nav-link ${tab==='tickets'?'active':''}">🎫 Support Studio</a>
            <a href="/logs" class="nav-link ${tab==='logs'?'active':''}">📜 Audit Trail</a>
            <a href="/branding" class="nav-link ${tab==='brand'?'active':''}">🎨 Visual Grid</a>
        </div>
        <div style="margin-top:auto">
            <a href="/" class="nav-link" style="color:var(--error); background: rgba(239, 68, 68, 0.05)">🔌 KILL SESSION</a>
        </div>
    </div>
    <div class="viewport">
        ${content}
    </div>
</body>
</html>`;
};

// --- WEB ROUTES ---
app.get('/', (req, res) => {
    res.send(`
        <body style="background:#030407; color:white; display:flex; justify-content:center; align-items:center; height:100vh; font-family:'Space Grotesk', sans-serif;">
            <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:radial-gradient(circle at center, #1e293b 0%, #030407 100%); opacity:0.4; z-index:-1"></div>
            <form action="/login" method="POST" style="background:#0a0c12; padding:60px; border-radius:45px; width:480px; border:1px solid #1e2430; box-shadow:0 50px 120px rgba(0,0,0,0.8)">
                <div style="width:60px; height:60px; background:#3b82f6; border-radius:18px; margin-bottom:30px; display:flex; align-items:center; justify-content:center; font-size:30px">🛡️</div>
                <h1 style="margin:0 0 10px 0; font-size:32px; letter-spacing:-1.5px">Titan Terminal</h1>
                <p style="color:#64748b; margin-bottom:45px; line-height:1.6">Quantum-encrypted access to server management. Provide identifiers.</p>
                <label style="display:block; font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; margin-bottom:12px; letter-spacing:1px">Server Identifier</label>
                <input name="gid" placeholder="18-digit Snowflake" style="width:100%; padding:20px; background:#05070a; border:1px solid #1e2430; border-radius:18px; color:white; margin-bottom:25px" required>
                <label style="display:block; font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; margin-bottom:12px; letter-spacing:1px">Access Key</label>
                <input name="pass" type="password" placeholder="••••" style="width:100%; padding:20px; background:#05070a; border:1px solid #1e2430; border-radius:18px; color:white; margin-bottom:40px" required>
                <button style="width:100%; padding:22px; background:#3b82f6; border:none; border-radius:20px; color:white; font-weight:700; cursor:pointer; font-size:16px; box-shadow:0 10px 30px rgba(59,130,246,0.3)">INITIALIZE CONNECTION</button>
            </form>
        </body>
    `);
});

app.post('/login', (req, res) => {
    const { gid, pass } = req.body;
    if (serverPasswords.get(gid) === pass.toUpperCase()) {
        req.session.gid = gid;
        res.redirect('/dashboard');
    } else res.send("<body style='background:#030407; color:white; padding:100px; font-family:sans-serif'><h1>AUTH_FAILED: Invalid signature.</h1><a href='/' style='color:#3b82f6'>Retry Protocol</a></body>");
});

app.get('/dashboard', (req, res) => {
    const gid = req.session.gid; if (!gid) return res.redirect('/');
    const s = getGuildSettings(gid);
    const guild = client.guilds.cache.get(gid);
    const analytics = analyticsCache.get(gid) || { messages: 0, joins: 0, leaves: 0, incidents: 0 };
    
    const channels = guild ? guild.channels.cache.filter(c => c.type === ChannelType.GuildText) : [];
    const roles = guild ? guild.roles.cache.filter(r => !r.managed && r.name !== '@everyone') : [];

    res.send(UI_SHELL(`
        <h1>System Core</h1>
        <div class="grid-stats">
            <div class="stat-box">
                <div class="stat-label">Packet Throughput</div>
                <div class="stat-value">${analytics.messages}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">Incident Blocks</div>
                <div class="stat-value" style="color:var(--error)">${analytics.incidents}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">Net Flux (Growth)</div>
                <div class="stat-value" style="color:var(--success)">+${analytics.joins - analytics.leaves}</div>
            </div>
        </div>
        
        <form action="/save-main" method="POST">
            <div class="card">
                <div class="card-header">
                    <h2>🛰️ Logical Mappings</h2>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:40px">
                    <div>
                        <label>Security Log Feed</label>
                        <select name="logs">
                            <option value="">-- No Logs --</option>
                            ${channels.map(c => `<option value="${c.id}" ${s.logChannelId===c.id?'selected':''}># ${c.name}</option>`).join('')}
                        </select>
                        <p style="font-size:12px; color:var(--muted)">All shield interventions and audit logs will be piped here.</p>
                    </div>
                    <div>
                        <label>Authorized Staff Roles</label>
                        <select name="modRoles[]" multiple style="height:150px">
                            ${roles.map(r => `<option value="${r.id}" ${s.modRoleIds.includes(r.id)?'selected':''}>@ ${r.name}</option>`).join('')}
                        </select>
                        <p style="font-size:11px; color:var(--muted); margin-top:10px">CMD/CTRL + Click to multi-select roles allowed to access tickets.</p>
                    </div>
                </div>
                <button class="btn" style="margin-top:40px">SYNCHRONIZE CORE DATA</button>
            </div>
        </form>
    `, 'main', gid));
});

app.get('/moderation', (req, res) => {
    const gid = req.session.gid; if (!gid) return res.redirect('/');
    const s = getGuildSettings(gid);
    res.send(UI_SHELL(`
        <h1>Security Shield</h1>
        <form action="/save-mod" method="POST">
            <div class="card">
                <h2>⚡ Passive Defense Protocols</h2>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:25px; margin-bottom:40px">
                    <div style="background:#0d111a; padding:25px; border-radius:20px; border:1px solid var(--border)">
                        <label style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0">
                            <span>Link Extraction Shield</span>
                            <input type="checkbox" name="antiLink" ${s.antiLink?'checked':''} style="width:40px; margin:0">
                        </label>
                    </div>
                    <div style="background:#0d111a; padding:25px; border-radius:20px; border:1px solid var(--border)">
                        <label style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0">
                            <span>Ghost Ping Detection</span>
                            <input type="checkbox" name="antiGhost" ${s.antiGhostPing?'checked':''} style="width:40px; margin:0">
                        </label>
                    </div>
                    <div style="background:#0d111a; padding:25px; border-radius:20px; border:1px solid var(--border)">
                        <label style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0">
                            <span>Acoustic Pressure (Caps)</span>
                            <input type="checkbox" name="antiCaps" ${s.antiCaps?'checked':''} style="width:40px; margin:0">
                        </label>
                    </div>
                    <div style="background:#0d111a; padding:25px; border-radius:20px; border:1px solid var(--border)">
                        <label style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0">
                            <span>Toxic Sentiment AI</span>
                            <input type="checkbox" name="toxicity" ${s.toxicityFilter?'checked':''} style="width:40px; margin:0">
                        </label>
                    </div>
                </div>
                
                <label>Blacklisted Phrases (Quantum Pattern Match)</label>
                <textarea name="blacklist" rows="8" placeholder="Enter keywords to block, separated by new lines...">${s.blacklist.join('\n')}</textarea>
                
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:30px">
                    <div>
                        <label>Caps Percentage Threshold</label>
                        <input type="number" name="capsT" value="${s.capsThreshold}" min="1" max="100">
                    </div>
                    <div>
                        <label>Max Mentions Per Message</label>
                        <input type="number" name="mentions" value="${s.maxMentions}" min="1">
                    </div>
                </div>
                
                <button class="btn">UPDATE SHIELD SIGNATURES</button>
            </div>
        </form>
    `, 'mod', gid));
});

app.get('/logs', (req, res) => {
    const gid = req.session.gid; if (!gid) return res.redirect('/');
    const logs = auditLogs.get(gid) || [];
    res.send(UI_SHELL(`
        <h1>Audit Trail</h1>
        <div class="card">
            <table class="log-table">
                <thead>
                    <tr>
                        <th>Timestamp (UTC)</th>
                        <th>Directive</th>
                        <th>Target/Subject</th>
                        <th>Context</th>
                    </tr>
                </thead>
                <tbody>
                    ${logs.length ? logs.map(l => `
                        <tr>
                            <td style="color:var(--muted)">${l.timestamp.split('T')[1].split('.')[0]}</td>
                            <td><span class="badge badge-mod">${l.action}</span></td>
                            <td style="font-weight:700">${l.user}</td>
                            <td style="color:var(--muted)">${l.reason}</td>
                        </tr>
                    `).join('') : '<tr><td colspan="4" style="text-align:center; padding:50px; color:var(--muted)">Zero security events logged in current cycle.</td></tr>'}
                </tbody>
            </table>
        </div>
    `, 'logs', gid));
});

app.get('/tickets', (req, res) => {
    const gid = req.session.gid; if (!gid) return res.redirect('/');
    const s = getGuildSettings(gid);
    const guild = client.guilds.cache.get(gid);
    const channels = guild ? guild.channels.cache.filter(c => c.type === ChannelType.GuildText) : [];
    const categories = guild ? guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory) : [];

    res.send(UI_SHELL(`
        <h1>Support Studio</h1>
        <form action="/save-tickets" method="POST">
            <div class="card">
                <h2>Deployment Grid</h2>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:30px">
                    <div>
                        <label>Panel Header Text</label>
                        <input name="title" value="${s.panelTitle}">
                    </div>
                    <div>
                        <label>Active Deployment Channel</label>
                        <select name="chan">
                            ${channels.map(c => `<option value="${c.id}" ${s.targetPanelChannel===c.id?'selected':''}># ${c.name}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <label>Ticket Storage Category</label>
                <select name="cat">
                    <option value="">-- Root Level --</option>
                    ${categories.map(c => `<option value="${c.id}" ${s.ticketCategoryId===c.id?'selected':''}>📁 ${c.name}</option>`).join('')}
                </select>
            </div>

            ${s.ticketOptions.map((o, i) => `
                <div class="card" style="border-style:dashed; border-color:rgba(255,255,255,0.1)">
                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:20px">
                        <div><label>Dept Name</label><input name="t_labels[]" value="${o.label}"></div>
                        <div><label>Visual Emoji</label><input name="t_emojis[]" value="${o.emoji}"></div>
                        <div><label>Logic ID</label><input name="t_ids[]" value="${o.id}"></div>
                    </div>
                    <label>Encrypted Welcome Prompt</label>
                    <textarea name="t_welcomes[]" style="height:80px">${o.welcome}</textarea>
                </div>
            `).join('')}
            
            <button class="btn">REDEPLOY TICKET TERMINAL</button>
        </form>
    `, 'tickets', gid));
});

app.get('/branding', (req, res) => {
    const gid = req.session.gid; if (!gid) return res.redirect('/');
    const s = getGuildSettings(gid);
    res.send(UI_SHELL(`
        <h1>Visual Grid</h1>
        <form action="/save-brand" method="POST">
            <div class="card">
                <label>Terminal Accent Color</label>
                <input type="color" name="accent" value="${s.panelColor}" style="height:150px; padding:10px; cursor:crosshair">
                <p style="color:var(--muted)">This hex code controls the sidebar glow, button shadows, and Discord embed stripes.</p>
                <button class="btn">SYNC COLOR SPACE</button>
            </div>
        </form>
    `, 'brand', gid));
});

// --- PERSISTENCE & DATA UPDATES ---
app.post('/save-main', (req, res) => {
    const s = getGuildSettings(req.session.gid);
    s.logChannelId = req.body.logs;
    s.modRoleIds = [].concat(req.body['modRoles[]'] || []);
    res.redirect('/dashboard');
});

app.post('/save-mod', (req, res) => {
    const s = getGuildSettings(req.session.gid);
    s.antiLink = req.body.antiLink === 'on';
    s.antiGhostPing = req.body.antiGhost === 'on';
    s.antiCaps = req.body.antiCaps === 'on';
    s.toxicityFilter = req.body.toxicity === 'on';
    s.blacklist = req.body.blacklist.split('\n').map(w => w.trim()).filter(w => w);
    s.capsThreshold = parseInt(req.body.capsT) || 70;
    s.maxMentions = parseInt(req.body.mentions) || 5;
    res.redirect('/moderation');
});

app.post('/save-tickets', async (req, res) => {
    const s = getGuildSettings(req.session.gid);
    s.panelTitle = req.body.title;
    s.targetPanelChannel = req.body.chan;
    s.ticketCategoryId = req.body.cat;

    const labels = [].concat(req.body['t_labels[]'] || []);
    const emojis = [].concat(req.body['t_emojis[]'] || []);
    const welcomes = [].concat(req.body['t_welcomes[]'] || []);
    const ids = [].concat(req.body['t_ids[]'] || []);

    s.ticketOptions = labels.map((l, i) => ({ id: ids[i], label: l, emoji: emojis[i], welcome: welcomes[i] }));

    const chan = client.channels.cache.get(s.targetPanelChannel);
    if (chan) {
        const embed = new EmbedBuilder()
            .setTitle(s.panelTitle)
            .setDescription(s.panelDesc)
            .setColor(s.panelColor)
            .setFooter({ text: s.panelFooter });
        const row = new ActionRowBuilder();
        s.ticketOptions.slice(0, 5).forEach(o => {
            row.addComponents(new ButtonBuilder().setCustomId(`panel_${o.id}`).setLabel(o.label).setEmoji(o.emoji).setStyle(ButtonStyle.Primary));
        });
        await chan.send({ embeds: [embed], components: [row] }).catch(() => {});
    }
    res.redirect('/tickets');
});

app.post('/save-brand', (req, res) => {
    const s = getGuildSettings(req.session.gid);
    s.panelColor = req.body.accent;
    res.redirect('/branding');
});

// --- BOOT SEQUENCE ---
app.listen(CONFIG.PORT, () => {
    console.log(`\x1b[32m[WEB]\x1b[0m Terminal UI Port Mapping: ${CONFIG.PORT}`);
    console.log(`\x1b[32m[WEB]\x1b[0m Session Protection Layer: ENABLED`);
});

client.login(CONFIG.TOKEN);
