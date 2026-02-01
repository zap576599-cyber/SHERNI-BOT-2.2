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
    SESSION_SECRET: process.env.SESSION_SECRET || 'sher-lock-ultimate-preview'
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
            ticketCategoryId: "",
            supportRoleId: "",
            ticketMessage: "Welcome to support! How can we help you?",
            panelTitle: "🛡️ SHER LOCK SUPPORT",
            panelDesc: "Click a button below to open a ticket.",
            panelImage: "",
            panelColor: "#3b82f6",
            uiType: "buttons", // "buttons" or "dropdown"
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
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
});

client.on('guildCreate', async (guild) => {
    const owner = await guild.fetchOwner();
    const pass = serverPasswords.get(guild.id);
    if (pass && owner) owner.send(`🛡️ **SHER LOCK PRO Setup**\nYour password for **${guild.name}** is: \`${pass}\``).catch(() => {});
});

client.once('ready', () => {
    console.log(`[BOT] SHER LOCK PRO Online as ${client.user.tag}`);
    client.user.setActivity('Protecting Servers 🛡️', { type: ActivityType.Watching });
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.guildId) return;
    const s = getGuildSettings(interaction.guildId);

    const isOpening = (interaction.isButton() && interaction.customId.startsWith('open_')) || 
                      (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select');

    if (isOpening) {
        const type = interaction.isStringSelectMenu() ? interaction.values[0] : interaction.customId;
        if (!s.ticketCategoryId) return interaction.reply({ content: "Ticket category not set!", ephemeral: true });

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

    if (interaction.isButton()) {
        if (interaction.customId === 'claim_ticket') return interaction.reply({ content: `🙋 Claimed by <@${interaction.user.id}>` });
        if (interaction.customId === 'close_ticket') {
            await interaction.channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: false });
            return interaction.reply({ content: "🔒 Closed." });
        }
    }
});

