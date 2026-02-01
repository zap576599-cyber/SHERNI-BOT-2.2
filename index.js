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
    StringSelectMenuOptionBuilder
} = require('discord.js');
const express = require('express');
const session = require('cookie-session');
const bodyParser = require('body-parser');
const crypto = require('crypto');

// --- CONFIGURATION ---
const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    RAW_PASSWORDS: process.env.GUILD_PASSWORDS || "", 
    PORT: process.env.PORT || 10000,
    SESSION_SECRET: process.env.SESSION_SECRET || 'sher-lock-secret-v3'
};

const serverPasswords = new Map();
const loadPasswords = () => {
    if (CONFIG.RAW_PASSWORDS) {
        CONFIG.RAW_PASSWORDS.split(',').forEach(pair => {
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
            // Ticket System Settings
            ticketCategoryId: "",
            supportRoleId: "",
            // Dynamic UI Settings
            panelTitle: "🛡️ SHER LOCK Support",
            panelDesc: "Select a category from the menu below to open a ticket.",
            panelImage: "",
            panelColor: "#2B2D31",
            ticketLabel: "Open Support",
            appealLabel: "Ban Appeal",
            ticketMessage: "Welcome to support! A staff member will be with you shortly.",
            appealMessage: "Submit your ban appeal here. Please be honest."
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
        GatewayIntentBits.GuildMembers
    ]
});

client.once('ready', () => {
    console.log(`[BOT] SHER LOCK Online as ${client.user.tag}`);
    client.user.setActivity('SHER LOCK 🛡️', { type: ActivityType.Watching });
});

// Ticket Interaction Handler
client.on('interactionCreate', async (interaction) => {
    if (!interaction.guildId) return;
    const s = getGuildSettings(interaction.guildId);

    // Dropdown or Button Handling
    if ((interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') || interaction.isButton()) {
        const type = interaction.values ? interaction.values[0] : interaction.customId;
        
        // Allowed ticket opening types
        const ticketTypes = ['open_ticket', 'open_appeal', 'partnership'];
        // Allowed management types
        const managementTypes = ['claim_ticket', 'close_ticket', 'confirm_close', 'delete_ticket'];

        if (!ticketTypes.includes(type) && !managementTypes.includes(type)) return;

        // --- OPENING A TICKET ---
        if (ticketTypes.includes(type)) {
            if (!s.ticketCategoryId) return interaction.reply({ content: "Ticket system not configured.", ephemeral: true });

            try {
                const channel = await interaction.guild.channels.create({
                    name: `${type.replace('open_', '')}-${interaction.user.username}`,
                    type: ChannelType.GuildText,
                    parent: s.ticketCategoryId,
                    permissionOverwrites: [
                        { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                        { id: s.supportRoleId || interaction.guild.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                    ]
                });

                const embed = new EmbedBuilder()
                    .setTitle(`🛡️ ${type.toUpperCase().replace('OPEN_', '')}`)
                    .setDescription(type === 'open_appeal' ? s.appealMessage : s.ticketMessage)
                    .setColor(0x3b82f6);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim').setEmoji('🙋').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Secondary)
                );

                await channel.send({ content: `<@&${s.supportRoleId}> | <@${interaction.user.id}>`, embeds: [embed], components: [row] });
                return interaction.reply({ content: `Ticket created: ${channel}`, ephemeral: true });
            } catch (err) {
                console.error(err);
                return interaction.reply({ content: "Error creating ticket. Check bot permissions.", ephemeral: true });
            }
        }
    }

    // --- BUTTON LOGIC (CLAIM/CLOSE/DELETE) ---
    if (interaction.isButton()) {
        if (interaction.customId === 'claim_ticket') {
            await interaction.channel.send({ content: `🛡️ Ticket claimed by <@${interaction.user.id}>` });
            return interaction.deferUpdate();
        }
        if (interaction.customId === 'close_ticket') {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('confirm_close').setLabel('Confirm Close').setStyle(ButtonStyle.Danger)
            );
            return interaction.reply({ content: "Confirm closure?", components: [row] });
        }
        if (interaction.customId === 'confirm_close') {
            await interaction.channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: false });
            if (s.logChannelId) {
                const log = interaction.guild.channels.cache.get(s.logChannelId);
                if (log) log.send(`📜 Ticket ${interaction.channel.name} was closed.`);
            }
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('delete_ticket').setLabel('Delete').setStyle(ButtonStyle.Danger)
            );
            return interaction.update({ content: "Ticket Closed.", components: [row] });
        }
        if (interaction.customId === 'delete_ticket') {
            await interaction.channel.delete().catch(() => {});
        }
    }
});

