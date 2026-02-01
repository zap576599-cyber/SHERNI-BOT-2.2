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

// --- CONFIGURATION ---
const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    RAW_PASSWORDS: process.env.GUILD_PASSWORDS || "", 
    PORT: process.env.PORT || 10000,
    SESSION_SECRET: process.env.SESSION_SECRET || 'sher-lock-ultimate-final'
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
            // MODERATION FEATURES
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
            
            // DYNAMIC UI
            panelTitle: "🛡️ SHER LOCK SUPPORT",
            panelDesc: "Click a button below or use the menu to open a ticket.",
            panelImage: "",
            panelColor: "#3b82f6",
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

// DM Password to Owner on Join
client.on('guildCreate', async (guild) => {
    const owner = await guild.fetchOwner();
    const pass = serverPasswords.get(guild.id);
    if (pass && owner) {
        owner.send(`🛡️ **SHER LOCK PRO Setup**\nYour dashboard password for **${guild.name}** is: \`${pass}\`\nLogin at your Render URL using Server ID: \`${guild.id}\``).catch(() => console.log("Couldn't DM owner."));
    }
});

client.once('ready', () => {
    console.log(`[BOT] SHER LOCK PRO Online as ${client.user.tag}`);
    client.user.setActivity('Protecting Servers 🛡️', { type: ActivityType.Watching });
});

// Interaction Handler (Tickets)
client.on('interactionCreate', async (interaction) => {
    if (!interaction.guildId) return;
    const s = getGuildSettings(interaction.guildId);

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
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
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

    if (interaction.isButton()) {
        if (interaction.customId === 'claim_ticket') {
            return interaction.reply({ content: `🙋 Ticket claimed by <@${interaction.user.id}>` });
        }
        if (interaction.customId === 'close_ticket') {
            await interaction.channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: false });
            return interaction.reply({ content: "🔒 Ticket closed. Admin can delete this channel." });
        }
    }
});

