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
    ChannelType,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    REST,
    Routes,
    SlashCommandBuilder
} = require('discord.js');
const express = require('express');
const session = require('cookie-session');
const bodyParser = require('body-parser');

// --- CONFIGURATION ---
const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    RAW_PASSWORDS: process.env.GUILD_PASSWORDS || "", 
    PORT: process.env.PORT || 10000,
    SESSION_SECRET: process.env.SESSION_SECRET || 'sher-lock-ultimate-ref'
};

const serverPasswords = new Map();
const loadPasswords = () => {
    if (CONFIG.RAW_PASSWORDS) {
        const cleanString = CONFIG.RAW_PASSWORDS.replace(/\s/g, '');
        cleanString.split(',').forEach(pair => {
            const [id, pass] = pair.split(':');
            if (id && pass) serverPasswords.set(id.trim(), pass.trim());
        });
    }
};
loadPasswords();

// --- DATABASE (In-Memory) ---
const db = new Map();
const getGuildSettings = (guildId) => {
    if (!db.has(guildId)) {
        db.set(guildId, {
            autoDeleteChannels: [],
            deleteDelay: 1200,
            ignoreBots: true,
            ignoreThreads: true,
            antiLink: false,
            blacklist: [],
            logChannelId: "",
            modRoleId: "",
            customNickname: "SHER LOCK",
            ticketCategoryId: "",
            supportRoleId: "",
            ticketMessage: "Welcome to support! How can we help you?",
            panelTitle: "🛡️ SHER LOCK SUPPORT",
            panelDesc: "Select an option below to get help.",
            panelColor: "#3b82f6",
            uiType: "buttons",
            targetPanelChannel: "",
            customOptions: [
                { id: 'open_ticket', label: 'General Support', emoji: '🎫' },
                { id: 'report_user', label: 'Report User', emoji: '🚫' }
            ]
        });
    }
    return db.get(guildId);
};

// --- DISCORD BOT ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration
    ]
});