client.on('messageCreate', async (msg) => {
    if (!msg.guild || msg.author.bot) return;
    const s = getGuildSettings(msg.guild.id);
    const isAuthorized = msg.member.permissions.has(PermissionFlagsBits.Administrator) || (s.modRoleId && msg.member.roles.cache.has(s.modRoleId));

    if (msg.content === '!setup-tickets' && isAuthorized) {
        const embed = new EmbedBuilder()
            .setTitle(s.panelTitle)
            .setDescription(s.panelDesc)
            .setColor(s.panelColor || '#3b82f6');
        
        if (s.panelImage) embed.setImage(s.panelImage);

        const select = new StringSelectMenuBuilder()
            .setCustomId('ticket_select')
            .setPlaceholder('Choose a ticket category...')
            .addOptions(
                new StringSelectMenuOptionBuilder().setLabel(s.ticketLabel).setValue('open_ticket').setEmoji('🎫'),
                new StringSelectMenuOptionBuilder().setLabel(s.appealLabel).setValue('open_appeal').setEmoji('⚖️'),
                new StringSelectMenuOptionBuilder().setLabel('Partnership').setValue('partnership').setEmoji('🤝')
            );

        const row = new ActionRowBuilder().addComponents(select);

        await msg.channel.send({ embeds: [embed], components: [row] });
        return msg.delete().catch(() => {});
    }
});

client.login(CONFIG.TOKEN);

// --- WEB INTERFACE ---
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ keys: [CONFIG.SESSION_SECRET], maxAge: 24 * 60 * 60 * 1000 }));

const UI = (content, activeTab = 'settings') => `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SHER LOCK Dashboard</title>
    <style>
        body { background: #0f172a; color: #f8fafc; font-family: sans-serif; display: flex; justify-content: center; padding: 20px; margin: 0; }
        .card { background: #1e293b; padding: 30px; border-radius: 12px; width: 100%; max-width: 800px; box-shadow: 0 4px 20px rgba(0,0,0,0.4); }
        .tabs { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 2px solid #334155; padding-bottom: 10px; overflow-x: auto; }
        .tab { cursor: pointer; padding: 10px 20px; border-radius: 6px; text-decoration: none; color: #94a3b8; font-weight: bold; white-space: nowrap; }
        .tab.active { background: #3b82f6; color: white; }
        input, textarea, select { width: 100%; padding: 12px; margin: 8px 0; border-radius: 6px; border: 1px solid #334155; background: #0f172a; color: white; box-sizing: border-box; }
        .btn { background: #3b82f6; color: white; border: none; padding: 14px; border-radius: 6px; cursor: pointer; width: 100%; font-weight: bold; margin-top: 15px; }
        .section { margin-bottom: 20px; padding: 15px; background: #1a2233; border-radius: 8px; border-left: 4px solid #3b82f6; }
        label { font-weight: bold; color: #94a3b8; font-size: 0.85em; text-transform: uppercase; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        @media (max-width: 600px) { .grid { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <div class="card">
        <div class="tabs">
            <a href="/dashboard" class="tab ${activeTab === 'settings' ? 'active' : ''}">🛡️ Main</a>
            <a href="/tickets" class="tab ${activeTab === 'tickets' ? 'active' : ''}">🎫 Ticket Config</a>
            <a href="/editor" class="tab ${activeTab === 'editor' ? 'active' : ''}">🎨 Panel Designer</a>
        </div>
        ${content}
    </div>
</body>
</html>
`;

app.get('/', (req, res) => {
    res.send(`<body style="background:#0f172a; color:white; font-family:sans-serif; display:flex; justify-content:center; align-items:center; height:100vh;">
        <form action="/login" method="POST" style="background:#1e293b; padding:40px; border-radius:12px; width:300px;">
            <h2 style="text-align:center">🛡️ SHER LOCK</h2>
            <input type="text" name="gid" placeholder="Server ID" style="width:100%; padding:10px; margin:10px 0; border-radius:4px; border:none;" required>
            <input type="password" name="pass" placeholder="Dashboard Password" style="width:100%; padding:10px; margin:10px 0; border-radius:4px; border:none;" required>
            <button style="width:100%; padding:10px; background:#3b82f6; color:white; border:none; border-radius:4px; cursor:pointer;">Login</button>
        </form>
    </body>`);
});

