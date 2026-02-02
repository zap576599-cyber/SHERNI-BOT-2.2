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
    AuditLogEvent
} = require('discord.js');
const express = require('express');
const session = require('cookie-session');
const bodyParser = require('body-parser');
const crypto = require('crypto');

/**
 * SHER LOCK PRO - ULTIMATE EDITION V5
 * NO COMPROMISE ARCHITECTURE
 * ------------------------------------
 * Max Storage Utilization: ~500MB (In-Memory Maps & Buffers)
 * Dashboard Features: Advanced Mod, Ticket Studio, Live Preview, Auto-Auth
 */

// --- CORE SYSTEM CONFIGURATION ---
const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    RAW_PASSWORDS: process.env.GUILD_PASSWORDS || "", 
    PORT: process.env.PORT || 10000,
    SESSION_SECRET: process.env.SESSION_SECRET || 'sher-lock-ultra-massive-v5-vault',
    VERSION: "5.0.4-ULTRA"
};

// --- DATA PERSISTENCE LAYER (IN-MEMORY) ---
const serverPasswords = new Map();
const db = new Map();
const auditLogs = new Map(); // Stores the last 100 actions per guild
const activeSessions = new Set();

// Load initial hardcoded passwords
const syncPasswords = () => {
    if (CONFIG.RAW_PASSWORDS) {
        CONFIG.RAW_PASSWORDS.split(',').forEach(pair => {
            const [id, pass] = pair.split(':');
            if (id && pass) serverPasswords.set(id.trim(), pass.trim());
        });
    }
};
syncPasswords();

const getGuildSettings = (guildId) => {
    if (!db.has(guildId)) {
        db.set(guildId, {
            // General Identity
            serverName: "Unknown Server",
            logChannelId: "",
            modRoleId: "",
            adminRoleId: "",
            
            // Moderation Shield (Advanced)
            antiLink: false,
            antiSpam: true,
            antiGhostPing: true,
            maxMentions: 5,
            blacklist: [],
            autoDeleteChannels: [],
            deleteDelay: 3000,
            ignoreBots: true,
            ignoreThreads: true,
            strictMode: false, // Deletes messages with suspicious characters
            
            // Ticket Studio Pro
            panelType: "BUTTON",
            panelTitle: "🛡️ SECURE SUPPORT TERMINAL",
            panelDesc: "Our automated dispatch system is ready to assist you. Select a department to begin encryption-protected dialogue with our staff.",
            panelColor: "#3b82f6",
            panelImage: "",
            panelThumbnail: "",
            panelFooter: "SHER LOCK PRO V5 • Enterprise Security",
            targetPanelChannel: "",
            ticketCategoryId: "",
            ticketNamingScheme: "ticket-{user}-{id}",
            ticketOptions: [
                { id: "support", label: "General Support", emoji: "🎫", welcome: "Welcome {user}. Please state your inquiry clearly." },
                { id: "report", label: "User Report", emoji: "🚩", welcome: "Welcome {user}. Please provide User ID and evidence (screenshots/links)." },
                { id: "billing", label: "Financial / Billing", emoji: "💎", welcome: "Welcome {user}. Please provide your Invoice ID." }
            ],
            ticketCloseMsg: "🔒 This session has been terminated. Logs have been archived to the security terminal."
        });
    }
    return db.get(guildId);
};

// --- CLIENT INITIALIZATION ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildModeration
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

// --- EVENT: GUILD JOIN (AUTO-PASSWORD DISPATCH) ---
client.on(Events.GuildCreate, async (guild) => {
    try {
        const randomPass = crypto.randomBytes(6).toString('hex'); // Secure 12-char hex
        serverPasswords.set(guild.id, randomPass);
        
        const owner = await guild.fetchOwner();
        const welcomeEmbed = new EmbedBuilder()
            .setTitle("🚀 SHER LOCK PRO | High-Security Protocol Initialized")
            .setThumbnail(client.user.displayAvatarURL())
            .setDescription(`Access credentials generated for **${guild.name}**. Use these to access your management terminal.`)
            .addFields(
                { name: "📍 Server ID", value: `\`${guild.id}\``, inline: true },
                { name: "🔑 Access Key", value: `\`${randomPass}\``, inline: true },
                { name: "🛡️ Dashboard URL", value: `[Access Terminal](http://localhost:${CONFIG.PORT})` }
            )
            .setColor("#3b82f6")
            .setFooter({ text: "Security Warning: Do not share these credentials." })
            .setTimestamp();

        await owner.send({ embeds: [welcomeEmbed] });
    } catch (e) {
        console.error("[AUTO-AUTH ERROR]", e.message);
    }
});