// Slash Command Definitions
const commands = [
    new SlashCommandBuilder().setName('getpass').setDescription('Get the dashboard password (Admin only)'),
    new SlashCommandBuilder().setName('ban').setDescription('Ban a user from the server')
        .addUserOption(o => o.setName('target').setDescription('The user to ban').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason for the ban')),
    new SlashCommandBuilder().setName('tempmute').setDescription('Temporarily mute/timeout a user')
        .addUserOption(o => o.setName('target').setDescription('The user to mute').setRequired(true))
        .addIntegerOption(o => o.setName('minutes').setDescription('Duration in minutes').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason')),
    new SlashCommandBuilder().setName('setup').setDescription('Auto-generate a log channel and basic roles')
];

client.once('ready', async () => {
    console.log(`[BOT] Connected as: ${client.user.tag}`);
    client.user.setActivity('Shielding your server 🛡️', { type: ActivityType.Watching });
    
    const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('[BOT] Slash commands registered successfully.');
    } catch (e) { console.error("[BOT] Error registering commands:", e); }
});

// Helper for logging
const sendLog = async (guild, title, description, color = "#3b82f6") => {
    const s = getGuildSettings(guild.id);
    if (!s.logChannelId) return;
    const channel = guild.channels.cache.get(s.logChannelId);
    if (channel) {
        const embed = new EmbedBuilder().setTitle(title).setDescription(description).setColor(color).setTimestamp();
        channel.send({ embeds: [embed] }).catch(() => {});
    }
};

// --- TEXT COMMAND HANDLER ---
client.on('messageCreate', async (msg) => {
    if (!msg.guild || msg.author.bot) return;
    const s = getGuildSettings(msg.guild.id);
    const isMod = msg.member.permissions.has(PermissionFlagsBits.Administrator) || (s.modRoleId && msg.member.roles.cache.has(s.modRoleId));

    // Handle /getpass (Text)
    if (msg.content === '/getpass' && msg.member.permissions.has(PermissionFlagsBits.Administrator)) {
        const pass = serverPasswords.get(msg.guild.id);
        return msg.reply(pass ? `Dashboard Password: \`${pass}\`` : "No password configured in Environment Variables.");
    }

    // Handle /ban (Text)
    if (msg.content.startsWith('/ban') && isMod) {
        const target = msg.mentions.members.first();
        if (!target) return msg.reply("Please mention a user to ban.");
        const reason = msg.content.split(' ').slice(2).join(' ') || "No reason provided.";
        try {
            await target.ban({ reason });
            msg.reply(`✅ Banned **${target.user.tag}**`);
            sendLog(msg.guild, "🔨 Member Banned", `User: ${target.user.tag}\nReason: ${reason}\nBy: ${msg.author.tag}`, "#ef4444");
        } catch (e) { msg.reply("Failed to ban. Check bot hierarchy/permissions."); }
        return;
    }

    // --- MODERATION LOGIC ---
    if (msg.channel.isThread() && s.ignoreThreads) return;
    if (s.ignoreBots && msg.author.bot) return;

    let trigger = null;
    if (s.antiLink && msg.content.match(/https?:\/\/[^\s]+/)) trigger = "Link detected";
    if (s.blacklist.some(word => word && msg.content.toLowerCase().includes(word.toLowerCase()))) trigger = "Blacklisted word";
    if (s.autoDeleteChannels.includes(msg.channel.id)) trigger = "Auto-delete channel";

    if (trigger && !isMod) {
        setTimeout(() => msg.delete().catch(()=>{}), s.deleteDelay);
        if (trigger !== "Auto-delete channel") {
            sendLog(msg.guild, "🛡️ Message Removed", `Author: ${msg.author.tag}\nChannel: ${msg.channel}\nReason: ${trigger}\nContent: \`${msg.content.substring(0, 100)}\``, "#f59e0b");
        }
    }
});

// --- INTERACTION HANDLER ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.guildId) return;
    const s = getGuildSettings(interaction.guildId);

    // SLASH COMMANDS
    if (interaction.isChatInputCommand()) {
        const isMod = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || (s.modRoleId && interaction.member.roles.cache.has(s.modRoleId));

        if (interaction.commandName === 'getpass') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: "Administrator only.", ephemeral: true });
            const pass = serverPasswords.get(interaction.guildId);
            return interaction.reply({ content: pass ? `Password: \`${pass}\`` : "Not found.", ephemeral: true });
        }

        if (interaction.commandName === 'ban') {
            if (!isMod) return interaction.reply({ content: "Unauthorized.", ephemeral: true });
            const target = interaction.options.getMember('target');
            const reason = interaction.options.getString('reason') || "No reason.";
            await target.ban({ reason }).catch(e => interaction.reply("Failed."));
            return interaction.reply(`✅ Banned ${target.user.tag}`);
        }

        if (interaction.commandName === 'tempmute') {
            if (!isMod) return interaction.reply({ content: "Unauthorized.", ephemeral: true });
            const target = interaction.options.getMember('target');
            const mins = interaction.options.getInteger('minutes');
            await target.timeout(mins * 60000, "Command usage").catch(() => {});
            return interaction.reply(`⏳ Muted ${target.user.tag} for ${mins}m`);
        }
    }

    // TICKET INTERACTIONS
    if ((interaction.isButton() && interaction.customId.startsWith('open_')) || (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select')) {
        const typeId = interaction.values ? interaction.values[0] : interaction.customId;
        const option = s.customOptions.find(o => o.id === typeId) || { label: 'Support' };

        try {
            const chan = await interaction.guild.channels.create({
                name: `${option.label.toLowerCase().replace(/\s/g, '-')}-${interaction.user.username}`,
                type: ChannelType.GuildText,
                parent: s.ticketCategoryId || null,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                    { id: s.supportRoleId || interaction.guild.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ]
            });

            const embed = new EmbedBuilder().setTitle(`Ticket: ${option.label}`).setDescription(s.ticketMessage).setColor(s.panelColor);
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger));
            
            await chan.send({ content: `<@${interaction.user.id}> | Support Team`, embeds: [embed], components: [row] });
            return interaction.reply({ content: `✅ Ticket created: ${chan}`, ephemeral: true });
        } catch (e) {
            return interaction.reply({ content: "Error: Missing Category ID or Permissions.", ephemeral: true });
        }
    }

    if (interaction.isButton() && interaction.customId === 'close_ticket') {
        await interaction.reply("Channel will be deleted in 5 seconds...");
        setTimeout(() => interaction.channel.delete().catch(()=>{}), 5000);
    }
});

client.login(CONFIG.TOKEN);

// --- DASHBOARD (WEB INTERFACE) ---
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ keys: [CONFIG.SESSION_SECRET], maxAge: 24 * 60 * 60 * 1000 }));