app.post('/login', (req, res) => {
    if (serverPasswords.get(req.body.gid) === req.body.pass) { req.session.guildId = req.body.gid; res.redirect('/dashboard'); }
    else res.send("Denied Access. <a href='/'>Try again</a>");
});

app.get('/dashboard', (req, res) => {
    const s = getGuildSettings(req.session.guildId);
    if (!req.session.guildId) return res.redirect('/');
    res.send(UI(`
        <h2>Main Settings</h2>
        <form action="/save" method="POST">
            <div class="section"><label>Bot Nickname</label><input type="text" name="nickname" value="${s.customNickname}"></div>
            <div class="section"><label>Mod Role ID</label><input type="text" name="modRole" value="${s.modRoleId}"></div>
            <div class="section"><label>Log Channel ID</label><input type="text" name="logChan" value="${s.logChannelId}"></div>
            <button class="btn">Save Main Settings</button>
        </form>
    `, 'settings'));
});

app.get('/tickets', (req, res) => {
    const s = getGuildSettings(req.session.guildId);
    if (!req.session.guildId) return res.redirect('/');
    res.send(UI(`
        <h2>Ticket Logic</h2>
        <form action="/save-tickets" method="POST">
            <div class="section"><label>Category ID</label><input type="text" name="catId" value="${s.ticketCategoryId}"></div>
            <div class="section"><label>Support Role ID</label><input type="text" name="supportRole" value="${s.supportRoleId}"></div>
            <div class="section">
                <label>Ticket Open Message</label><textarea name="tMsg">${s.ticketMessage}</textarea>
                <label>Appeal Open Message</label><textarea name="aMsg">${s.appealMessage}</textarea>
            </div>
            <button class="btn">Save Logic</button>
        </form>
    `, 'tickets'));
});

app.get('/editor', (req, res) => {
    const s = getGuildSettings(req.session.guildId);
    if (!req.session.guildId) return res.redirect('/');
    res.send(UI(`
        <h2>🎨 Panel Designer</h2>
        <p style="color:#94a3b8; font-size:0.8em;">Edit how the <b>!setup-tickets</b> embed looks.</p>
        <form action="/save-editor" method="POST">
            <div class="section">
                <label>Embed Title</label><input type="text" name="pTitle" value="${s.panelTitle}">
                <label>Embed Description</label><textarea name="pDesc" rows="4">${s.panelDesc}</textarea>
            </div>
            <div class="grid">
                <div class="section"><label>Embed Color (Hex)</label><input type="text" name="pColor" value="${s.panelColor}"></div>
                <div class="section"><label>Banner Image URL</label><input type="text" name="pImage" value="${s.panelImage}"></div>
            </div>
            <div class="section" style="border-left-color: #f59e0b;">
                <label>Menu Options Text</label>
                <div class="grid">
                    <input type="text" name="lTicket" value="${s.ticketLabel}" placeholder="Support Label">
                    <input type="text" name="lAppeal" value="${s.appealLabel}" placeholder="Appeal Label">
                </div>
            </div>
            <button class="btn" style="background:#8b5cf6;">Update Visuals</button>
        </form>
    `, 'editor'));
});

app.post('/save', (req, res) => {
    const s = getGuildSettings(req.session.guildId);
    s.customNickname = req.body.nickname;
    s.modRoleId = req.body.modRole;
    s.logChannelId = req.body.logChan;
    res.redirect('/dashboard');
});

app.post('/save-tickets', (req, res) => {
    const s = getGuildSettings(req.session.guildId);
    s.ticketCategoryId = req.body.catId;
    s.supportRoleId = req.body.supportRole;
    s.ticketMessage = req.body.tMsg;
    s.appealMessage = req.body.aMsg;
    res.redirect('/tickets');
});

app.post('/save-editor', (req, res) => {
    const s = getGuildSettings(req.session.guildId);
    s.panelTitle = req.body.pTitle;
    s.panelDesc = req.body.pDesc;
    s.panelColor = req.body.pColor;
    s.panelImage = req.body.pImage;
    s.ticketLabel = req.body.lTicket;
    s.appealLabel = req.body.lAppeal;
    res.redirect('/editor');
});

app.listen(CONFIG.PORT, '0.0.0.0', () => console.log("SHER LOCK Dashboard Live"));
