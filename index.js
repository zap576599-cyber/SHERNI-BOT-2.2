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
    MessageFlags
} = require('discord.js');
const express = require('express');
const session = require('cookie-session');
const bodyParser = require('body-parser');

// --- CONFIGURATION & ENV LOADING ---
const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    RAW_PASSWORDS: process.env.GUILD_PASSWORDS || "", 
    PORT: process.env.PORT || 10000,
    SESSION_SECRET: process.env.SESSION_SECRET || 'sher-lock-ultimate-v4-ref'
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

// --- PERSISTENT DATA STATE ---
const db = new Map();
const getGuildSettings = (guildId) => {
    if (!db.has(guildId)) {
        db.set(guildId, {
            // General & Identity
            logChannelId: "",
            modRoleId: "",
            // Moderation Shield
            antiLink: false,
            antiSpam: true,
            blacklist: [],
            autoDeleteChannels: [],
            deleteDelay: 3000,
            ignoreBots: true,
            ignoreThreads: true,
            // Ticket Studio Panel
            panelType: "BUTTON", // BUTTON or DROPDOWN
            panelTitle: "🛡️ SECURE SUPPORT TERMINAL",
            panelDesc: "Please select the department that best matches your inquiry.",
            panelColor: "#3b82f6",
            panelImage: "",
            panelFooter: "SHER LOCK PRO Security Layer",
            targetPanelChannel: "",
            ticketCategoryId: "",
            // Multi-Department Logic
            ticketOptions: [
                { id: "gen_support", label: "General Support", emoji: "🎫", welcome: "Hello {user}, a staff member will be with you shortly. Please explain your request." },
                { id: "billing", label: "Billing & Payments", emoji: "💰", welcome: "Hello {user}, please provide your Transaction ID for faster assistance." }
            ],
            ticketCloseMsg: "🔒 This ticket has been resolved and will be closed in 5 seconds."
        });
    }
    return db.get(guildId);
};

// --- SPAM CACHE ---
const spamMap = new Map();

// --- DISCORD CLIENT INITIALIZATION ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

client.once('ready', () => {
    console.log(`[CORE] Authorized as ${client.user.tag}`);
    client.user.setPresence({
        activities: [{ name: 'SHER LOCK PRO V4', type: ActivityType.Competing }],
        status: 'dnd'
    });
});

// --- LOGGING ENGINE ---
const sendLog = async (guild, title, description, color = "#3b82f6") => {
    const s = getGuildSettings(guild.id);
    if (!s.logChannelId) return;
    try {
        const channel = await guild.channels.fetch(s.logChannelId);
        if (channel) {
            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(description)
                .setColor(color)
                .setTimestamp()
                .setFooter({ text: "SHER LOCK PRO Security Logs" });
            await channel.send({ embeds: [embed] });
        }
    } catch (e) { console.error("[LOG ERROR]", e.message); }
};