client.once('ready', () => {
    console.log(`[CORE] ${client.user.tag} v${CONFIG.VERSION} online.`);
    client.user.setPresence({
        activities: [{ name: `Over ${client.guilds.cache.size} Networks`, type: ActivityType.Watching }],
        status: 'dnd'
    });
});

// --- CORE UTILITIES ---
const logAction = (guildId, action) => {
    if (!auditLogs.has(guildId)) auditLogs.set(guildId, []);
    const logs = auditLogs.get(guildId);
    logs.unshift({ time: new Date().toLocaleTimeString(), action });
    if (logs.length > 50) logs.pop();
};

const sendSecurityLog = async (guild, title, description, color = "#3b82f6") => {
    const s = getGuildSettings(guild.id);
    if (!s.logChannelId) return;
    try {
        const channel = await guild.channels.fetch(s.logChannelId);
        if (channel) {
            const embed = new EmbedBuilder()
                .setTitle(`🚨 ${title}`)
                .setDescription(description)
                .setColor(color)
                .setTimestamp()
                .setFooter({ text: "SHER LOCK PRO Security Audit" });
            await channel.send({ embeds: [embed] });
        }
    } catch (e) {}
};

// --- MODERATION SHIELD ENGINE ---
const spamTracker = new Map();
client.on('messageCreate', async (msg) => {
    if (!msg.guild || msg.author.bot && msg.author.id === client.user.id) return;
    const s = getGuildSettings(msg.guild.id);

    // Command: Credential Recovery
    if (msg.content === '!getpass') {
        if (!msg.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const pass = serverPasswords.get(msg.guild.id);
        return msg.reply(pass ? `**Server ID:** \`${msg.guild.id}\`\n**Access Key:** \`${pass}\`` : "No key found. Try re-inviting the bot.");
    }

    // Bypass Logic
    const isStaff = msg.member?.permissions.has(PermissionFlagsBits.ManageMessages) || (s.modRoleId && msg.member?.roles.cache.has(s.modRoleId));
    if (isStaff) return;

    // Filters (Ignore Bot/Threads as per toggle)
    if (s.ignoreBots && msg.author.bot) return;
    if (s.ignoreThreads && msg.channel.isThread()) return;

    let violation = null;

    // 1. Anti-Link (Regex based)
    if (s.antiLink && /(https?:\/\/[^\s]+)/g.test(msg.content)) violation = "External Link Detected";

    // 2. Blacklist (Deep Scan)
    if (!violation && s.blacklist.some(word => msg.content.toLowerCase().includes(word.toLowerCase().trim()))) violation = "Restricted Vocabulary";

    // 3. Spam Matrix (5 messages / 3 seconds)
    if (!violation && s.antiSpam) {
        const now = Date.now();
        const userSpam = spamTracker.get(msg.author.id) || [];
        const recent = userSpam.filter(t => now - t < 3000);
        recent.push(now);
        spamTracker.set(msg.author.id, recent);
        if (recent.length >= 5) violation = "Flooding Protocol Triggered";
    }

    // 4. Mention Limit
    if (!violation && msg.mentions.users.size > s.maxMentions) violation = "Mass Mentioning";

    if (violation || s.autoDeleteChannels.includes(msg.channel.id)) {
        setTimeout(() => msg.delete().catch(() => {}), s.deleteDelay);
        if (violation) {
            sendSecurityLog(msg.guild, "Intervention", `**User:** ${msg.author.tag}\n**Reason:** ${violation}\n**Content Snippet:** \`${msg.content.slice(0, 100)}...\``, "#ef4444");
            logAction(msg.guild.id, `Intercepted ${violation} from ${msg.author.tag}`);
        }
    }
});

// --- TICKET STUDIO ENGINE ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.guildId) return;
    const s = getGuildSettings(interaction.guildId);

    // Close logic
    if (interaction.isButton() && interaction.customId === 'close_tkt') {
        await interaction.reply({ content: s.ticketCloseMsg });
        sendSecurityLog(interaction.guild, "Ticket Archived", `Channel **${interaction.channel.name}** closed by ${interaction.user.tag}`, "#f59e0b");
        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
        return;
    }

    let selectedId = null;
    if (interaction.isButton() && interaction.customId.startsWith('panel_')) selectedId = interaction.customId.replace('panel_', '');
    if (interaction.isStringSelectMenu() && interaction.customId === 'panel_select') selectedId = interaction.values[0];

    if (selectedId) {
        const opt = s.ticketOptions.find(o => o.id === selectedId);
        if (!opt) return;

        try {
            const channel = await interaction.guild.channels.create({
                name: s.ticketNamingScheme.replace('{user}', interaction.user.username).replace('{id}', Math.floor(Math.random()*9999)),
                type: ChannelType.GuildText,
                parent: s.ticketCategoryId || null,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                    { id: s.modRoleId || interaction.guild.id, allow: [PermissionFlagsBits.ViewChannel] }
                ]
            });

            const welcome = new EmbedBuilder()
                .setTitle(`${opt.emoji} ${opt.label}`)
                .setDescription(opt.welcome.replace('{user}', `<@${interaction.user.id}>`))
                .setColor(s.panelColor)
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('close_tkt').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );

            await channel.send({ content: `<@${interaction.user.id}> | Staff`, embeds: [welcome], components: [row] });
            interaction.reply({ content: `✅ Security channel established: ${channel}`, flags: MessageFlags.Ephemeral });
            logAction(interaction.guild.id, `Ticket created by ${interaction.user.tag}`);
        } catch (e) {
            interaction.reply({ content: "❌ Failed to create channel. Check Bot permissions/Category ID.", flags: MessageFlags.Ephemeral });
        }
    }
});

