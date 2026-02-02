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

// --- CONFIGURATION & PASSWORD LOADING ---
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

// --- DATABASE (In-Memory State) ---
const db = new Map();
const getGuildSettings = (guildId) => {
    if (!db.has(guildId)) {
        db.set(guildId, {
            // Moderation
            autoDeleteChannels: [],
            deleteDelay: 3000,
            ignoreBots: true,
            ignoreThreads: true,
            antiLink: false,
            blacklist: [],
            logChannelId: "",
            modRoleId: "",
            // Ticket Customization
            ticketCategoryId: "",
            targetPanelChannel: "",
            panelTitle: "🛡️ SUPPORT TERMINAL",
            panelDesc: "Need assistance? Click the button below to start a private consultation with our staff.",
            panelColor: "#3b82f6",
            panelButtonLabel: "Open Ticket",
            panelButtonEmoji: "🎫",
            ticketWelcomeMsg: "Hello {user}, thank you for reaching out. Please describe your issue in detail and a staff member will be with you shortly.",
            ticketCloseMsg: "This ticket has been marked as resolved. Closing in 5 seconds..."
        });
    }
    return db.get(guildId);
};

// --- DISCORD CLIENT SETUP ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration
    ]
});

// Slash Commands
const commands = [
    new SlashCommandBuilder().setName('getpass').setDescription('Show dashboard password'),
    new SlashCommandBuilder().setName('ban').setDescription('Ban a user')
        .addUserOption(o => o.setName('target').setDescription('Target').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason')),
    new SlashCommandBuilder().setName('tempmute').setDescription('Timeout a user')
        .addUserOption(o => o.setName('target').setDescription('Target').setRequired(true))
        .addIntegerOption(o => o.setName('minutes').setDescription('Duration').setRequired(true))
];

client.once('ready', async () => {
    console.log(`[SYSTEM] Logged in as ${client.user.tag}`);
    client.user.setActivity('SHER LOCK PRO Security', { type: ActivityType.Shielding });
    
    const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('[SYSTEM] Commands synced.');
    } catch (e) { console.error(e); }
});

// Utility: Logs
const sendLog = async (guild, title, description, color = "#3b82f6") => {
    const s = getGuildSettings(guild.id);
    if (!s.logChannelId) return;
    const channel = guild.channels.cache.get(s.logChannelId);
    if (channel) {
        const embed = new EmbedBuilder().setTitle(title).setDescription(description).setColor(color).setTimestamp();
        channel.send({ embeds: [embed] }).catch(() => {});
    }
};

