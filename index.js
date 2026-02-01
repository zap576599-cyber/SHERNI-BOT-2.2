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
    SESSION_SECRET: process.env.SESSION_SECRET || 'sher-lock-ultimate-v4'
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
            // MODERATION FEATURES (The "Before" Features)
            autoDeleteChannels: [],
            deleteDelay: 1200,
            ignoreBots: true,
            ignoreThreads: true,
            antiLink: false,
            blacklist: [],
            logChannelId: "",
            modRoleId: "",
            customNickname: "SHER LOCK",
            
            // TICKET SYSTEM
            ticketCategoryId: "",
            supportRoleId: "",
            ticketMessage: "Welcome to support! How can we help you?",
            
            // DYNAMIC UI (The "Create as many as you want" logic)
            panelTitle: "🛡️ SHER LOCK SUPPORT",
            panelDesc: "Click a button below or use the menu to open a ticket.",
            panelImage: "",
            panelColor: "#3b82f6",
            // Array of custom buttons/options
            customOptions: [
                { id: 'open_ticket', label: 'General Support', emoji: '🎫' },
                { id: 'open_appeal', label: 'Ban Appeal', emoji: '⚖️' }
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
        GatewayIntentBits.GuildMembers
    ]
});

client.once('ready', () => {
    console.log(`[BOT] SHER LOCK PRO Online as ${client.user.tag}`);
    client.user.setActivity('Protecting Servers', { type: ActivityType.Watching });
});

// Interaction Handler
client.on('interactionCreate', async (interaction) => {
    if (!interaction.guildId) return;
    const s = getGuildSettings(interaction.guildId);

    // Create Ticket Logic
    const isTicketOpening = (interaction.isButton() && interaction.customId.startsWith('open_')) || 
                           (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select');

    if (isTicketOpening) {
        const type = interaction.values ? interaction.values[0] : interaction.customId;
        if (!s.ticketCategoryId) return interaction.reply({ content: "Ticket category not set in dashboard!", ephemeral: true });

        const channel = await interaction.guild.channels.create({
            name: `${type.replace('open_', '')}-${interaction.user.username}`,
            type: ChannelType.GuildText,
            parent: s.ticketCategoryId,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                { id: s.supportRoleId || interaction.guild.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });

        const embed = new EmbedBuilder()
            .setTitle(`🛡️ ${type.toUpperCase().replace('OPEN_', '')}`)
            .setDescription(s.ticketMessage)
            .setColor(0x3b82f6);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ content: `<@&${s.supportRoleId}> <@${interaction.user.id}>`, embeds: [embed], components: [row] });
        return interaction.reply({ content: `Ticket created: ${channel}`, ephemeral: true });
    }

    // Staff Actions
    if (interaction.isButton()) {
        if (interaction.customId === 'claim_ticket') {
            return interaction.reply({ content: `🙋 Ticket claimed by <@${interaction.user.id}>` });
        }
        if (interaction.customId === 'close_ticket') {
            await interaction.channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: false });
            return interaction.reply({ content: "🔒 Ticket closed. Use `!delete` to remove channel." });
        }
    }
});

// Auto-Mod & Deletion Logic (The Restored Features)
client.on('messageCreate', async (msg) => {
    if (!msg.guild || msg.author.bot) return;
    const s = getGuildSettings(msg.guild.id);

    // Admin commands
    const isAuthorized = msg.member.permissions.has(PermissionFlagsBits.Administrator) || (s.modRoleId && msg.member.roles.cache.has(s.modRoleId));
    
    if (msg.content === '!setup-tickets' && isAuthorized) {
        const embed = new EmbedBuilder()
            .setTitle(s.panelTitle)
            .setDescription(s.panelDesc)
            .setColor(s.panelColor);
        if (s.panelImage) embed.setImage(s.panelImage);

        const row = new ActionRowBuilder();
        s.customOptions.forEach(opt => {
            row.addComponents(new ButtonBuilder().setCustomId(opt.id).setLabel(opt.label).setEmoji(opt.emoji).setStyle(ButtonStyle.Secondary));
        });

        await msg.channel.send({ embeds: [embed], components: [row] });
        return msg.delete().catch(()=>{});
    }

    // AUTO-MODERATION ENGINE
    let shouldDelete = false;

    if (s.antiLink && msg.content.match(/https?:\/\/[^\s]+/)) shouldDelete = true;
    if (s.blacklist.some(word => msg.content.toLowerCase().includes(word.toLowerCase()))) shouldDelete = true;
    if (s.autoDeleteChannels.includes(msg.channel.id)) shouldDelete = true;

    if (shouldDelete) {
        if (msg.channel.isThread() && s.ignoreThreads) return;
        setTimeout(() => msg.delete().catch(()=>{}), s.deleteDelay);
    }
});

client.login(CONFIG.TOKEN);

// --- WEB INTERFACE ---
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ keys: [CONFIG.SESSION_SECRET], maxAge: 24 * 60 * 60 * 1000 }));

