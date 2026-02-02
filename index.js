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
    REST,
    Routes,
    SlashCommandBuilder,
    MessageFlags
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

// --- DATABASE ---
const db = new Map();
const getGuildSettings = (guildId) => {
    if (!db.has(guildId)) {
        db.set(guildId, {
            autoDeleteChannels: [],
            deleteDelay: 3000,
            ignoreBots: true,
            ignoreThreads: true,
            antiLink: false,
            blacklist: [],
            logChannelId: "",
            modRoleId: "",
            customNickname: "SHER LOCK",
            ticketCategoryId: "",
            ticketMessage: "Welcome to support! How can we help you today?",
            panelTitle: "🛡️ SHER LOCK SUPPORT",
            panelDesc: "Click a button below to open a ticket with our team.",
            panelColor: "#3b82f6",
            targetPanelChannel: ""
        });
    }
    return db.get(guildId);
};

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration
    ]
});

const commands = [
    new SlashCommandBuilder().setName('getpass').setDescription('Get the dashboard password'),
    new SlashCommandBuilder().setName('ban').setDescription('Ban a user')
        .addUserOption(o => o.setName('target').setDescription('The user to ban').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason')),
    new SlashCommandBuilder().setName('tempmute').setDescription('Timeout a user')
        .addUserOption(o => o.setName('target').setDescription('The user to mute').setRequired(true))
        .addIntegerOption(o => o.setName('minutes').setDescription('Duration in minutes').setRequired(true))
];

client.once('ready', async () => {
    console.log(`[BOT] Connected as: ${client.user.tag}`);
    client.user.setActivity('Shielding your server 🛡️', { type: ActivityType.Watching });
    
    const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('[BOT] Slash commands registered successfully.');
    } catch (e) { console.error(e); }
});

const sendLog = async (guild, title, description, color = "#3b82f6") => {
    const s = getGuildSettings(guild.id);
    if (!s.logChannelId) return;
    const channel = guild.channels.cache.get(s.logChannelId);
    if (channel) {
        const embed = new EmbedBuilder().setTitle(title).setDescription(description).setColor(color).setTimestamp();
        channel.send({ embeds: [embed] }).catch(() => {});
    }
};

// --- MODERATION & PREFIX COMMAND HANDLER ---
client.on('messageCreate', async (msg) => {
    if (!msg.guild || msg.author.id === client.user.id) return;
    const s = getGuildSettings(msg.guild.id);
    const isMod = msg.member?.permissions.has(PermissionFlagsBits.Administrator) || (s.modRoleId && msg.member?.roles.cache.has(s.modRoleId));

    // Support both !getpass and /getpass
    if (msg.content === '!getpass' || msg.content === '/getpass') {
        if (!msg.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const pass = serverPasswords.get(msg.guild.id);
        return msg.reply(pass ? `Dashboard Password: \`${pass}\`` : "No password found in environment variables.");
    }

    // IGNORE BOT & THREAD FILTERS
    if (s.ignoreBots && msg.author.bot) return;
    if (s.ignoreThreads && msg.channel.isThread()) return;
    if (isMod) return;

    let trigger = null;
    if (s.antiLink && msg.content.match(/https?:\/\/[^\s]+/)) trigger = "Link detected";
    if (s.blacklist.some(word => word && msg.content.toLowerCase().includes(word.toLowerCase()))) trigger = "Blacklisted word";
    if (s.autoDeleteChannels.includes(msg.channel.id)) trigger = "Auto-delete channel";

    if (trigger) {
        setTimeout(() => msg.delete().catch(()=>{}), s.deleteDelay);
        if (trigger !== "Auto-delete channel") {
            sendLog(msg.guild, "🛡️ Shield Triggered", `**User:** ${msg.author.tag}\n**Reason:** ${trigger}\n**Content:** \`${msg.content.substring(0, 200)}\``, "#f59e0b");
        }
    }
});

// --- INTERACTION HANDLER ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.guildId) return;
    const s = getGuildSettings(interaction.guildId);

    if (interaction.isChatInputCommand()) {
        const isMod = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || (s.modRoleId && interaction.member.roles.cache.has(s.modRoleId));
        
        if (interaction.commandName === 'getpass') {
            const pass = serverPasswords.get(interaction.guildId);
            return interaction.reply({ 
                content: pass ? `Password: \`${pass}\`` : "Not found.", 
                flags: MessageFlags.Ephemeral 
            });
        }

        if (interaction.commandName === 'ban') {
            if (!isMod) return interaction.reply({ content: "Unauthorized.", flags: MessageFlags.Ephemeral });
            const target = interaction.options.getMember('target');
            await target.ban();
            interaction.reply(`✅ Banned ${target.user.tag}`);
            sendLog(interaction.guild, "🔨 Member Banned", `User: ${target.user.tag}\nBy: ${interaction.user.tag}`, "#ef4444");
        }

        if (interaction.commandName === 'tempmute') {
            if (!isMod) return interaction.reply({ content: "Unauthorized.", flags: MessageFlags.Ephemeral });
            const target = interaction.options.getMember('target');
            const mins = interaction.options.getInteger('minutes');
            await target.timeout(mins * 60000, "Muted via dashboard");
            interaction.reply(`⏳ Muted ${target.user.tag} for ${mins} minutes.`);
        }
    }

    if (interaction.isButton() && interaction.customId === 'open_ticket') {
        try {
            const chan = await interaction.guild.channels.create({
                name: `ticket-${interaction.user.username}`,
                type: ChannelType.GuildText,
                parent: s.ticketCategoryId || null,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ]
            });
            const embed = new EmbedBuilder().setTitle("Support").setDescription(s.ticketMessage).setColor(s.panelColor);
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger));
            await chan.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [row] });
            interaction.reply({ content: `Ticket created: ${chan}`, flags: MessageFlags.Ephemeral });
        } catch (e) {
            interaction.reply({ content: "Error: Category ID invalid or Permissions missing.", flags: MessageFlags.Ephemeral });
        }
    }

    if (interaction.isButton() && interaction.customId === 'close_ticket') {
        interaction.reply("Closing in 3 seconds...");
        setTimeout(() => interaction.channel.delete().catch(()=>{}), 3000);
    }
});