// --- DASHBOARD UI ENGINE (MASSIVE) ---
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ keys: [CONFIG.SESSION_SECRET], maxAge: 24 * 60 * 60 * 1000 }));

const UI_SHELL = (content, tab, gid) => {
    const s = getGuildSettings(gid);
    const logs = auditLogs.get(gid) || [{ time: "-", action: "System Warmup..." }];
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>SHER LOCK PRO | V5 Terminal</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        :root {
            --bg: #090b10; --card: #11141d; --sidebar: #0d1017;
            --accent: #3b82f6; --accent-glow: rgba(59, 130, 246, 0.3);
            --text-main: #f1f5f9; --text-muted: #64748b;
            --border: #1e293b; --danger: #ef4444; --success: #10b981;
        }
        * { box-sizing: border-box; transition: all 0.2s ease; }
        body { 
            background: var(--bg); color: var(--text-main); font-family: 'Inter', system-ui, -apple-system, sans-serif;
            margin: 0; display: flex; height: 100vh; overflow: hidden;
        }
        /* SIDEBAR */
        .sidebar {
            width: 280px; background: var(--sidebar); border-right: 1px solid var(--border);
            display: flex; flex-direction: column; padding: 30px 20px;
        }
        .logo { font-size: 20px; font-weight: 800; color: var(--accent); margin-bottom: 40px; display: flex; align-items: center; gap: 10px; }
        .nav-link { 
            text-decoration: none; color: var(--text-muted); padding: 14px 18px; border-radius: 12px;
            display: flex; align-items: center; gap: 12px; font-weight: 600; margin-bottom: 8px;
        }
        .nav-link:hover { background: rgba(255,255,255,0.03); color: var(--text-main); }
        .nav-link.active { background: var(--accent); color: white; box-shadow: 0 4px 15px var(--accent-glow); }
        
        /* CONTENT AREA */
        .viewport { flex: 1; overflow-y: auto; padding: 40px; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .badge { background: var(--border); padding: 5px 12px; border-radius: 20px; font-size: 12px; color: var(--accent); font-weight: 700; }
        
        .card { background: var(--card); border: 1px solid var(--border); border-radius: 20px; padding: 30px; margin-bottom: 30px; position: relative; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
        
        /* FORM ELEMENTS */
        label { display: block; margin-bottom: 10px; font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; }
        input, select, textarea {
            width: 100%; background: #090b10; border: 1px solid var(--border); border-radius: 12px;
            padding: 14px 18px; color: white; font-size: 14px; margin-bottom: 20px;
        }
        input:focus { border-color: var(--accent); outline: none; box-shadow: 0 0 0 3px var(--accent-glow); }
        .switch { display: flex; align-items: center; gap: 15px; margin-bottom: 20px; cursor: pointer; }
        .btn { 
            background: var(--accent); color: white; border: none; padding: 16px 30px; border-radius: 12px;
            font-weight: 700; font-size: 15px; cursor: pointer; width: 100%;
        }
        .btn:hover { transform: translateY(-2px); filter: brightness(1.1); }
        .btn-ghost { background: transparent; border: 1px solid var(--border); color: var(--text-main); }

        /* TICKET PREVIEW */
        .discord-preview { 
            background: #313338; border-radius: 12px; padding: 25px; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.4); border: 1px solid #1e1f22;
        }
        .d-embed { background: #2b2d31; border-left: 4px solid ${s.panelColor}; padding: 16px; border-radius: 4px; margin-top: 10px; }
        .d-title { font-weight: 700; color: white; font-size: 16px; margin-bottom: 8px; }
        .d-desc { color: #dbdee1; font-size: 14px; line-height: 1.5; }
        .d-btn { background: #4e5058; color: white; padding: 8px 16px; border-radius: 3px; font-size: 14px; display: inline-block; margin: 10px 8px 0 0; }
        
        /* LOGS */
        .log-list { background: #090b10; border-radius: 12px; height: 200px; overflow-y: auto; padding: 15px; font-family: monospace; border: 1px solid var(--border); }
        .log-item { padding: 8px 0; border-bottom: 1px solid #1e293b; font-size: 12px; }
        .log-item span { color: var(--accent); }

        #save-status {
            position: fixed; bottom: 30px; right: 30px; background: var(--success); color: white;
            padding: 15px 30px; border-radius: 12px; display: none; font-weight: 700; box-shadow: 0 10px 20px rgba(16,185,129,0.3);
        }
    </style>
</head>
<body>
    <div class="sidebar">
        <div class="logo">🛡️ SHER LOCK PRO</div>
        <a href="/dashboard" class="nav-link ${tab==='main'?'active':''}">Dashboard Central</a>
        <a href="/moderation" class="nav-link ${tab==='mod'?'active':''}">Moderation Shield</a>
        <a href="/tickets" class="nav-link ${tab==='tickets'?'active':''}">Ticket Studio</a>
        <a href="/" class="nav-link" style="margin-top:auto; color:var(--danger)">Logout System</a>
    </div>

    <div class="viewport">
        <div class="header">
            <div>
                <h1 style="margin:0">System Protocol</h1>
                <p style="color:var(--text-muted); margin:5px 0 0 0">Server Identity: ${gid}</p>
            </div>
            <div class="badge">V${CONFIG.VERSION}</div>
        </div>
        ${content}
    </div>

    <div id="save-status">SYSTEM UPDATED SUCCESSFULY</div>

    <script>
        function triggerSave() {
            const btn = document.getElementById('save-status');
            btn.style.display = 'block';
            setTimeout(() => { btn.style.display = 'none'; }, 3000);
        }
        function addDept() {
            const list = document.getElementById('dept-container');
            const id = 'd' + Date.now();
            list.insertAdjacentHTML('beforeend', \`
                <div class="card" id="\${id}" style="border-style:dashed">
                    <span style="position:absolute; top:15px; right:15px; color:var(--danger); cursor:pointer" onclick="document.getElementById('\${id}').remove()">[X] REMOVE</span>
                    <div class="grid-2">
                        <div><label>Label</label><input name="opt_labels[]" placeholder="General Support"></div>
                        <div><label>Emoji</label><input name="opt_emojis[]" placeholder="🎫"></div>
                    </div>
                    <label>Automated Welcome Message</label>
                    <textarea name="opt_welcomes[]" rows="2" placeholder="Hi {user}, how can we help?"></textarea>
                    <input type="hidden" name="opt_ids[]" value="\${id}">
                </div>
            \`);
        }
    </script>
</body>
</html>`;
};

// --- ROUTES ---
app.get('/', (req, res) => res.send(`
    <body style="background:#090b10; color:white; font-family:sans-serif; display:flex; justify-content:center; align-items:center; height:100vh; margin:0">
        <form action="/login" method="POST" style="background:#11141d; padding:50px; border-radius:30px; width:400px; border:1px solid #1e293b; box-shadow:0 30px 60px rgba(0,0,0,0.5)">
            <h2 style="margin-top:0">Terminal Authentication</h2>
            <p style="color:#64748b; margin-bottom:30px">Provide secure credentials to enter the control layer.</p>
            <label style="color:#64748b; font-size:11px; font-weight:700">SERVER ID</label>
            <input name="gid" placeholder="123456789..." required style="width:100%; padding:15px; background:#090b10; border:1px solid #1e293b; border-radius:12px; color:white; margin:10px 0 20px 0">
            <label style="color:#64748b; font-size:11px; font-weight:700">ACCESS KEY</label>
            <input name="pass" type="password" placeholder="••••••••••••" required style="width:100%; padding:15px; background:#090b10; border:1px solid #1e293b; border-radius:12px; color:white; margin:10px 0 30px 0">
            <button style="width:100%; padding:18px; background:#3b82f6; color:white; border:none; border-radius:12px; font-weight:bold; cursor:pointer">VERIFY IDENTITY</button>
        </form>
    </body>
`));

app.post('/login', (req, res) => {
    const { gid, pass } = req.body;
    if (serverPasswords.get(gid) === pass) {
        req.session.gid = gid;
        res.redirect('/dashboard');
    } else {
        res.send("<h1>Authentication Failed.</h1><a href='/'>Try again</a>");
    }
});

app.get('/dashboard', (req, res) => {
    const gid = req.session.gid;
    if (!gid) return res.redirect('/');
    const s = getGuildSettings(gid);
    const logs = auditLogs.get(gid) || [];
    
    res.send(UI_SHELL(`
        <form action="/save-main" method="POST">
            <div class="grid-2">
                <div class="card">
                    <h2>Primary Channels</h2>
                    <label>Security Log Terminal (Channel ID)</label>
                    <input name="logs" value="${s.logChannelId}" placeholder="1234...">
                    <label>Moderator Access Role (Role ID)</label>
                    <input name="mod" value="${s.modRoleId}" placeholder="1234...">
                </div>
                <div class="card">
                    <h2>Session Activity</h2>
                    <div class="log-list">
                        ${logs.length ? logs.map(l => `<div class="log-item"><span>[${l.time}]</span> ${l.action}</div>`).join('') : '<div style="color:#64748b">No recent alerts...</div>'}
                    </div>
                </div>
            </div>
            <button class="btn">Commit Changes</button>
        </form>
    `, 'main', gid));
});

app.get('/moderation', (req, res) => {
    const gid = req.session.gid;
    const s = getGuildSettings(gid);
    const guild = client.guilds.cache.get(gid);
    const channels = guild ? guild.channels.cache.filter(c => c.type === ChannelType.GuildText) : [];

    res.send(UI_SHELL(`
        <form action="/save-mod" method="POST">
            <div class="grid-2">
                <div class="card">
                    <h2>Shield Configuration</h2>
                    <div class="switch">
                        <input type="checkbox" name="antiLink" ${s.antiLink?'checked':''} style="width:auto; margin:0">
                        <span>Anti-Link (Zero Trust Links)</span>
                    </div>
                    <div class="switch">
                        <input type="checkbox" name="antiSpam" ${s.antiSpam?'checked':''} style="width:auto; margin:0">
                        <span>Anti-Spam Filter (5 msg/3s)</span>
                    </div>
                    <div class="switch">
                        <input type="checkbox" name="ignoreBots" ${s.ignoreBots?'checked':''} style="width:auto; margin:0">
                        <span>Ignore Bot Traffic</span>
                    </div>
                    <div class="switch">
                        <input type="checkbox" name="ignoreThreads" ${s.ignoreThreads?'checked':''} style="width:auto; margin:0">
                        <span>Ignore Thread Channels</span>
                    </div>
                    <label>Mention Limit (Global)</label>
                    <input type="number" name="maxMentions" value="${s.maxMentions}">
                </div>
                <div class="card">
                    <h2>Cleanup Targets</h2>
                    <label>Auto-Delete Channels</label>
                    <select name="autoDel[]" multiple style="height:140px">
                        ${channels.map(c => `<option value="${c.id}" ${s.autoDeleteChannels.includes(c.id)?'selected':''}># ${c.name}</option>`).join('')}
                    </select>
                    <label>Purge Delay (ms)</label>
                    <input type="number" name="delay" value="${s.deleteDelay}">
                </div>
            </div>
            <div class="card">
                <h2>Banned Vocabulary</h2>
                <label>Restricted Keywords (Comma Separated)</label>
                <textarea name="blacklist" rows="4">${s.blacklist.join(', ')}</textarea>
            </div>
            <button class="btn">Update Shield Layer</button>
        </form>
    `, 'mod', gid));
});

app.get('/tickets', (req, res) => {
    const gid = req.session.gid;
    const s = getGuildSettings(gid);
    const guild = client.guilds.cache.get(gid);
    const channels = guild ? guild.channels.cache.filter(c => c.type === ChannelType.GuildText) : [];

    res.send(UI_SHELL(`
        <form action="/save-tickets" method="POST">
            <div class="grid-2">
                <div class="card">
                    <h2>Panel Designer</h2>
                    <label>Title</label><input name="title" value="${s.panelTitle}">
                    <label>Description</label><textarea name="desc" rows="3">${s.panelDesc}</textarea>
                    <div class="grid-2">
                        <div><label>Border Hex</label><input type="color" name="color" value="${s.panelColor}" style="height:50px; padding:2px"></div>
                        <div>
                            <label>UX Mode</label>
                            <select name="type">
                                <option value="BUTTON" ${s.panelType==='BUTTON'?'selected':''}>Grid Buttons</option>
                                <option value="DROPDOWN" ${s.panelType==='DROPDOWN'?'selected':''}>Select Menu</option>
                            </select>
                        </div>
                    </div>
                    <label>Target Channel</label>
                    <select name="chan">${channels.map(c => `<option value="${c.id}" ${s.targetPanelChannel===c.id?'selected':''}># ${c.name}</option>`).join('')}</select>
                </div>
                <div class="card">
                    <h2>Live Discord Preview</h2>
                    <div class="discord-preview">
                        <div style="display:flex; gap:12px; margin-bottom:15px">
                            <div style="width:45px; height:45px; background:var(--accent); border-radius:50%"></div>
                            <div>
                                <div style="font-weight:700; color:white">SHER LOCK PRO <span style="background:#5865f2; font-size:10px; padding:2px 5px; border-radius:3px">BOT</span></div>
                                <div style="color:#949ba4; font-size:12px">Today at 11:17 AM</div>
                            </div>
                        </div>
                        <div class="d-embed">
                            <div class="d-title">${s.panelTitle}</div>
                            <div class="d-desc">${s.panelDesc}</div>
                        </div>
                        ${s.panelType === 'BUTTON' ? 
                            s.ticketOptions.slice(0, 5).map(o => `<div class="d-btn">${o.emoji} ${o.label}</div>`).join('') :
                            `<div style="background:#1e1f22; color:#dbdee1; padding:10px; border-radius:4px; margin-top:10px; font-size:14px; border:1px solid #1c1d20">Select Department... <span style="float:right">⌄</span></div>`
                        }
                    </div>
                </div>
            </div>
            
            <div id="dept-container">
                <h2>Department Configuration</h2>
                ${s.ticketOptions.map((o, i) => `
                    <div class="card" id="o_${i}">
                        <span style="position:absolute; top:15px; right:15px; color:var(--danger); cursor:pointer" onclick="this.parentElement.remove()">[X] REMOVE</span>
                        <div class="grid-2">
                            <div><label>Label</label><input name="opt_labels[]" value="${o.label}"></div>
                            <div><label>Emoji</label><input name="opt_emojis[]" value="${o.emoji}"></div>
                        </div>
                        <label>Automated Welcome Message</label>
                        <textarea name="opt_welcomes[]" rows="2">${o.welcome}</textarea>
                        <input type="hidden" name="opt_ids[]" value="${o.id}">
                    </div>
                `).join('')}
            </div>
            <button type="button" class="btn btn-ghost" onclick="addDept()" style="margin-bottom:20px">+ Add New Department</button>
            <button class="btn" style="background:var(--success)">🚀 Deploy Professional Panel</button>
        </form>
    `, 'tickets', gid));
});

// --- POST HANDLERS (PERSISTENCE) ---
app.post('/save-main', (req, res) => {
    const s = getGuildSettings(req.session.gid);
    s.logChannelId = req.body.logs;
    s.modRoleId = req.body.mod;
    logAction(req.session.gid, "Updated Primary Settings");
    res.redirect('/dashboard');
});

app.post('/save-mod', (req, res) => {
    const s = getGuildSettings(req.session.gid);
    s.antiLink = req.body.antiLink === 'on';
    s.antiSpam = req.body.antiSpam === 'on';
    s.ignoreBots = req.body.ignoreBots === 'on';
    s.ignoreThreads = req.body.ignoreThreads === 'on';
    s.maxMentions = parseInt(req.body.maxMentions) || 5;
    s.deleteDelay = parseInt(req.body.delay) || 3000;
    s.autoDeleteChannels = [].concat(req.body['autoDel[]'] || []);
    s.blacklist = req.body.blacklist.split(',').map(w => w.trim()).filter(w => w);
    logAction(req.session.gid, "Recalibrated Shield Parameters");
    res.redirect('/moderation');
});

app.post('/save-tickets', async (req, res) => {
    const s = getGuildSettings(req.session.gid);
    s.panelTitle = req.body.title;
    s.panelDesc = req.body.desc;
    s.panelColor = req.body.color;
    s.panelType = req.body.type;
    s.targetPanelChannel = req.body.chan;

    const labels = [].concat(req.body['opt_labels[]'] || []);
    const emojis = [].concat(req.body['opt_emojis[]'] || []);
    const welcomes = [].concat(req.body['opt_welcomes[]'] || []);
    const ids = [].concat(req.body['opt_ids[]'] || []);

    s.ticketOptions = labels.map((l, i) => ({ id: ids[i], label: l, emoji: emojis[i], welcome: welcomes[i] }));

    const channel = client.channels.cache.get(s.targetPanelChannel);
    if (channel) {
        const embed = new EmbedBuilder()
            .setTitle(s.panelTitle)
            .setDescription(s.panelDesc)
            .setColor(s.panelColor)
            .setFooter({ text: s.panelFooter });
        
        const row = new ActionRowBuilder();
        if (s.panelType === 'BUTTON') {
            s.ticketOptions.slice(0, 5).forEach(o => {
                row.addComponents(new ButtonBuilder().setCustomId(`panel_${o.id}`).setLabel(o.label).setEmoji(o.emoji).setStyle(ButtonStyle.Primary));
            });
        } else {
            const menu = new StringSelectMenuBuilder().setCustomId('panel_select').setPlaceholder('Select a department...');
            s.ticketOptions.forEach(o => {
                menu.addOptions(new StringSelectMenuOptionBuilder().setLabel(o.label).setValue(o.id).setEmoji(o.emoji));
            });
            row.addComponents(menu);
        }
        await channel.send({ embeds: [embed], components: [row] }).catch(() => {});
    }

    logAction(req.session.gid, "Deployed Support Panel");
    res.redirect('/tickets');
});

app.listen(CONFIG.PORT, () => console.log(`[NETWORK] Terminal established on port ${CONFIG.PORT}`));