// --- CORE MODERATION SCANNER ---
client.on('messageCreate', async (msg) => {
    if (!msg.guild || msg.author.id === client.user.id) return;
    const s = getGuildSettings(msg.guild.id);
    
    // Command: Get Password
    if (msg.content === '!getpass') {
        if (!msg.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const pass = serverPasswords.get(msg.guild.id);
        return msg.reply(pass ? `Dashboard Access Key: \`${pass}\`` : "No access key configured for this Server ID.");
    }

    // Bypass for Admins/Mods
    const isMod = msg.member?.permissions.has(PermissionFlagsBits.Administrator) || (s.modRoleId && msg.member?.roles.cache.has(s.modRoleId));
    if (isMod) return;

    // Filters
    if (s.ignoreBots && msg.author.bot) return;
    if (s.ignoreThreads && msg.channel.isThread()) return;

    let violation = null;

    // 1. Anti-Link
    if (s.antiLink && /(https?:\/\/[^\s]+)/g.test(msg.content)) violation = "Unauthorized Link";

    // 2. Blacklist
    if (!violation && s.blacklist.some(word => msg.content.toLowerCase().includes(word.toLowerCase()))) violation = "Blacklisted Term";

    // 3. Anti-Spam (5 msgs in 3s)
    if (!violation && s.antiSpam) {
        const now = Date.now();
        const userData = spamMap.get(msg.author.id) || [];
        const recentMsgs = userData.filter(t => now - t < 3000);
        recentMsgs.push(now);
        spamMap.set(msg.author.id, recentMsgs);
        if (recentMsgs.length >= 5) violation = "Spam Detection";
    }

    // 4. Auto-Delete Channel
    const isAutoDeleteChan = s.autoDeleteChannels.includes(msg.channel.id);

    if (violation || isAutoDeleteChan) {
        setTimeout(() => msg.delete().catch(() => {}), s.deleteDelay);
        if (violation) {
            sendLog(msg.guild, "🛡️ Shield Intervention", `**User:** ${msg.author.tag} (${msg.author.id})\n**Reason:** ${violation}\n**Channel:** ${msg.channel}\n**Content:** \`${msg.content.substring(0, 500)}\``, "#ef4444");
        }
    }
});

// --- TICKET & INTERACTION HANDLER ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.guildId) return;
    const s = getGuildSettings(interaction.guildId);

    const openTicket = async (optionId, user) => {
        const opt = s.ticketOptions.find(o => o.id === optionId) || s.ticketOptions[0];
        try {
            const channel = await interaction.guild.channels.create({
                name: `${opt.emoji}-${opt.label.toLowerCase().replace(/\s+/g, '-')}-${user.username}`,
                type: ChannelType.GuildText,
                parent: s.ticketCategoryId || null,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] },
                    { id: s.modRoleId || interaction.guild.id, allow: [PermissionFlagsBits.ViewChannel] }
                ]
            });

            const welcomeEmbed = new EmbedBuilder()
                .setTitle(`${opt.emoji} ${opt.label}`)
                .setDescription(opt.welcome.replace('{user}', `<@${user.id}>`))
                .setColor(s.panelColor)
                .setTimestamp();

            const closeRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );

            await channel.send({ content: `<@${user.id}> | Staff`, embeds: [welcomeEmbed], components: [closeRow] });
            return channel;
        } catch (e) {
            console.error(e);
            return null;
        }
    };

    if (interaction.isButton()) {
        if (interaction.customId.startsWith('tkt_')) {
            const optId = interaction.customId.replace('tkt_', '');
            const chan = await openTicket(optId, interaction.user);
            interaction.reply({ content: chan ? `Ticket created: ${chan}` : "Failed to create channel. Check Category ID.", flags: MessageFlags.Ephemeral });
        }
        if (interaction.customId === 'close_ticket') {
            await interaction.reply({ content: s.ticketCloseMsg });
            sendLog(interaction.guild, "🎫 Ticket Closed", `**Channel:** ${interaction.channel.name}\n**Closed By:** ${interaction.user.tag}`, "#f59e0b");
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
        }
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'tkt_select') {
        const chan = await openTicket(interaction.values[0], interaction.user);
        interaction.reply({ content: chan ? `Ticket created: ${chan}` : "Error creating ticket.", flags: MessageFlags.Ephemeral });
    }
});

client.login(CONFIG.TOKEN);

// --- DASHBOARD ENGINE ---
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ keys: [CONFIG.SESSION_SECRET], maxAge: 24 * 60 * 60 * 1000 }));