client.login(CONFIG.TOKEN);

// --- DASHBOARD ---
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ keys: [CONFIG.SESSION_SECRET], maxAge: 24 * 60 * 60 * 1000 }));

const UI = (content, activeTab = 'main', guildId) => {
    const s = getGuildSettings(guildId);
    return `
<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
    :root { --bg: #0f172a; --card: #1e293b; --accent: #3b82f6; --text: #f8fafc; --muted: #94a3b8; }
    body { background: var(--bg); color: var(--text); font-family: sans-serif; padding: 20px; display: flex; justify-content: center; }
    .card { background: var(--card); padding: 30px; border-radius: 16px; width: 100%; max-width: 900px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .tabs { display: flex; gap: 10px; margin-bottom: 25px; border-bottom: 1px solid #334155; padding-bottom: 10px; }
    .tab { color: var(--muted); text-decoration: none; padding: 10px 15px; border-radius: 8px; font-weight: bold; }
    .tab.active { background: var(--accent); color: white; }
    .section { background: #1a2233; padding: 20px; border-radius: 10px; margin-bottom: 20px; border-left: 4px solid var(--accent); }
    input, select, textarea { width: 100%; padding: 12px; margin: 10px 0; background: #0f172a; color: white; border: 1px solid #334155; border-radius: 8px; box-sizing: border-box; }
    .btn { background: var(--accent); color: white; border: none; padding: 15px; width: 100%; border-radius: 8px; cursor: pointer; font-weight: bold; }
    .preview { background: #2b2d31; border-radius: 8px; padding: 15px; border-left: 4px solid ${s.panelColor}; margin: 15px 0; }
    #save-bar { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: var(--card); border: 2px solid var(--accent); padding: 15px 30px; border-radius: 50px; display: none; align-items: center; gap: 20px; z-index: 99; }
</style></head>
<body>
    <div class="card">
        <div class="tabs">
            <a href="/dashboard" class="tab ${activeTab==='main'?'active':''}">🛡️ Main</a>
            <a href="/moderation" class="tab ${activeTab==='mod'?'active':''}">⚔️ Moderation</a>
            <a href="/tickets" class="tab ${activeTab==='tickets'?'active':''}">🎫 Tickets</a>
        </div>
        ${content}
    </div>
    <div id="save-bar"><span>Unsaved Changes!</span> <button onclick="document.forms[0].submit()" style="background:#10b981; border:none; color:white; padding:8px 20px; border-radius:20px; cursor:pointer;">Save</button></div>
    <script>document.querySelectorAll('input, select, textarea').forEach(el => el.oninput = () => document.getElementById('save-bar').style.display='flex');</script>
</body></html>`;
};

app.get('/', (req, res) => res.send('<body style="background:#0f172a; display:flex; justify-content:center; align-items:center; height:100vh; color:white;"><form action="/login" method="POST" style="background:#1e293b; padding:40px; border-radius:15px; width:300px;"><h2>SHER LOCK</h2><input name="gid" placeholder="Server ID" style="width:100%; padding:10px; margin:10px 0;"><input name="pass" type="password" placeholder="Password" style="width:100%; padding:10px; margin:10px 0;"><button style="width:100%; padding:10px; background:#3b82f6; color:white; border:none; cursor:pointer;">LOGIN</button></form></body>'));
app.post('/login', (req, res) => { if(serverPasswords.get(req.body.gid) === req.body.pass) { req.session.gid = req.body.gid; res.redirect('/dashboard'); } else res.send("Denied"); });