// --- CORE LOGIC: MODERATION ---
client.on('messageCreate', async (msg) => {
    if (!msg.guild || msg.author.id === client.user.id) return;
    const s = getGuildSettings(msg.guild.id);
    const isMod = msg.member?.permissions.has(PermissionFlagsBits.Administrator) || (s.modRoleId && msg.member?.roles.cache.has(s.modRoleId));

    // Admin Password Command
    if (msg.content === '!getpass' || msg.content === '/getpass') {
        if (!msg.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const pass = serverPasswords.get(msg.guild.id);
        return msg.reply(pass ? `Dashboard Password: \`${pass}\`` : "No password found.");
    }

    // Protection Logic
    if (s.ignoreBots && msg.author.bot) return;
    if (s.ignoreThreads && msg.channel.isThread()) return;
    if (isMod) return;

    let trigger = null;
    if (s.antiLink && msg.content.match(/https?:\/\/[^\s]+/)) trigger = "External Link Detected";
    if (s.blacklist.length > 0 && s.blacklist.some(word => word && msg.content.toLowerCase().includes(word.toLowerCase()))) trigger = "Blacklisted Phrase";
    if (s.autoDeleteChannels.includes(msg.channel.id)) trigger = "Auto-Delete Channel Activity";

    if (trigger) {
        setTimeout(() => msg.delete().catch(()=>{}), s.deleteDelay);
        if (trigger !== "Auto-Delete Channel Activity") {
            sendLog(msg.guild, "🛡️ Security Violation", `**User:** ${msg.author.tag}\n**Trigger:** ${trigger}\n**Content:** ${msg.content}`, "#ff4757");
        }
    }
});

// --- CORE LOGIC: INTERACTIONS ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.guildId) return;
    const s = getGuildSettings(interaction.guildId);

    if (interaction.isChatInputCommand()) {
        const isMod = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || (s.modRoleId && interaction.member.roles.cache.has(s.modRoleId));
        
        if (interaction.commandName === 'getpass') {
            const pass = serverPasswords.get(interaction.guildId);
            return interaction.reply({ content: pass ? `Password: \`${pass}\`` : "No password set.", flags: MessageFlags.Ephemeral });
        }

        if (!isMod) return interaction.reply({ content: "Insufficient permissions.", flags: MessageFlags.Ephemeral });

        if (interaction.commandName === 'ban') {
            const target = interaction.options.getMember('target');
            await target.ban();
            interaction.reply(`🔨 **${target.user.tag}** has been banned.`);
            sendLog(interaction.guild, "Hammer Swung", `${target.user.tag} banned by ${interaction.user.tag}`, "#ff4757");
        }

        if (interaction.commandName === 'tempmute') {
            const target = interaction.options.getMember('target');
            const mins = interaction.options.getInteger('minutes');
            await target.timeout(mins * 60000);
            interaction.reply(`⏳ **${target.user.tag}** muted for ${mins}m.`);
        }
    }

    if (interaction.isButton()) {
        if (interaction.customId === 'open_ticket') {
            try {
                const chan = await interaction.guild.channels.create({
                    name: `ticket-${interaction.user.username}`,
                    type: ChannelType.GuildText,
                    parent: s.ticketCategoryId || null,
                    permissionOverwrites: [
                        { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                        { id: s.modRoleId || interaction.guild.id, allow: [PermissionFlagsBits.ViewChannel] }
                    ]
                });
                
                const welcome = s.ticketWelcomeMsg.replace('{user}', `<@${interaction.user.id}>`);
                const embed = new EmbedBuilder().setTitle("Support Session").setDescription(welcome).setColor(s.panelColor);
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒'));
                
                await chan.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [row] });
                interaction.reply({ content: `Ticket opened: ${chan}`, flags: MessageFlags.Ephemeral });
            } catch (e) {
                interaction.reply({ content: "Deployment failed. Ensure Category ID is valid.", flags: MessageFlags.Ephemeral });
            }
        }

        if (interaction.customId === 'close_ticket') {
            interaction.reply(s.ticketCloseMsg);
            setTimeout(() => interaction.channel.delete().catch(()=>{}), 5000);
        }
    }
});

client.login(CONFIG.TOKEN);

// --- DASHBOARD: EXPRESS ENGINE ---
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ keys: [CONFIG.SESSION_SECRET], maxAge: 24 * 60 * 60 * 1000 }));

const LAYOUT = (content, tab, gid) => {
    const s = getGuildSettings(gid);
    return `
<!DOCTYPE html><html><head><title>SHER LOCK | Dashboard</title><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
    :root { --bg: #0b0f1a; --card: #161b2c; --accent: #3b82f6; --danger: #ef4444; --success: #10b981; --text: #f1f5f9; --muted: #94a3b8; }
    body { background: var(--bg); color: var(--text); font-family: 'Segoe UI', sans-serif; margin: 0; display: flex; justify-content: center; }
    .container { width: 100%; max-width: 1000px; padding: 40px 20px; }
    .card { background: var(--card); border-radius: 20px; padding: 30px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); border: 1px solid #2d3748; }
    .nav { display: flex; gap: 15px; margin-bottom: 30px; border-bottom: 1px solid #2d3748; padding-bottom: 15px; overflow-x: auto; }
    .nav a { text-decoration: none; color: var(--muted); font-weight: 600; padding: 10px 20px; border-radius: 10px; transition: 0.3s; white-space: nowrap; }
    .nav a.active { background: var(--accent); color: white; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .section { background: rgba(255,255,255,0.03); padding: 20px; border-radius: 15px; border-left: 4px solid var(--accent); margin-bottom: 20px; }
    h2 { margin: 0 0 20px 0; color: var(--accent); font-size: 1.5rem; }
    label { display: block; margin: 15px 0 5px; font-weight: bold; color: var(--muted); font-size: 13px; text-transform: uppercase; }
    input, textarea, select { width: 100%; padding: 14px; background: #0b0f1a; border: 1px solid #2d3748; color: white; border-radius: 10px; box-sizing: border-box; font-size: 14px; }
    .btn { background: var(--accent); color: white; border: none; padding: 16px; width: 100%; border-radius: 12px; cursor: pointer; font-weight: bold; font-size: 16px; margin-top: 20px; }
    .btn-save { background: var(--success); }
    /* DISCORD PREVIEW */
    .discord-mock { background: #313338; border-radius: 10px; padding: 20px; margin-top: 20px; }
    .discord-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .bot-tag { background: #5865f2; font-size: 10px; padding: 2px 5px; border-radius: 3px; font-weight: bold; }
    .discord-embed { background: #2b2d31; border-left: 4px solid ${s.panelColor}; padding: 15px; border-radius: 5px; }
    .discord-btn { background: #4e5058; color: white; padding: 8px 16px; border-radius: 4px; font-size: 14px; margin-top: 15px; display: inline-block; }
    #save-notify { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: var(--card); border: 2px solid var(--accent); padding: 15px 40px; border-radius: 50px; display: none; align-items: center; gap: 20px; box-shadow: 0 10px 50px black; z-index: 1000; }
    @media (max-width: 768px) { .grid { grid-template-columns: 1fr; } }
</style></head>
<body>
    <div class="container">
        <div class="card">
            <div class="nav">
                <a href="/dashboard" class="${tab==='main'?'active':''}">🛡️ General</a>
                <a href="/moderation" class="${tab==='mod'?'active':''}">⚔️ Moderation</a>
                <a href="/tickets" class="${tab==='tickets'?'active':''}">🎫 Tickets</a>
            </div>
            ${content}
        </div>
    </div>
    <div id="save-notify"><span>Changes detected!</span> <button onclick="document.forms[0].submit()" class="btn-save" style="padding:8px 20px; margin:0; width:auto; border-radius:30px;">Save Changes</button></div>
    <script>
        document.querySelectorAll('input, select, textarea').forEach(el => {
            el.oninput = () => document.getElementById('save-notify').style.display = 'flex';
        });
    </script>
</body></html>`;
};