const THEME = (content, tab, gid) => {
    const s = getGuildSettings(gid);
    return `
<!DOCTYPE html><html><head><title>SHER LOCK PRO | Dashboard</title><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
    :root { --bg: #0b0e14; --card: #151921; --accent: #3b82f6; --danger: #ef4444; --success: #22c55e; --text: #e2e8f0; --border: #262c3a; }
    body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; margin: 0; padding: 20px; display: flex; justify-content: center; }
    .wrapper { width: 100%; max-width: 1100px; }
    .glass-card { background: var(--card); border: 1px solid var(--border); border-radius: 24px; padding: 40px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
    .sidebar { display: flex; gap: 15px; margin-bottom: 40px; border-bottom: 1px solid var(--border); padding-bottom: 20px; overflow-x: auto; }
    .sidebar a { text-decoration: none; color: #94a3b8; font-weight: 600; padding: 12px 24px; border-radius: 12px; transition: 0.2s; white-space: nowrap; }
    .sidebar a.active { background: var(--accent); color: white; box-shadow: 0 4px 15px rgba(59,130,246,0.4); }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
    .input-group { margin-bottom: 20px; }
    label { display: block; margin-bottom: 8px; font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 1px; }
    input, select, textarea { width: 100%; padding: 14px; background: #0b0e14; border: 1px solid var(--border); border-radius: 12px; color: white; box-sizing: border-box; font-size: 14px; transition: border 0.2s; }
    input:focus { border-color: var(--accent); outline: none; }
    .btn { cursor: pointer; border: none; padding: 16px; border-radius: 12px; font-weight: 700; font-size: 16px; transition: 0.2s; width: 100%; }
    .btn-primary { background: var(--accent); color: white; }
    .btn-outline { background: transparent; border: 2px solid var(--border); color: white; }
    .btn-save { background: var(--success); color: white; margin-top: 30px; }
    .opt-card { background: #1c2331; border: 1px solid var(--border); padding: 20px; border-radius: 16px; margin-bottom: 20px; position: relative; }
    .remove-opt { position: absolute; top: 15px; right: 15px; color: var(--danger); cursor: pointer; font-size: 12px; }
    /* PREVIEW */
    .preview-box { background: #313338; border-radius: 12px; padding: 20px; margin-top: 20px; }
    .preview-embed { background: #2b2d31; border-left: 4px solid ${s.panelColor}; padding: 16px; border-radius: 4px; }
    #save-bar { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: var(--card); border: 2px solid var(--accent); padding: 15px 40px; border-radius: 100px; display: none; align-items: center; gap: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.8); z-index: 999; }
    @media (max-width: 768px) { .grid { grid-template-columns: 1fr; } }
</style></head>
<body>
    <div class="wrapper">
        <div class="glass-card">
            <div class="sidebar">
                <a href="/dashboard" class="${tab==='main'?'active':''}">🛡️ General</a>
                <a href="/moderation" class="${tab==='mod'?'active':''}">⚔️ Moderation</a>
                <a href="/tickets" class="${tab==='tickets'?'active':''}">🎫 Ticket Studio</a>
            </div>
            ${content}
        </div>
    </div>
    <div id="save-bar"><span>⚠️ Unsaved Changes Detected!</span> <button onclick="document.forms[0].submit()" class="btn btn-primary" style="padding:10px 25px; width:auto;">Save Now</button></div>
    <script>
        document.querySelectorAll('input, select, textarea').forEach(el => el.oninput = () => document.getElementById('save-bar').style.display = 'flex');
        function addDepartment() {
            const list = document.getElementById('dept-list');
            const id = 'dept_' + Date.now();
            list.insertAdjacentHTML('beforeend', \`<div class="opt-card" id="\${id}"><span class="remove-opt" onclick="document.getElementById('\${id}').remove()">[DELETE]</span><label>Label</label><input name="opt_labels[]" placeholder="Support"><label>Emoji</label><input name="opt_emojis[]" placeholder="🎫"><label>Welcome Message</label><textarea name="opt_welcomes[]" rows="2" placeholder="Hi {user}..."></textarea><input type="hidden" name="opt_ids[]" value="\${id}"></div>\`);
        }
    </script>
</body></html>`;
};