const UI = (content, activeTab = 'main') => `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SHER LOCK Dashboard</title>
    <style>
        :root { --bg: #0f172a; --card: #1e293b; --accent: #3b82f6; --text: #f8fafc; --muted: #94a3b8; }
        body { background: var(--bg); color: var(--text); font-family: 'Segoe UI', sans-serif; margin: 0; padding: 20px; display: flex; justify-content: center; }
        .card { background: var(--card); padding: 30px; border-radius: 16px; width: 100%; max-width: 900px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
        .tabs { display: flex; gap: 10px; margin-bottom: 25px; border-bottom: 1px solid #334155; padding-bottom: 10px; }
        .tab { color: var(--muted); text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; transition: 0.2s; }
        .tab:hover { background: #334155; }
        .tab.active { background: var(--accent); color: white; }
        .section { background: #1a2233; padding: 20px; border-radius: 10px; margin-bottom: 20px; border-left: 4px solid var(--accent); }
        h3 { margin-top: 0; color: var(--accent); font-size: 1.1rem; text-transform: uppercase; letter-spacing: 1px; }
        label { display: block; margin-bottom: 5px; font-size: 14px; font-weight: bold; color: var(--muted); }
        input, select, textarea { width: 100%; padding: 12px; margin-bottom: 15px; background: #0f172a; color: white; border: 1px solid #334155; border-radius: 8px; box-sizing: border-box; }
        .btn { background: var(--accent); color: white; border: none; padding: 15px; width: 100%; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 16px; }
        .btn:hover { opacity: 0.9; }
        #save-bar { 
            position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); 
            background: #1e293b; border: 2px solid var(--accent); padding: 15px 30px; 
            border-radius: 50px; display: none; align-items: center; gap: 20px; 
            box-shadow: 0 10px 40px rgba(0,0,0,0.8); z-index: 999;
        }
        .opt-row { display: grid; grid-template-columns: 1fr 1fr 1fr 40px; gap: 10px; margin-bottom: 10px; }
        .btn-del { background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; }
    </style>
</head>
<body>
    <div class="card">
        <div class="tabs">
            <a href="/dashboard" class="tab ${activeTab==='main'?'active':''}">🛡️ Main</a>
            <a href="/moderation" class="tab ${activeTab==='mod'?'active':''}">⚔️ Moderation</a>
            <a href="/tickets" class="tab ${activeTab==='tickets'?'active':''}">🎫 Ticket System</a>
        </div>
        ${content}
    </div>
    <div id="save-bar">
        <span>Careful — you have unsaved changes!</span>
        <button onclick="document.forms[0].submit()" style="background:#10b981; border:none; color:white; padding:8px 20px; border-radius:20px; cursor:pointer; font-weight:bold;">Save Changes</button>
    </div>
    <script>
        document.querySelectorAll('input, select, textarea').forEach(el => {
            el.addEventListener('input', () => document.getElementById('save-bar').style.display = 'flex');
        });
        function addOpt() {
            const div = document.createElement('div'); div.className = 'opt-row';
            div.innerHTML = '<input name="l[]" placeholder="Label"><input name="i[]" placeholder="open_xxx"><input name="e[]" placeholder="Emoji"><button type="button" class="btn-del" onclick="this.parentElement.remove()">✕</button>';
            document.getElementById('opt-cont').appendChild(div);
            document.getElementById('save-bar').style.display = 'flex';
        }
    </script>
</body>
</html>`;

app.get('/', (req, res) => res.send('<body style="background:#0f172a; color:white; font-family:sans-serif; display:flex; justify-content:center; align-items:center; height:100vh;"><form action="/login" method="POST" style="background:#1e293b; padding:40px; border-radius:15px; width:300px;"><h2 style="text-align:center;color:#3b82f6">SHER LOCK LOGIN</h2><input name="gid" placeholder="Server ID" style="width:100%; padding:12px; margin:10px 0; background:#0f172a; border:1px solid #334155; color:white; border-radius:8px;"><input name="pass" type="password" placeholder="Password" style="width:100%; padding:12px; margin:10px 0; background:#0f172a; border:1px solid #334155; color:white; border-radius:8px;"><button style="width:100%; padding:12px; background:#3b82f6; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">ENTER DASHBOARD</button></form></body>'));

app.post('/login', (req, res) => {
    if (serverPasswords.get(req.body.gid) === req.body.pass) { req.session.gid = req.body.gid; res.redirect('/dashboard'); }
    else res.send("Invalid Credentials.");
});

app.get('/dashboard', (req, res) => {
    const s = getGuildSettings(req.session.gid);
    res.send(UI(`
        <form action="/save-main" method="POST">
            <div class="section">
                <h3>Global Identity</h3>
                <label>Bot Nickname</label><input name="nick" value="${s.customNickname}">
                <label>Mod Role ID (Users who can skip filters)</label><input name="mod" value="${s.modRoleId}">
                <label>Log Channel ID</label><input name="logs" value="${s.logChannelId}">
            </div>
            <button class="btn">Save Main Settings</button>
        </form>
    `, 'main'));
});