// Auto-Mod & Commands
client.on('messageCreate', async (msg) => {
    if (!msg.guild) return;
    const s = getGuildSettings(msg.guild.id);
    
    // Check Ignore Bot Setting
    if (msg.author.bot && s.ignoreBots) return;

    const isAuthorized = msg.member.permissions.has(PermissionFlagsBits.Administrator) || (s.modRoleId && msg.member.roles.cache.has(s.modRoleId));

    // Manual Password DM
    if (msg.content === '!setup-pass' && msg.member.permissions.has(PermissionFlagsBits.Administrator)) {
        const pass = serverPasswords.get(msg.guild.id);
        if (pass) {
            msg.author.send(`🛡️ Password for **${msg.guild.name}**: \`${pass}\``).catch(() => msg.reply("Check DMs!"));
        } else {
            msg.reply("No password configured for this ID in environment variables.");
        }
    }

    // Setup Ticket Panel
    if (msg.content === '!setup-tickets' && isAuthorized) {
        const embed = new EmbedBuilder()
            .setTitle(s.panelTitle)
            .setDescription(s.panelDesc)
            .setColor(s.panelColor || '#3b82f6');
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

    // Check Ignore Thread Setting
    if (msg.channel.isThread() && s.ignoreThreads) return;

    if (s.antiLink && msg.content.match(/https?:\/\/[^\s]+/)) shouldDelete = true;
    if (s.blacklist.some(word => msg.content.toLowerCase().includes(word.toLowerCase()))) shouldDelete = true;
    if (s.autoDeleteChannels.includes(msg.channel.id)) shouldDelete = true;

    if (shouldDelete) {
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
        body { background: #0f172a; color: #f8fafc; font-family: sans-serif; padding: 20px; display: flex; justify-content: center; margin:0;}
        .card { background: #1e293b; padding: 25px; border-radius: 12px; width: 100%; max-width: 800px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .tabs { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid #334155; padding-bottom: 10px; overflow-x: auto;}
        .tab { color: #94a3b8; text-decoration: none; padding: 8px 15px; border-radius: 5px; font-weight: bold; white-space: nowrap;}
        .tab.active { background: #3b82f6; color: white; }
        .section { background: #1a2233; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #3b82f6; }
        input, textarea { width: 100%; padding: 10px; margin: 8px 0; background: #0f172a; color: white; border: 1px solid #334155; border-radius: 5px; box-sizing: border-box; }
        .btn { background: #3b82f6; color: white; border: none; padding: 12px; border-radius: 5px; cursor: pointer; width: 100%; font-weight: bold; }
        .opt-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 10px; }
        label { font-size: 0.8em; color: #94a3b8; text-transform: uppercase; }
        .toggle-group { display: flex; flex-wrap: wrap; gap: 20px; margin: 15px 0; }
        .toggle-item { display: flex; align-items: center; gap: 8px; font-size: 0.9em; cursor: pointer; }
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

app.get('/', (req, res) => {
    res.send(`<body style="background:#0f172a; color:white; font-family:sans-serif; display:flex; justify-content:center; align-items:center; height:100vh;">
        <form action="/login" method="POST" style="background:#1e293b; padding:30px; border-radius:10px; width:300px;">
            <h2 style="text-align:center">🛡️ SHER LOCK PRO</h2>
            <input name="gid" placeholder="Server ID" style="width:100%; padding:10px; margin-bottom:10px; border-radius:5px; border:none;">
            <input name="pass" type="password" placeholder="Dashboard Password" style="width:100%; padding:10px; margin-bottom:10px; border-radius:5px; border:none;">
            <button style="width:100%; padding:10px; background:#3b82f6; color:white; border:none; border-radius:5px; cursor:pointer;">Login</button>
        </form>
    </body>`);
});

app.post('/login', (req, res) => { 
    if(serverPasswords.get(req.body.gid) === req.body.pass) { 
        req.session.gid = req.body.gid; 
        res.redirect('/dashboard'); 
    } else res.send("Access Denied."); 
});

app.get('/dashboard', (req, res) => {
    const gid = req.session.gid;
    const s = getGuildSettings(gid);
    const guild = client.guilds.cache.get(gid);
    if(!guild) return res.redirect('/');
    res.send(UI(`
        <h2>Moderation & Protection</h2>
        <form action="/save-mod" method="POST">
            <div class="section">
                <label>Global Exclusions</label>
                <div class="toggle-group">
                    <label class="toggle-item">
                        <input type="checkbox" name="ignoreBots" ${s.ignoreBots?'checked':''} style="width:auto"> Ignore Bots
                    </label>
                    <label class="toggle-item">
                        <input type="checkbox" name="ignoreThreads" ${s.ignoreThreads?'checked':''} style="width:auto"> Ignore Threads
                    </label>
                    <label class="toggle-item">
                        <input type="checkbox" name="antiLink" ${s.antiLink?'checked':''} style="width:auto"> Anti-Link
                    </label>
                </div>
            </div>

            <div class="section">
                <label>Auto-Delete Channels</label>
                <div style="max-height: 150px; overflow-y: auto; margin-top: 10px; background: #0f172a; padding: 10px; border-radius: 5px;">
                    ${guild.channels.cache.filter(c => c.type === ChannelType.GuildText).map(c => `
                        <label style="display:block; color:white; text-transform:none; margin: 5px 0; cursor: pointer;">
                            <input type="checkbox" name="chans" value="${c.id}" ${s.autoDeleteChannels.includes(c.id)?'checked':''} style="width:auto"> #${c.name}
                        </label>
                    `).join('')}
                </div>
            </div>

            <div class="section">
                <label>Blacklist Words (Comma separated)</label>
                <textarea name="words" placeholder="badword1, badword2">${s.blacklist.join(', ')}</textarea>
                <label>Deletion Delay (ms)</label>
                <input type="number" name="delay" value="${s.deleteDelay}">
            </div>
            <button class="btn">Update Protection</button>
        </form>
    `, 'main'));
});

app.get('/tickets', (req, res) => {
    const s = getGuildSettings(req.session.gid);
    res.send(UI(`
        <h2>Ticket System & Panel Editor</h2>
        <form action="/save-tickets" method="POST">
            <div class="section">
                <label>Category ID (Where tickets open)</label><input name="catId" value="${s.ticketCategoryId}">
                <label>Support Role ID (Who can see tickets)</label><input name="supportRole" value="${s.supportRoleId}">
            </div>
            <div class="section">
                <label>Embed Customization</label>
                <input name="pTitle" value="${s.panelTitle}" placeholder="Panel Title">
                <textarea name="pDesc" placeholder="Panel Description">${s.panelDesc}</textarea>
                <input name="pImage" value="${s.panelImage}" placeholder="Banner Image URL">
            </div>
            <div class="section">
                <label>Ticket Buttons (Add up to 5)</label>
                <div id="btn-list" style="margin-top:10px;">
                    ${s.customOptions.map((o, i) => `
                        <div class="opt-row">
                            <input name="labels[]" value="${o.label}" placeholder="Label">
                            <input name="emojis[]" value="${o.emoji}" placeholder="Emoji">
                            <input name="ids[]" value="${o.id}" placeholder="open_xxx">
                        </div>
                    `).join('')}
                    ${Array(Math.max(0, 5 - s.customOptions.length)).fill(0).map(() => `
                        <div class="opt-row">
                            <input name="labels[]" placeholder="Label">
                            <input name="emojis[]" placeholder="Emoji">
                            <input name="ids[]" placeholder="open_xxx">
                        </div>
                    `).join('')}
                </div>
            </div>
            <button class="btn" style="background:#10b981;">Save & Apply Visuals</button>
        </form>
    `, 'tickets'));
});

app.post('/save-mod', (req, res) => {
    const s = getGuildSettings(req.session.gid);
    s.autoDeleteChannels = Array.isArray(req.body.chans) ? req.body.chans : (req.body.chans ? [req.body.chans] : []);
    s.blacklist = req.body.words.split(',').map(w => w.trim()).filter(w => w);
    s.deleteDelay = parseInt(req.body.delay) || 1200;
    s.antiLink = req.body.antiLink === 'on';
    s.ignoreBots = req.body.ignoreBots === 'on';
    s.ignoreThreads = req.body.ignoreThreads === 'on';
    res.redirect('/dashboard');
});

app.post('/save-tickets', (req, res) => {
    const s = getGuildSettings(req.session.gid);
    s.ticketCategoryId = req.body.catId;
    s.supportRoleId = req.body.supportRole;
    s.panelTitle = req.body.pTitle;
    s.panelDesc = req.body.pDesc;
    s.panelImage = req.body.pImage;
    
    const labels = req.body['labels[]'];
    const emojis = req.body['emojis[]'];
    const ids = req.body['ids[]'];
    
    if(labels) {
        s.customOptions = labels
            .map((l, i) => ({ label: l, emoji: emojis[i], id: ids[i] }))
            .filter(o => o.label && o.id);
    }
    res.redirect('/tickets');
});

app.listen(CONFIG.PORT, () => console.log("SHER LOCK ULTIMATE LIVE"));