app.get('/', (req, res) => res.send('<body style="background:#0b0f1a; display:flex; justify-content:center; align-items:center; height:100vh; color:white; font-family:sans-serif;"><form action="/login" method="POST" style="background:#161b2c; padding:40px; border-radius:20px; width:320px; border:1px solid #2d3748;"><h2>PRO LOGIN</h2><input name="gid" placeholder="Server ID" required style="width:100%; padding:12px; margin:10px 0; background:#0b0f1a; border:1px solid #2d3748; color:white;"><input name="pass" type="password" placeholder="Dashboard Pass" required style="width:100%; padding:12px; margin:10px 0; background:#0b0f1a; border:1px solid #2d3748; color:white;"><button style="width:100%; padding:12px; background:#3b82f6; color:white; border:none; border-radius:10px; cursor:pointer; font-weight:bold;">ENTER TERMINAL</button></form></body>'));
app.post('/login', (req, res) => { if(serverPasswords.get(req.body.gid) === req.body.pass) { req.session.gid = req.body.gid; res.redirect('/dashboard'); } else res.send("Access Denied."); });

app.get('/dashboard', (req, res) => {
    const s = getGuildSettings(req.session.gid);
    res.send(LAYOUT(`
        <form action="/save-main" method="POST">
            <h2>System Identity</h2>
            <div class="section">
                <label>Staff/Mod Role ID</label><input name="mod" value="${s.modRoleId}" placeholder="ID of role allowed to bypass filters">
                <label>Security Log Channel ID</label><input name="logs" value="${s.logChannelId}" placeholder="ID where bot sends violation logs">
            </div>
            <button class="btn">Apply Identity</button>
        </form>
    `, 'main', req.session.gid));
});