client.on('messageCreate', async (msg) => {
    if (!msg.guild) return;
    const s = getGuildSettings(msg.guild.id);
    if (msg.author.bot && s.ignoreBots) return;

    const isAuthorized = msg.member.permissions.has(PermissionFlagsBits.Administrator) || (s.modRoleId && msg.member.roles.cache.has(s.modRoleId));

    if (msg.content === '!setup-tickets' && isAuthorized) {
        const embed = new EmbedBuilder().setTitle(s.panelTitle).setDescription(s.panelDesc).setColor(s.panelColor || '#3b82f6');
        if (s.panelImage) embed.setImage(s.panelImage);
        
        const row = new ActionRowBuilder();
        if (s.uiType === 'dropdown') {
            const menu = new StringSelectMenuBuilder().setCustomId('ticket_select').setPlaceholder('Select a ticket type...');
            s.customOptions.forEach(opt => menu.addOptions(new StringSelectMenuOptionBuilder().setLabel(opt.label).setValue(opt.id).setEmoji(opt.emoji)));
            row.addComponents(menu);
        } else {
            s.customOptions.forEach(opt => row.addComponents(new ButtonBuilder().setCustomId(opt.id).setLabel(opt.label).setEmoji(opt.emoji).setStyle(ButtonStyle.Secondary)));
        }

        await msg.channel.send({ embeds: [embed], components: [row] });
        return msg.delete().catch(()=>{});
    }

    let shouldDelete = false;
    if (msg.channel.isThread() && s.ignoreThreads) return;
    if (s.antiLink && msg.content.match(/https?:\/\/[^\s]+/)) shouldDelete = true;
    if (s.blacklist.some(word => msg.content.toLowerCase().includes(word.toLowerCase()))) shouldDelete = true;
    if (s.autoDeleteChannels.includes(msg.channel.id)) shouldDelete = true;

    if (shouldDelete) setTimeout(() => msg.delete().catch(()=>{}), s.deleteDelay);
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
        .card { background: #1e293b; padding: 25px; border-radius: 12px; width: 100%; max-width: 900px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .tabs { display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 1px solid #334155; padding-bottom: 10px; overflow-x: auto;}
        .tab { color: #94a3b8; text-decoration: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; white-space: nowrap; transition: 0.2s;}
        .tab.active { background: #3b82f6; color: white; }
        .section { background: #1a2233; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #3b82f6; }
        input, textarea, select { width: 100%; padding: 12px; margin: 8px 0; background: #0f172a; color: white; border: 1px solid #334155; border-radius: 6px; box-sizing: border-box; }
        .btn { background: #3b82f6; color: white; border: none; padding: 14px; border-radius: 6px; cursor: pointer; width: 100%; font-weight: bold; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .toggle-group { display: flex; flex-wrap: wrap; gap: 15px; margin: 10px 0; }
        label { font-size: 0.8em; color: #94a3b8; text-transform: uppercase; font-weight: bold; }
        /* Discord Preview Styling */
        .discord-preview { background: #313338; border-radius: 8px; padding: 15px; margin-top: 10px; border: 1px solid #1e1f22; }
        .discord-embed { border-left: 4px solid #3b82f6; background: #2b2d31; padding: 12px; border-radius: 4px; margin-bottom: 10px; }
        .discord-btn { background: #4e5058; color: white; padding: 6px 16px; border-radius: 3px; font-size: 0.9em; display: inline-block; margin-right: 8px; margin-top: 8px; }
        .discord-select { background: #1e1f22; color: #dbdee1; padding: 10px; border-radius: 4px; margin-top: 10px; border: 1px solid #1e1f22; width: 100%; }
        @media (max-width: 600px) { .grid { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <div class="card">
        <h2 style="margin-top:0; color:#3b82f6;">🛡️ SHER LOCK PRO</h2>
        <div class="tabs">
            <a href="/dashboard" class="tab ${activeTab==='main'?'active':''}">🛡️ Main Settings</a>
            <a href="/moderation" class="tab ${activeTab==='mod'?'active':''}">⚔️ Moderation</a>
            <a href="/tickets" class="tab ${activeTab==='tickets'?'active':''}">🎫 Ticket System</a>
            <a href="/preview" class="tab ${activeTab==='preview'?'active':''}">👀 Live Preview</a>
        </div>
        ${content}
    </div>
</body>
</html>
`;

app.get('/', (req, res) => {
    res.send(`<body style="background:#0f172a; display:flex; justify-content:center; align-items:center; height:100vh; margin:0;">
        <form action="/login" method="POST" style="background:#1e293b; padding:40px; border-radius:15px; width:320px;">
            <h2 style="text-align:center; color:#3b82f6; font-family:sans-serif;">SHER LOCK</h2>
            <input name="gid" placeholder="Server ID" style="width:100%; padding:12px; margin-bottom:15px; border-radius:8px; border:none; background:#0f172a; color:white;">
            <input name="pass" type="password" placeholder="Password" style="width:100%; padding:12px; margin-bottom:20px; border-radius:8px; border:none; background:#0f172a; color:white;">
            <button style="width:100%; padding:14px; background:#3b82f6; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">LOGIN</button>
        </form>
    </body>`);
});

app.post('/login', (req, res) => { 
    if(serverPasswords.get(req.body.gid) === req.body.pass) { req.session.gid = req.body.gid; res.redirect('/dashboard'); } 
    else res.send("Access Denied."); 
});

app.get('/dashboard', (req, res) => {
    const s = getGuildSettings(req.session.gid);
    if(!req.session.gid) return res.redirect('/');
    res.send(UI(`
        <form action="/save-main" method="POST">
            <div class="section">
                <label>Custom Bot Nickname</label><input name="nickname" value="${s.customNickname}">
                <div class="grid">
                    <div><label>Mod Role ID</label><input name="modRole" value="${s.modRoleId}"></div>
                    <div><label>Log Channel ID</label><input name="logChan" value="${s.logChannelId}"></div>
                </div>
            </div>
            <button class="btn">Save Main Settings</button>
        </form>
    `, 'main'));
});

app.get('/moderation', (req, res) => {
    const gid = req.session.gid;
    const s = getGuildSettings(gid);
    const guild = client.guilds.cache.get(gid);
    if(!guild) return res.redirect('/');
    res.send(UI(`
        <form action="/save-mod" method="POST">
            <div class="section">
                <label>Global Toggles</label>
                <div class="toggle-group">
                    <label><input type="checkbox" name="ignoreBots" ${s.ignoreBots?'checked':''} style="width:auto"> Ignore Bots</label>
                    <label><input type="checkbox" name="ignoreThreads" ${s.ignoreThreads?'checked':''} style="width:auto"> Ignore Threads</label>
                    <label><input type="checkbox" name="antiLink" ${s.antiLink?'checked':''} style="width:auto"> Anti-Link</label>
                </div>
            </div>
            <div class="section">
                <label>Auto-Delete Channels</label>
                <div style="max-height: 180px; overflow-y: auto; background: #0f172a; padding: 12px; border-radius: 8px; margin-top:10px;">
                    ${guild.channels.cache.filter(c => c.type === ChannelType.GuildText).map(c => `
                        <label style="display:block; color:white; text-transform:none; margin: 8px 0; cursor:pointer;">
                            <input type="checkbox" name="chans" value="${c.id}" ${s.autoDeleteChannels.includes(c.id)?'checked':''} style="width:auto"> #${c.name}
                        </label>
                    `).join('')}
                </div>
            </div>
            <div class="section">
                <label>Word Blacklist</label><textarea name="words">${s.blacklist.join(', ')}</textarea>
                <label>Deletion Delay (ms)</label><input type="number" name="delay" value="${s.deleteDelay}">
            </div>
            <button class="btn">Update Protection</button>
        </form>
    `, 'mod'));
});

app.get('/tickets', (req, res) => {
    const s = getGuildSettings(req.session.gid);
    res.send(UI(`
        <form action="/save-tickets" method="POST">
            <div class="section">
                <label>Interaction Style</label>
                <select name="uiType">
                    <option value="buttons" ${s.uiType==='buttons'?'selected':''}>Buttons (Individual)</option>
                    <option value="dropdown" ${s.uiType==='dropdown'?'selected':''}>Dropdown Menu (Single Row)</option>
                </select>
            </div>
            <div class="section">
                <label>Configuration</label>
                <div class="grid">
                    <div><label>Category ID</label><input name="catId" value="${s.ticketCategoryId}"></div>
                    <div><label>Support Role ID</label><input name="supportRole" value="${s.supportRoleId}"></div>
                </div>
            </div>
            <div class="section">
                <label>Panel Designer</label>
                <input name="pTitle" value="${s.panelTitle}" placeholder="Panel Title">
                <textarea name="pDesc" placeholder="Panel Description">${s.panelDesc}</textarea>
                <input name="pImage" value="${s.panelImage}" placeholder="Banner Image URL (Optional)">
            </div>
            <div class="section">
                <label>Ticket Options (Max 5)</label>
                ${s.customOptions.map(o => `
                    <div class="grid" style="margin-bottom:10px;">
                        <input name="labels[]" value="${o.label}" placeholder="Label">
                        <input name="ids[]" value="${o.id}" placeholder="open_xxx">
                        <input name="emojis[]" value="${o.emoji}" placeholder="Emoji">
                    </div>
                `).join('')}
                ${Array(Math.max(0, 5 - s.customOptions.length)).fill(0).map(() => `
                    <div class="grid" style="margin-bottom:10px;">
                        <input name="labels[]" placeholder="New Label">
                        <input name="ids[]" placeholder="open_new">
                        <input name="emojis[]" placeholder="Emoji">
                    </div>
                `).join('')}
            </div>
            <button class="btn" style="background:#10b981;">Save Ticket Settings</button>
        </form>
    `, 'tickets'));
});

app.get('/preview', (req, res) => {
    const s = getGuildSettings(req.session.gid);
    res.send(UI(`
        <h2>Live Preview & Status</h2>
        <p style="color:#94a3b8; margin-bottom:20px;">This is how your current settings will appear in Discord.</p>
        
        <label>Active Ticket Panel Preview</label>
        <div class="discord-preview">
            <div class="discord-embed" style="border-left-color: ${s.panelColor}">
                <div style="font-weight:bold; margin-bottom:5px;">${s.panelTitle}</div>
                <div style="font-size:0.9em; color:#dbdee1;">${s.panelDesc}</div>
                ${s.panelImage ? `<img src="${s.panelImage}" style="width:100%; border-radius:4px; margin-top:10px;">` : ''}
            </div>
            
            ${s.uiType === 'buttons' ? 
                s.customOptions.map(o => `<div class="discord-btn">${o.emoji} ${o.label}</div>`).join('') :
                `<div class="discord-select">Select a ticket type... <span style="float:right;">▼</span></div>`
            }
        </div>

        <div class="section" style="margin-top:25px;">
            <label>Moderation Status</label>
            <ul style="list-style:none; padding:0; font-size:0.9em;">
                <li>✅ Auto-Delete: <b>${s.autoDeleteChannels.length} channels</b></li>
                <li>🛡️ Anti-Link: <b>${s.antiLink ? 'ENABLED' : 'DISABLED'}</b></li>
                <li>🤖 Ignore Bots: <b>${s.ignoreBots ? 'YES' : 'NO'}</b></li>
                <li>🧵 Ignore Threads: <b>${s.ignoreThreads ? 'YES' : 'NO'}</b></li>
                <li>⏳ Deletion Delay: <b>${s.deleteDelay}ms</b></li>
            </ul>
        </div>
    `, 'preview'));
});

app.post('/save-main', (req, res) => {
    const s = getGuildSettings(req.session.gid);
    s.customNickname = req.body.nickname;
    s.modRoleId = req.body.modRole;
    s.logChannelId = req.body.logChan;
    res.redirect('/dashboard');
});

app.post('/save-mod', (req, res) => {
    const s = getGuildSettings(req.session.gid);
    s.autoDeleteChannels = Array.isArray(req.body.chans) ? req.body.chans : (req.body.chans ? [req.body.chans] : []);
    s.blacklist = req.body.words.split(',').map(w => w.trim()).filter(w => w);
    s.deleteDelay = parseInt(req.body.delay) || 1200;
    s.antiLink = req.body.antiLink === 'on';
    s.ignoreBots = req.body.ignoreBots === 'on';
    s.ignoreThreads = req.body.ignoreThreads === 'on';
    res.redirect('/moderation');
});

app.post('/save-tickets', (req, res) => {
    const s = getGuildSettings(req.session.gid);
    s.uiType = req.body.uiType;
    s.ticketCategoryId = req.body.catId;
    s.supportRoleId = req.body.supportRole;
    s.panelTitle = req.body.pTitle;
    s.panelDesc = req.body.pDesc;
    s.panelImage = req.body.pImage;
    const l = req.body['labels[]'];
    const i = req.body['ids[]'];
    const e = req.body['emojis[]'];
    if(l) s.customOptions = l.map((label, idx) => ({ label, id: i[idx], emoji: e[idx] || '🎫' })).filter(o => o.label && o.id);
    res.redirect('/tickets');
});

app.listen(CONFIG.PORT, () => console.log("SHER LOCK PRO LIVE"));
