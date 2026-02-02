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
    SESSION_SECRET: process.env.SESSION_SECRET || 'sher-lock-ultimate-ref'
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
            panelDesc: "Select an option below to get help.",
            panelImage: "",
            panelColor: "#3b82f6",
            uiType: "buttons",
            targetPanelChannel: "",
            customOptions: [
                { id: 'open_ticket', label: 'General Support', emoji: '🎫' }
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

client.once('ready', () => {
    console.log(`[BOT] Online: ${client.user.tag}`);
    client.user.setActivity('Sapphire-Grade Protection 🛡️', { type: ActivityType.Watching });
});

client.on('messageCreate', async (msg) => {
    if (!msg.guild || msg.author.bot) return;
    const s = getGuildSettings(msg.guild.id);
    const isMod = msg.member.permissions.has(PermissionFlagsBits.Administrator) || (s.modRoleId && msg.member.roles.cache.has(s.modRoleId));

    // --- PREFIX COMMANDS (Updated to / prefix) ---
    
    // COMMAND: /getpass
    if (msg.content === '/getpass' && msg.member.permissions.has(PermissionFlagsBits.Administrator)) {
        const pass = serverPasswords.get(msg.guild.id);
        return msg.reply(pass ? `Dashboard Password: \`${pass}\`` : "No password set in environment.");
    }

    // COMMAND: /ban @user reason
    if (msg.content.startsWith('/ban') && isMod) {
        const target = msg.mentions.members.first();
        if (!target) return msg.reply("Mention a user to ban.");
        try {
            await target.ban({ reason: msg.content.split(' ').slice(2).join(' ') || "No reason provided." });
            msg.reply(`✅ Banned **${target.user.tag}**`);
        } catch (e) { msg.reply("Error banning user. Check bot permissions."); }
    }

    // COMMAND: /tempmute @user duration(m) reason
    if (msg.content.startsWith('/tempmute') && isMod) {
        const args = msg.content.split(' ');
        const target = msg.mentions.members.first();
        const duration = parseInt(args[2]);
        if (!target || isNaN(duration)) return msg.reply("Usage: `/tempmute @user [minutes] [reason]`");
        try {
            await target.timeout(duration * 60 * 1000, args.slice(3).join(' ') || "No reason provided.");
            msg.reply(`⏳ Muted **${target.user.tag}** for ${duration}m`);
        } catch (e) { msg.reply("Error muting user."); }
    }

    // --- MODERATION LOGIC ---
    if (msg.channel.isThread() && s.ignoreThreads) return;
    if (s.ignoreBots && msg.author.bot) return;

    let shouldDelete = false;
    if (s.antiLink && msg.content.match(/https?:\/\/[^\s]+/)) shouldDelete = true;
    if (s.blacklist.some(word => msg.content.toLowerCase().includes(word.toLowerCase()))) shouldDelete = true;
    if (s.autoDeleteChannels.includes(msg.channel.id)) shouldDelete = true;

    // Execute deletion if triggered and user isn't a mod
    if (shouldDelete && !isMod) {
        setTimeout(() => msg.delete().catch(()=>{}), s.deleteDelay);
    }
});

// Interaction handler for tickets...
client.on('interactionCreate', async (interaction) => {
    if (!interaction.guildId) return;
    const s = getGuildSettings(interaction.guildId);

    if ((interaction.isButton() && interaction.customId.startsWith('open_')) || (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select')) {
        const type = interaction.values ? interaction.values[0] : interaction.customId;
        
        try {
            const channel = await interaction.guild.channels.create({
                name: `${type.replace('open_', '')}-${interaction.user.username}`,
                type: ChannelType.GuildText,
                parent: s.ticketCategoryId || null,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                    { id: s.supportRoleId || interaction.guild.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ]
            });

            const welcomeEmbed = new EmbedBuilder()
                .setTitle(`Ticket: ${type.replace('open_', '').toUpperCase()}`)
                .setDescription(s.ticketMessage)
                .setColor(s.panelColor);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger)
            );

            await channel.send({ content: `<@${interaction.user.id}> <@&${s.supportRoleId || ''}>`, embeds: [welcomeEmbed], components: [row] });
            return interaction.reply({ content: `Ticket created: ${channel}`, ephemeral: true });
        } catch (e) {
            console.error(e);
            return interaction.reply({ content: "Failed to create ticket. Check category/permissions.", ephemeral: true });
        }
    }

    if (interaction.isButton() && interaction.customId === 'close_ticket') {
        await interaction.reply("Closing ticket in 5 seconds...");
        setTimeout(() => interaction.channel.delete().catch(()=>{}), 5000);
    }
});