app.get('/moderation', (req, res) => {
    const gid = req.session.gid;
    const s = getGuildSettings(gid);
    const guild = client.guilds.cache.get(gid);
    const channels = guild ? guild.channels.cache.filter(c => c.type === ChannelType.GuildText) : [];
    res.send(UI(`
        <form action="/save-mod" method="POST">
            <div class="section">
                <h3>Auto-Delete Monitor</h3>
                <label>Select Channels to Clean</label>
                <select name="autoDel[]" multiple style="height:150px">
                    ${channels.map(c => `<option value="${c.id}" ${s.autoDeleteChannels.includes(c.id)?'selected':''}>#${c.name}</option>`).join('')}
                </select>
                <label>Delete Delay (ms)</label><input type="number" name="delay" value="${s.deleteDelay}">
            </div>
            <div class="section">
                <h3>Word & Link Protection</h3>
                <label><input type="checkbox" name="antiLink" ${s.antiLink?'checked':''} style="width:auto"> Anti-Link Protection</label>
                <label>Blacklisted Words (Comma Separated)</label>
                <textarea name="words" rows="4">${s.blacklist.join(', ')}</textarea>
            </div>
            <button class="btn">Update Protection</button>
        </form>
    `, 'mod'));
});

app.get('/tickets', (req, res) => {
    const gid = req.session.gid;
    const s = getGuildSettings(gid);
    const guild = client.guilds.cache.get(gid);
    const channels = guild ? guild.channels.cache.filter(c => c.type === ChannelType.GuildText) : [];
    res.send(UI(`
        <form action="/save-tickets" method="POST">
            <div class="section">
                <h3>Deployment</h3>
                <label>Channel to post Ticket Panel</label>
                <select name="chan">${channels.map(c => `<option value="${c.id}" ${s.targetPanelChannel===c.id?'selected':''}>#${c.name}</option>`).join('')}</select>
                <label>Category ID for new tickets</label><input name="cat" value="${s.ticketCategoryId}">
                <label>Support Role ID (Allowed to view tickets)</label><input name="supp" value="${s.supportRoleId}">
            </div>
            <div class="section">
                <h3>Interactive Options</h3>
                <div id="opt-cont">
                    ${s.customOptions.map(o => `<div class="opt-row"><input name="l[]" value="${o.label}"><input name="i[]" value="${o.id}"><input name="e[]" value="${o.emoji}"><button type="button" class="btn-del" onclick="this.parentElement.remove()">✕</button></div>`).join('')}
                </div>
                <button type="button" class="btn" style="background:#475569; margin-top:10px;" onclick="addOpt()">+ Add Option</button>
            </div>
            <button class="btn" style="background:#10b981">Deploy & Update Panel</button>
        </form>
    `, 'tickets'));
});

// SAVE HANDLERS
app.post('/save-main', (req, res) => {
    const s = getGuildSettings(req.session.gid);
    s.customNickname = req.body.nick;
    s.modRoleId = req.body.mod;
    s.logChannelId = req.body.logs;
    res.redirect('/dashboard');
});

app.post('/save-mod', (req, res) => {
    const s = getGuildSettings(req.session.gid);
    s.autoDeleteChannels = Array.isArray(req.body['autoDel[]']) ? req.body['autoDel[]'] : (req.body['autoDel[]'] ? [req.body['autoDel[]']] : []);
    s.deleteDelay = parseInt(req.body.delay) || 1200;
    s.antiLink = req.body.antiLink === 'on';
    s.blacklist = req.body.words.split(',').map(w => w.trim()).filter(w => w);
    res.redirect('/moderation');
});

app.post('/save-tickets', async (req, res) => {
    const s = getGuildSettings(req.session.gid);
    s.targetPanelChannel = req.body.chan;
    s.ticketCategoryId = req.body.cat;
    s.supportRoleId = req.body.supp;

    if(req.body['l[]']) {
        const labels = Array.isArray(req.body['l[]']) ? req.body['l[]'] : [req.body['l[]']];
        const ids = Array.isArray(req.body['i[]']) ? req.body['i[]'] : [req.body['i[]']];
        const emojis = Array.isArray(req.body['e[]']) ? req.body['e[]'] : [req.body['e[]']];
        s.customOptions = labels.map((l, idx) => ({ label: l, id: ids[idx], emoji: emojis[idx] || '🎫' }));
    }

    const chan = client.channels.cache.get(s.targetPanelChannel);
    if(chan) {
        const embed = new EmbedBuilder().setTitle(s.panelTitle).setDescription(s.panelDesc).setColor(s.panelColor);
        const row = new ActionRowBuilder();
        s.customOptions.forEach(o => row.addComponents(new ButtonBuilder().setCustomId(o.id).setLabel(o.label).setEmoji(o.emoji).setStyle(ButtonStyle.Secondary)));
        await chan.send({ embeds: [embed], components: [row] }).catch(() => {});
    }
    res.redirect('/tickets');
});

app.listen(CONFIG.PORT);