app.get('/', (req, res) => res.send('<body style="background:#0b0e14; color:white; font-family:sans-serif; display:flex; justify-content:center; align-items:center; height:100vh;"><form action="/login" method="POST" style="background:#151921; padding:50px; border-radius:30px; width:350px; border:1px solid #262c3a;"><h2>SHER LOCK PRO</h2><p style="color:#64748b">Enter Terminal Credentials</p><input name="gid" placeholder="Server Guild ID" required style="width:100%; padding:15px; margin:10px 0; background:#0b0e14; border:1px solid #262c3a; border-radius:12px; color:white;"><input name="pass" type="password" placeholder="Access Key" required style="width:100%; padding:15px; margin:10px 0; background:#0b0e14; border:1px solid #262c3a; border-radius:12px; color:white;"><button style="width:100%; padding:15px; background:#3b82f6; color:white; border:none; border-radius:12px; cursor:pointer; font-weight:bold; font-size:16px;">VERIFY & ENTER</button></form></body>'));
app.post('/login', (req, res) => { if(serverPasswords.get(req.body.gid) === req.body.pass) { req.session.gid = req.body.gid; res.redirect('/dashboard'); } else res.send("Access Denied."); });

app.get('/dashboard', (req, res) => {
    const s = getGuildSettings(req.session.gid);
    res.send(THEME(`
        <form action="/save-main" method="POST">
            <h2>Identity & Connectivity</h2>
            <div class="grid">
                <div class="input-group"><label>Security Log Channel ID</label><input name="logs" value="${s.logChannelId}"></div>
                <div class="input-group"><label>Staff/Mod Role ID</label><input name="mod" value="${s.modRoleId}"></div>
            </div>
            <button class="btn btn-save">Update System Identity</button>
        </form>
    `, 'main', req.session.gid));
});