client.login(CONFIG.TOKEN);

// --- WEB INTERFACE ---
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ keys: [CONFIG.SESSION_SECRET], maxAge: 24 * 60 * 60 * 1000 }));

const UI = (content, activeTab = 'main', guildId) => {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { background: #0f172a; color: #f8fafc; font-family: sans-serif; margin:0; padding: 20px; display:flex; justify-content:center;}
        .card { background: #1e293b; padding: 25px; border-radius: 12px; width: 100%; max-width: 900px; position:relative;}
        .tabs { display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 1px solid #334155; padding-bottom: 10px; }
        .tab { color: #94a3b8; text-decoration: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; }
        .tab.active { background: #3b82f6; color: white; }
        .section { background: #1a2233; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #3b82f6; }
        input, textarea, select { width: 100%; padding: 12px; margin: 8px 0; background: #0f172a; color: white; border: 1px solid #334155; border-radius: 6px; box-sizing: border-box; }
        .btn { background: #3b82f6; color: white; border: none; padding: 14px; border-radius: 6px; cursor: pointer; width: 100%; font-weight: bold; }
        
        /* Unsaved Changes Bar */
        #unsaved-bar { 
            position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
            background: #1e293b; border: 1px solid #334155; padding: 15px 30px; 
            border-radius: 10px; display: none; align-items: center; gap: 20px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.8); z-index: 9999;
        }
        .shake { animation: shake 0.3s cubic-bezier(.36,.07,.19,.97) both; background: #991b1b !important; }
        @keyframes shake {
            10%, 90% { transform: translate3d(-51%, 0, 0); }
            20%, 80% { transform: translate3d(-48%, 0, 0); }
            30%, 50%, 70% { transform: translate3d(-54%, 0, 0); }
            40%, 60% { transform: translate3d(-46%, 0, 0); }
        }

        .btn-add { background: #10b981; margin-bottom: 10px; width: auto; padding: 8px 15px; }
        .btn-del { background: #ef4444; width: auto; padding: 8px; }
        .opt-row { display: grid; grid-template-columns: 1fr 1fr 1fr 40px; gap: 10px; margin-bottom: 5px; align-items: center; }
        
        .overlay { position:fixed; top:0; left:0; width:100%; height:100%; background:transparent; z-index:9998; display:none;}
    </style>
</head>
<body>
    <div id="block-overlay" class="overlay"></div>
    <div class="card">
        <div class="tabs">
            <a href="/dashboard" class="tab ${activeTab==='main'?'active':''}">🛡️ Main</a>
            <a href="/moderation" class="tab ${activeTab==='mod'?'active':''}">⚔️ Mod</a>
            <a href="/tickets" class="tab ${activeTab==='tickets'?'active':''}">🎫 Tickets</a>
        </div>
        ${content}
    </div>

    <div id="unsaved-bar">
        <span>Careful — you have unsaved changes!</span>
        <div style="display:flex; gap:10px;">
            <button onclick="location.reload()" style="background:transparent; color:white; border:none; cursor:pointer;">Reset</button>
            <button onclick="document.querySelector('form').submit()" style="background:#10b981; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer;">Save Changes</button>
        </div>
    </div>

    <script>
        let changed = false;
        const bar = document.getElementById('unsaved-bar');
        const overlay = document.getElementById('block-overlay');

        function markChanged() {
            changed = true;
            bar.style.display = 'flex';
        }

        document.querySelectorAll('input, textarea, select').forEach(el => {
            el.addEventListener('change', markChanged);
            el.addEventListener('input', markChanged);
        });

        document.querySelectorAll('a.tab').forEach(a => {
            a.addEventListener('click', (e) => {
                if(changed) {
                    e.preventDefault();
                    bar.classList.add('shake');
                    overlay.style.display = 'block';
                    setTimeout(() => { 
                        bar.classList.remove('shake');
                        overlay.style.display = 'none';
                    }, 400);
                }
            });
        });

        function addTicketOption() {
            const container = document.getElementById('ticket-opts');
            const div = document.createElement('div');
            div.className = 'opt-row';
            div.innerHTML = \`
                <input name="labels[]" placeholder="Label">
                <input name="ids[]" placeholder="open_xxx">
                <input name="emojis[]" placeholder="Emoji">
                <button type="button" class="btn btn-del" onclick="this.parentElement.remove(); markChanged();">✕</button>
            \`;
            container.appendChild(div);
            markChanged();
        }
    </script>
</body>
</html>
`;
};

app.get('/', (req, res) => {
    res.send(`<body style="background:#0f172a; display:flex; justify-content:center; align-items:center; height:100vh; margin:0;">
        <form action="/login" method="POST" style="background:#1e293b; padding:40px; border-radius:15px; width:320px;">
            <h2 style="text-align:center; color:#3b82f6; font-family:sans-serif;">SHER LOCK</h2>
            <input name="gid" placeholder="Server ID" required style="width:100%; padding:12px; margin-bottom:15px; border-radius:8px; border:none; background:#0f172a; color:white;">
            <input name="pass" type="password" placeholder="Password" required style="width:100%; padding:12px; margin-bottom:20px; border-radius:8px; border:none; background:#0f172a; color:white;">
            <button style="width:100%; padding:14px; background:#3b82f6; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">LOGIN</button>
        </form>
    </body>`);
});

app.post('/login', (req, res) => { 
    if(serverPasswords.get(req.body.gid) === req.body.pass) { req.session.gid = req.body.gid; res.redirect('/dashboard'); } 
    else res.send("Invalid Credentials."); 
});

app.get('/dashboard', (req, res) => {
    const gid = req.session.gid; if(!gid) return res.redirect('/');
    const s = getGuildSettings(gid);
    res.send(UI(`
        <form action="/save-main" method="POST">
            <div class="section">
                <label>Bot Nickname</label><input name="nickname" value="${s.customNickname}">
                <label>Mod Role ID</label><input name="modRole" value="${s.modRoleId}">
                <label>Log Channel ID</label><input name="logChan" value="${s.logChannelId}">
            </div>
            <button class="btn">Save Changes</button>
        </form>
    `, 'main', gid));
});

app.get('/moderation', (req, res) => {
    const gid = req.session.gid; if(!gid) return res.redirect('/');
    const s = getGuildSettings(gid);
    res.send(UI(`
        <form action="/save-mod" method="POST">
            <div class="section">
                <label><input type="checkbox" name="ignoreBots" ${s.ignoreBots?'checked':''} style="width:auto"> Ignore Bots</label><br>
                <label><input type="checkbox" name="ignoreThreads" ${s.ignoreThreads?'checked':''} style="width:auto"> Ignore Threads</label><br>
                <label><input type="checkbox" name="antiLink" ${s.antiLink?'checked':''} style="width:auto"> Anti-Link</label>
            </div>
            <div class="section">
                <label>Blacklist (comma separated)</label><textarea name="words">${s.blacklist.join(', ')}</textarea>
                <label>Deletion Delay (ms)</label><input type="number" name="delay" value="${s.deleteDelay}">
            </div>
            <button class="btn">Save Changes</button>
        </form>
    `, 'mod', gid));
});

app.get('/tickets', (req, res) => {
    const gid = req.session.gid; if(!gid) return res.redirect('/');
    const s = getGuildSettings(gid);
    const guild = client.guilds.cache.get(gid);
    const channels = guild ? guild.channels.cache.filter(c => c.type === ChannelType.GuildText) : [];

    res.send(UI(`
        <form action="/save-tickets" method="POST">
            <div class="section">
                <label>Target Channel (Auto-Post Panel)</label>
                <select name="targetChan">
                    <option value="">-- Manual !setup only --</option>
                    ${channels.map(c => `<option value="${c.id}" ${s.targetPanelChannel===c.id?'selected':''}>#${c.name}</option>`).join('')}
                </select>
                <label>Ticket Category ID</label><input name="catId" value="${s.ticketCategoryId}">
                <label>Support Role ID</label><input name="supportRole" value="${s.supportRoleId}">
                <label>Ticket Greeting</label><textarea name="tMsg">${s.ticketMessage}</textarea>
            </div>
            
            <div class="section">
                <label>UI Style</label>
                <select name="uiType">
                    <option value="buttons" ${s.uiType==='buttons'?'selected':''}>Buttons</option>
                    <option value="dropdown" ${s.uiType==='dropdown'?'selected':''}>Dropdown Menu</option>
                </select>
                <label>Panel Title</label><input name="pTitle" value="${s.panelTitle}">
                <label>Panel Description</label><textarea name="pDesc">${s.panelDesc}</textarea>
            </div>

            <div class="section">
                <label>Interactive Elements</label>
                <div id="ticket-opts">
                    ${s.customOptions.map(o => `
                        <div class="opt-row">
                            <input name="labels[]" value="${o.label}" placeholder="Label">
                            <input name="ids[]" value="${o.id}" placeholder="open_xxx">
                            <input name="emojis[]" value="${o.emoji}" placeholder="Emoji">
                            <button type="button" class="btn btn-del" onclick="this.parentElement.remove(); markChanged();">✕</button>
                        </div>
                    `).join('')}
                </div>
                <button type="button" class="btn btn-add" onclick="addTicketOption()">+ Add Element</button>
            </div>
            <button class="btn" style="background:#10b981;">Save Changes</button>
        </form>
    `, 'tickets', gid));
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
    s.ignoreBots = req.body.ignoreBots === 'on';
    s.ignoreThreads = req.body.ignoreThreads === 'on';
    s.antiLink = req.body.antiLink === 'on';
    s.blacklist = req.body.words.split(',').map(w => w.trim()).filter(w => w);
    s.deleteDelay = parseInt(req.body.delay) || 1200;
    res.redirect('/moderation');
});

app.post('/save-tickets', async (req, res) => {
    const gid = req.session.gid;
    const s = getGuildSettings(gid);
    s.targetPanelChannel = req.body.targetChan;
    s.ticketCategoryId = req.body.catId;
    s.supportRoleId = req.body.supportRole;
    s.uiType = req.body.uiType;
    s.panelTitle = req.body.pTitle;
    s.panelDesc = req.body.pDesc;
    s.ticketMessage = req.body.tMsg;
    
    const l = req.body['labels[]'];
    const i = req.body['ids[]'];
    const e = req.body['emojis[]'];
    
    if(l) {
        const labels = Array.isArray(l) ? l : [l];
        const ids = Array.isArray(i) ? i : [i];
        const emojis = Array.isArray(e) ? e : [e];
        s.customOptions = labels.map((label, idx) => ({ 
            label, 
            id: ids[idx], 
            emoji: emojis[idx] || '🎫' 
        })).filter(o => o.label && o.id);
    } else {
        s.customOptions = [];
    }

    // Auto-deploy
    if (s.targetPanelChannel) {
        const guild = client.guilds.cache.get(gid);
        const chan = guild?.channels.cache.get(s.targetPanelChannel);
        if (chan) {
            const embed = new EmbedBuilder().setTitle(s.panelTitle).setDescription(s.panelDesc).setColor(s.panelColor);
            const row = new ActionRowBuilder();
            if (s.uiType === 'dropdown' && s.customOptions.length > 0) {
                const menu = new StringSelectMenuBuilder().setCustomId('ticket_select').setPlaceholder('Choose a category...');
                s.customOptions.forEach(o => menu.addOptions(new StringSelectMenuOptionBuilder().setLabel(o.label).setValue(o.id).setEmoji(o.emoji)));
                row.addComponents(menu);
            } else if (s.customOptions.length > 0) {
                s.customOptions.forEach(o => row.addComponents(new ButtonBuilder().setCustomId(o.id).setLabel(o.label).setEmoji(o.emoji).setStyle(ButtonStyle.Secondary)));
            }
            await chan.send({ embeds: [embed], components: s.customOptions.length ? [row] : [] }).catch(console.error);
        }
    }

    res.redirect('/tickets');
});

app.listen(CONFIG.PORT, () => console.log(`Dashboard active on port ${CONFIG.PORT}`));