app.get('/dashboard', (req, res) => {
    const s = getGuildSettings(req.session.gid);
    res.send(UI(`<form action="/save-main" method="POST"><div class="section"><h3>Identity</h3><label>Log Channel ID</label><input name="logs" value="${s.logChannelId}"><label>Mod Role ID</label><input name="mod" value="${s.modRoleId}"></div><button class="btn">Save Changes</button></form>`, 'main', req.session.gid));
});

app.get('/moderation', (req, res) => {
    const gid = req.session.gid;
    const s = getGuildSettings(gid);
    const guild = client.guilds.cache.get(gid);
    const channels = guild ? guild.channels.cache.filter(c => c.type === ChannelType.GuildText) : [];
    res.send(UI(`
        <form action="/save-mod" method="POST">
            <div class="section">
                <h3>Ignore Settings</h3>
                <label><input type="checkbox" name="ignoreBots" ${s.ignoreBots?'checked':''} style="width:auto"> Ignore Bots</label><br>
                <label><input type="checkbox" name="ignoreThreads" ${s.ignoreThreads?'checked':''} style="width:auto"> Ignore Threads</label>
            </div>
            <div class="section">
                <h3>Auto-Delete</h3>
                <select name="autoDel[]" multiple style="height:120px">${channels.map(c => `<option value="${c.id}" ${s.autoDeleteChannels.includes(c.id)?'selected':''}>#${c.name}</option>`).join('')}</select>
                <label>Delay (ms)</label><input type="number" name="delay" value="${s.deleteDelay}">
            </div>
            <button class="btn">Update</button>
        </form>
    `, 'mod', gid));
});

app.get('/tickets', (req, res) => {
    const gid = req.session.gid;
    const s = getGuildSettings(gid);
    const guild = client.guilds.cache.get(gid);
    const channels = guild ? guild.channels.cache.filter(c => c.type === ChannelType.GuildText) : [];
    res.send(UI(`
        <form action="/save-tickets" method="POST">
            <div class="section">
                <h3>Live Preview</h3>
                <div class="preview">
                    <div style="font-weight:bold; font-size:18px;">${s.panelTitle}</div>
                    <div style="color:#dbdee1; font-size:14px; margin-top:5px;">${s.panelDesc}</div>
                </div>
                <label>Title</label><input name="title" value="${s.panelTitle}">
                <label>Description</label><textarea name="desc">${s.panelDesc}</textarea>
            </div>
            <div class="section">
                <h3>Deployment</h3>
                <label>Category ID</label><input name="cat" value="${s.ticketCategoryId}">
                <label>Channel</label><select name="chan">${channels.map(c => `<option value="${c.id}" ${s.targetPanelChannel===c.id?'selected':''}>#${c.name}</option>`).join('')}</select>
            </div>
            <button class="btn">Deploy Panel</button>
        </form>
    `, 'tickets', gid));
});

app.post('/save-main', (req, res) => {
    const s = getGuildSettings(req.session.gid);
    s.logChannelId = req.body.logs;
    s.modRoleId = req.body.mod;
    res.redirect('/dashboard');
});

app.post('/save-mod', (req, res) => {
    const s = getGuildSettings(req.session.gid);
    s.ignoreBots = req.body.ignoreBots === 'on';
    s.ignoreThreads = req.body.ignoreThreads === 'on';
    s.autoDeleteChannels = Array.isArray(req.body['autoDel[]']) ? req.body['autoDel[]'] : (req.body['autoDel[]'] ? [req.body['autoDel[]']] : []);
    s.deleteDelay = parseInt(req.body.delay) || 3000;
    res.redirect('/moderation');
});

app.post('/save-tickets', async (req, res) => {
    const s = getGuildSettings(req.session.gid);
    s.panelTitle = req.body.title;
    s.panelDesc = req.body.desc;
    s.ticketCategoryId = req.body.cat;
    s.targetPanelChannel = req.body.chan;
    
    const chan = client.channels.cache.get(s.targetPanelChannel);
    if(chan) {
        const embed = new EmbedBuilder().setTitle(s.panelTitle).setDescription(s.panelDesc).setColor(s.panelColor);
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('open_ticket').setLabel('Open Ticket').setEmoji('🎫').setStyle(ButtonStyle.Primary));
        await chan.send({ embeds: [embed], components: [row] }).catch(()=>{});
    }
    res.redirect('/tickets');
});

app.listen(CONFIG.PORT);