app.get('/moderation', (req, res) => {
    const gid = req.session.gid;
    const s = getGuildSettings(gid);
    const guild = client.guilds.cache.get(gid);
    const channels = guild ? guild.channels.cache.filter(c => c.type === ChannelType.GuildText) : [];
    res.send(THEME(`
        <form action="/save-mod" method="POST">
            <h2>Moderation Shield V4</h2>
            <div class="grid">
                <div class="section">
                    <label><input type="checkbox" name="antiLink" ${s.antiLink?'checked':''} style="width:auto"> Anti-Link (Real-time Scan)</label><br><br>
                    <label><input type="checkbox" name="antiSpam" ${s.antiSpam?'checked':''} style="width:auto"> Anti-Spam Protection</label>
                    <label>Banned Phrase List (Comma Separated)</label>
                    <textarea name="blacklist" rows="5">${s.blacklist.join(', ')}</textarea>
                </div>
                <div class="section">
                    <label>Auto-Delete Targets (Select Multiple)</label>
                    <select name="autoDel[]" multiple style="height:180px">
                        ${channels.map(c => `<option value="${c.id}" ${s.autoDeleteChannels.includes(c.id)?'selected':''}>#${c.name}</option>`).join('')}
                    </select>
                    <label>Clean-up Delay (ms)</label>
                    <input type="number" name="delay" value="${s.deleteDelay}">
                </div>
            </div>
            <button class="btn btn-save">Hard-Code Shield Settings</button>
        </form>
    `, 'mod', gid));
});

app.get('/tickets', (req, res) => {
    const gid = req.session.gid;
    const s = getGuildSettings(gid);
    const guild = client.guilds.cache.get(gid);
    const channels = guild ? guild.channels.cache.filter(c => c.type === ChannelType.GuildText) : [];
    res.send(THEME(`
        <form action="/save-tickets" method="POST">
            <h2>Ticket Studio (Hybrid Mode)</h2>
            <div class="grid">
                <div class="section">
                    <label>Panel Title</label><input name="title" value="${s.panelTitle}">
                    <label>Description</label><textarea name="desc" rows="4">${s.panelDesc}</textarea>
                    <label>Category ID for Tickets</label><input name="cat" value="${s.ticketCategoryId}">
                    <label>Panel Border Color (Hex)</label><input name="color" value="${s.panelColor}" type="color" style="height:50px">
                </div>
                <div class="section">
                    <label>Interface Type</label>
                    <select name="type">
                        <option value="BUTTON" ${s.panelType==='BUTTON'?'selected':''}>Multi-Buttons (Max 5)</option>
                        <option value="DROPDOWN" ${s.panelType==='DROPDOWN'?'selected':''}>Select Menu (Infinite)</option>
                    </select>
                    <label>Panel Image URL (Optional)</label><input name="image" value="${s.panelImage}">
                    <label>Deployment Channel</label>
                    <select name="chan">${channels.map(c => `<option value="${c.id}" ${s.targetPanelChannel===c.id?'selected':''}>#${c.name}</option>`).join('')}</select>
                </div>
            </div>
            <div class="section">
                <h3>Departments & Automated Responses</h3>
                <div id="dept-list">
                    ${s.ticketOptions.map((o, i) => `
                        <div class="opt-card" id="o_${i}">
                            <span class="remove-opt" onclick="this.parentElement.remove()">[DELETE]</span>
                            <div class="grid">
                                <div><label>Label</label><input name="opt_labels[]" value="${o.label}"></div>
                                <div><label>Emoji</label><input name="opt_emojis[]" value="${o.emoji}"></div>
                            </div>
                            <label>Welcome Message</label><textarea name="opt_welcomes[]" rows="2">${o.welcome}</textarea>
                            <input type="hidden" name="opt_ids[]" value="${o.id}">
                        </div>
                    `).join('')}
                </div>
                <button type="button" class="btn btn-outline" onclick="addDepartment()">+ Create New Department</button>
            </div>
            <button class="btn btn-save">🚀 Deploy New Panel</button>
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
    s.antiSpam = req.body.antiSpam === 'on';
    s.blacklist = req.body.blacklist.split(',').map(w => w.trim()).filter(w => w);
    s.autoDeleteChannels = [].concat(req.body['autoDel[]'] || []);
    s.deleteDelay = parseInt(req.body.delay) || 3000;
    res.redirect('/moderation');
});

app.post('/save-tickets', async (req, res) => {
    const s = getGuildSettings(req.session.gid);
    s.panelTitle = req.body.title;
    s.panelDesc = req.body.desc;
    s.panelType = req.body.type;
    s.panelColor = req.body.color;
    s.panelImage = req.body.image;
    s.ticketCategoryId = req.body.cat;
    s.targetPanelChannel = req.body.chan;

    const labels = [].concat(req.body['opt_labels[]'] || []);
    const emojis = [].concat(req.body['opt_emojis[]'] || []);
    const welcomes = [].concat(req.body['opt_welcomes[]'] || []);
    const ids = [].concat(req.body['opt_ids[]'] || []);

    s.ticketOptions = labels.map((l, i) => ({
        id: ids[i] || `opt_${i}`,
        label: l,
        emoji: emojis[i],
        welcome: welcomes[i]
    }));

    const chan = client.channels.cache.get(s.targetPanelChannel);
    if (chan) {
        const embed = new EmbedBuilder()
            .setTitle(s.panelTitle)
            .setDescription(s.panelDesc)
            .setColor(s.panelColor)
            .setFooter({ text: s.panelFooter })
            .setTimestamp();
        if(s.panelImage) embed.setImage(s.panelImage);

        const row = new ActionRowBuilder();
        if (s.panelType === 'BUTTON') {
            s.ticketOptions.slice(0, 5).forEach(opt => {
                row.addComponents(new ButtonBuilder().setCustomId(`tkt_${opt.id}`).setLabel(opt.label).setEmoji(opt.emoji).setStyle(ButtonStyle.Primary));
            });
        } else {
            const menu = new StringSelectMenuBuilder().setCustomId('tkt_select').setPlaceholder('Select Department...');
            s.ticketOptions.forEach(opt => {
                menu.addOptions(new StringSelectMenuOptionBuilder().setLabel(opt.label).setValue(opt.id).setEmoji(opt.emoji));
            });
            row.addComponents(menu);
        }
        await chan.send({ embeds: [embed], components: [row] }).catch(() => {});
    }
    res.redirect('/tickets');
});

app.listen(CONFIG.PORT, () => console.log(`[DASHBOARD] Pro Terminal running on port ${CONFIG.PORT}`));