app.get('/moderation', (req, res) => {
    const gid = req.session.gid;
    const s = getGuildSettings(gid);
    const guild = client.guilds.cache.get(gid);
    const channels = guild ? guild.channels.cache.filter(c => c.type === ChannelType.GuildText) : [];
    res.send(LAYOUT(`
        <form action="/save-mod" method="POST">
            <h2>Shield Configuration</h2>
            <div class="grid">
                <div class="section">
                    <h3>Aggressive Filters</h3>
                    <label><input type="checkbox" name="antiLink" ${s.antiLink?'checked':''} style="width:auto"> Anti-Link (Block URLs)</label><br>
                    <label><input type="checkbox" name="ignoreBots" ${s.ignoreBots?'checked':''} style="width:auto"> Ignore Other Bots</label><br>
                    <label><input type="checkbox" name="ignoreThreads" ${s.ignoreThreads?'checked':''} style="width:auto"> Ignore Threads</label>
                    <label>Word Blacklist (Comma separated)</label>
                    <textarea name="blacklist" rows="3">${s.blacklist.join(', ')}</textarea>
                </div>
                <div class="section">
                    <h3>Channel Scrubbing</h3>
                    <label>Auto-Delete Targets (Hold Ctrl to select)</label>
                    <select name="autoDel[]" multiple style="height:120px">
                        ${channels.map(c => `<option value="${c.id}" ${s.autoDeleteChannels.includes(c.id)?'selected':''}>#${c.name}</option>`).join('')}
                    </select>
                    <label>Delay Before Delete (ms)</label>
                    <input type="number" name="delay" value="${s.deleteDelay}">
                </div>
            </div>
            <button class="btn">Update Shields</button>
        </form>
    `, 'mod', gid));
});

app.get('/tickets', (req, res) => {
    const gid = req.session.gid;
    const s = getGuildSettings(gid);
    const guild = client.guilds.cache.get(gid);
    const channels = guild ? guild.channels.cache.filter(c => c.type === ChannelType.GuildText) : [];
    res.send(LAYOUT(`
        <form action="/save-tickets" method="POST">
            <h2>Ticket Studio</h2>
            <div class="grid">
                <div class="section">
                    <h3>Panel Content</h3>
                    <label>Title</label><input name="title" value="${s.panelTitle}">
                    <label>Description</label><textarea name="desc" rows="3">${s.panelDesc}</textarea>
                    <label>Button Label</label><input name="btnLab" value="${s.panelButtonLabel}">
                    <label>Button Emoji</label><input name="btnEmo" value="${s.panelButtonEmoji}">
                </div>
                <div class="section">
                    <h3>Ticket Logic</h3>
                    <label>Welcome Message ({user} is tag)</label><textarea name="welcome">${s.ticketWelcomeMsg}</textarea>
                    <label>Closing Message</label><input name="close" value="${s.ticketCloseMsg}">
                    <label>Category ID (For Tickets)</label><input name="cat" value="${s.ticketCategoryId}">
                    <label>Deploy To Channel</label>
                    <select name="chan">${channels.map(c => `<option value="${c.id}" ${s.targetPanelChannel===c.id?'selected':''}>#${c.name}</option>`).join('')}</select>
                </div>
            </div>
            <div class="discord-mock">
                <div class="discord-header"><strong>SHER LOCK</strong> <span class="bot-tag">APP</span></div>
                <div class="discord-embed">
                    <div style="font-weight:bold; font-size:16px;">${s.panelTitle}</div>
                    <div style="color:#dbdee1; font-size:14px; margin-top:5px;">${s.panelDesc}</div>
                </div>
                <div class="discord-btn">${s.panelButtonEmoji} ${s.panelButtonLabel}</div>
            </div>
            <button class="btn btn-save">Deploy & Save Panel</button>
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
    s.antiLink = req.body.antiLink === 'on';
    s.ignoreBots = req.body.ignoreBots === 'on';
    s.ignoreThreads = req.body.ignoreThreads === 'on';
    s.blacklist = req.body.blacklist.split(',').map(w => w.trim()).filter(w => w.length > 0);
    s.autoDeleteChannels = Array.isArray(req.body['autoDel[]']) ? req.body['autoDel[]'] : (req.body['autoDel[]'] ? [req.body['autoDel[]']] : []);
    s.deleteDelay = parseInt(req.body.delay) || 3000;
    res.redirect('/moderation');
});

app.post('/save-tickets', async (req, res) => {
    const s = getGuildSettings(req.session.gid);
    s.panelTitle = req.body.title;
    s.panelDesc = req.body.desc;
    s.panelButtonLabel = req.body.btnLab;
    s.panelButtonEmoji = req.body.btnEmo;
    s.ticketWelcomeMsg = req.body.welcome;
    s.ticketCloseMsg = req.body.close;
    s.ticketCategoryId = req.body.cat;
    s.targetPanelChannel = req.body.chan;
    
    const chan = client.channels.cache.get(s.targetPanelChannel);
    if(chan) {
        const embed = new EmbedBuilder().setTitle(s.panelTitle).setDescription(s.panelDesc).setColor(s.panelColor);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('open_ticket').setLabel(s.panelButtonLabel).setEmoji(s.panelButtonEmoji).setStyle(ButtonStyle.Primary)
        );
        await chan.send({ embeds: [embed], components: [row] }).catch(()=>{});
    }
    res.redirect('/tickets');
});

app.listen(CONFIG.PORT, () => console.log(`[DASHBOARD] Live on port ${CONFIG.PORT}`));