const UI = (content, activeTab = 'main') => `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { background: #0f172a; color: #f8fafc; font-family: sans-serif; padding: 20px; display: flex; justify-content: center; }
        .card { background: #1e293b; padding: 25px; border-radius: 12px; width: 100%; max-width: 800px; }
        .tabs { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid #334155; padding-bottom: 10px; }
        .tab { color: #94a3b8; text-decoration: none; padding: 8px 15px; border-radius: 5px; }
        .tab.active { background: #3b82f6; color: white; }
        .section { background: #1a2233; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #3b82f6; }
        input, textarea { width: 100%; padding: 10px; margin: 8px 0; background: #0f172a; color: white; border: 1px solid #334155; border-radius: 5px; box-sizing: border-box; }
        .btn { background: #3b82f6; color: white; border: none; padding: 12px; border-radius: 5px; cursor: pointer; width: 100%; font-weight: bold; }
        .btn-add { background: #10b981; margin-top: 10px; font-size: 0.8em; }
        .opt-row { display: grid; grid-template-columns: 1fr 1fr 40px; gap: 10px; align-items: center; margin-bottom: 5px; }
    </style>
</head>
<body>
    <div class="card">
        <div class="tabs">
            <a href="/dashboard" class="tab ${activeTab==='main'?'active':''}">🛡️ Moderation</a>
            <a href="/tickets" class="tab ${activeTab==='tickets'?'active':''}">🎫 Tickets</a>
        </div>
        ${content}
    </div>
</body>
</html>
`;

app.get('/', (req, res) => res.send('<form action="/login" method="POST">ID: <input name="gid"> Pass: <input name="pass" type="password"><button>Login</button></form>'));
app.post('/login', (req, res) => { if(serverPasswords.get(req.body.gid) === req.body.pass) { req.session.gid = req.body.gid; res.redirect('/dashboard'); } else res.send("Fail"); });

app.get('/dashboard', (req, res) => {
    const s = getGuildSettings(req.session.gid);
    const guild = client.guilds.cache.get(req.session.gid);
    if(!guild) return res.redirect('/');
    res.send(UI(`
        <h2>Moderation Settings (Restored)</h2>
        <form action="/save-mod" method="POST">
            <div class="section">
                <label>Auto-Delete Channels</label>
                ${guild.channels.cache.filter(c => c.isTextBased()).map(c => `
                    <div><input type="checkbox" name="chans" value="${c.id}" ${s.autoDeleteChannels.includes(c.id)?'checked':''} style="width:auto"> ${c.name}</div>
                `).join('')}
            </div>
            <div class="section">
                <label>Blacklist Words (comma separated)</label>
                <textarea name="words">${s.blacklist.join(', ')}</textarea>
                <label>Delete Delay (ms)</label>
                <input type="number" name="delay" value="${s.deleteDelay}">
                <label>Anti-Link</label>
                <input type="checkbox" name="antiLink" ${s.antiLink?'checked':''} style="width:auto">
            </div>
            <button class="btn">Save Moderation</button>
        </form>
    `, 'main'));
});

app.get('/tickets', (req, res) => {
    const s = getGuildSettings(req.session.gid);
    res.send(UI(`
        <h2>Ticket System Designer</h2>
        <form action="/save-tickets" method="POST">
            <div class="section">
                <label>Category ID</label><input name="catId" value="${s.ticketCategoryId}">
                <label>Support Role ID</label><input name="supportRole" value="${s.supportRoleId}">
            </div>
            <div class="section">
                <label>Embed Title</label><input name="pTitle" value="${s.panelTitle}">
                <label>Embed Description</label><textarea name="pDesc">${s.panelDesc}</textarea>
            </div>
            <div class="section">
                <label>Custom Buttons (Label | Emoji | Custom ID)</label>
                <div id="options">
                    ${s.customOptions.map((o, i) => `
                        <div class="opt-row">
                            <input name="labels[]" value="${o.label}" placeholder="Label">
                            <input name="emojis[]" value="${o.emoji}" placeholder="Emoji">
                            <input name="ids[]" value="${o.id}" placeholder="open_xxx">
                        </div>
                    `).join('')}
                </div>
                <p style="font-size: 0.8em; color: #94a3b8;">* Note: Start IDs with <b>open_</b> to trigger ticket opening.</p>
            </div>
            <button class="btn">Save & Update Panel</button>
        </form>
    `, 'tickets'));
});

app.post('/save-mod', (req, res) => {
    const s = getGuildSettings(req.session.gid);
    s.autoDeleteChannels = Array.isArray(req.body.chans) ? req.body.chans : (req.body.chans ? [req.body.chans] : []);
    s.blacklist = req.body.words.split(',').map(w => w.trim()).filter(w => w);
    s.deleteDelay = parseInt(req.body.delay);
    s.antiLink = req.body.antiLink === 'on';
    res.redirect('/dashboard');
});

app.post('/save-tickets', (req, res) => {
    const s = getGuildSettings(req.session.gid);
    s.ticketCategoryId = req.body.catId;
    s.supportRoleId = req.body.supportRole;
    s.panelTitle = req.body.pTitle;
    s.panelDesc = req.body.pDesc;
    
    // Handle dynamic buttons
    const labels = req.body['labels[]'];
    const emojis = req.body['emojis[]'];
    const ids = req.body['ids[]'];
    
    if(labels) {
        s.customOptions = labels.map((l, i) => ({ label: l, emoji: emojis[i], id: ids[i] })).filter(o => o.label);
    }
    
    res.redirect('/tickets');
});

app.listen(CONFIG.PORT, () => console.log("SHER LOCK ULTIMATE LIVE"));
