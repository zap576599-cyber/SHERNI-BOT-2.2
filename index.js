require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    ActivityType,
    PermissionFlagsBits,
    EmbedBuilder
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
    SESSION_SECRET: process.env.SESSION_SECRET || 'sher-lock-secure-v2'
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

const generateRandomPass = () => `SHER-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

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
            logChannelId: "", // Channel to send logs to
            modRoleId: ""     // Role ID allowed to use !getpass
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
    client.user.setActivity('Dashboard Active', { type: ActivityType.Watching });
    
    client.guilds.cache.forEach(guild => {
        if (!serverPasswords.has(guild.id)) {
            const temp = generateRandomPass();
            serverPasswords.set(guild.id, temp);
        }
    });
});

client.on('guildCreate', async (guild) => {
    const tempPass = generateRandomPass();
    serverPasswords.set(guild.id, tempPass);
    try {
        const owner = await guild.fetchOwner();
        owner.send(`🛡️ **SHER LOCK Setup**\n**Server:** ${guild.name}\n**ID:** \`${guild.id}\`\n**Password:** \`${tempPass}\`\nSet your Mod Role in the dashboard to share access safely.`);
    } catch (e) {}
});

client.on('messageCreate', async (msg) => {
    if (!msg.guild || msg.author.bot) return;

    const s = getGuildSettings(msg.guild.id);
    const isOwner = msg.author.id === msg.guild.ownerId;
    const isAdmin = msg.member.permissions.has(PermissionFlagsBits.Administrator);
    const hasModRole = s.modRoleId && msg.member.roles.cache.has(s.modRoleId);
    const isAuthorized = isOwner || isAdmin || hasModRole;

    // --- ADMIN / MOD COMMANDS ---

    // 1. Get Password (Access Control)
    if (msg.content === '!getpass') {
        if (isAuthorized) {
            const pass = serverPasswords.get(msg.guild.id);
            return msg.reply({ content: `🔑 **Dashboard Access**\nURL: ${process.env.RENDER_EXTERNAL_URL || 'Your Render URL'}\nID: \`${msg.guild.id}\`\nPassword: ||${pass}||`, ephemeral: true });
        } else {
            return msg.reply("❌ You do not have the required role to view the password.");
        }
    }

    // 2. Manual Purge (!clear 10)
    if (msg.content.startsWith('!clear')) {
        if (!isAuthorized) return;
        const args = msg.content.split(' ');
        const amount = parseInt(args[1]);
        if (!amount || amount < 1 || amount > 99) return msg.reply("Usage: `!clear <1-99>`");
        
        try {
            await msg.channel.bulkDelete(amount + 1, true);
            const confirmation = await msg.channel.send(`🧹 Cleared ${amount} messages.`);
            setTimeout(() => confirmation.delete().catch(()=>{}), 3000);
        } catch (e) { msg.channel.send("Error deleting messages (older than 14 days?)"); }
        return;
    }

    // 3. Lockdown (!lock / !unlock)
    if (msg.content === '!lock') {
        if (!isAuthorized) return;
        msg.channel.permissionOverwrites.edit(msg.guild.roles.everyone, { SendMessages: false });
        return msg.reply("🔒 **Channel Locked**");
    }
    if (msg.content === '!unlock') {
        if (!isAuthorized) return;
        msg.channel.permissionOverwrites.edit(msg.guild.roles.everyone, { SendMessages: true });
        return msg.reply("🔓 **Channel Unlocked**");
    }

    // --- AUTO MOD LOGIC ---

    let trigger = false;
    let reason = "";

    // Check Filters
    if (s.antiLink && msg.content.match(/https?:\/\/[^\s]+/)) { trigger = true; reason = "Anti-Link"; }
    else if (s.blacklist.some(word => msg.content.toLowerCase().includes(word.toLowerCase()))) { trigger = true; reason = "Blacklist Word"; }
    else if (s.autoDeleteChannels.includes(msg.channel.id)) { trigger = true; reason = "Auto-Delete Channel"; }

    // Exceptions
    if (msg.channel.isThread() && s.ignoreThreads) trigger = false;
    
    if (trigger) {
        setTimeout(async () => {
            try {
                await msg.delete();
                
                // --- LOGGING SYSTEM ---
                if (s.logChannelId) {
                    const logChan = msg.guild.channels.cache.get(s.logChannelId);
                    if (logChan) {
                        const embed = new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setAuthor({ name: msg.author.tag, iconURL: msg.author.displayAvatarURL() })
                            .setDescription(`**Message Deleted in <#${msg.channel.id}>**\n${msg.content}`)
                            .addFields({ name: 'Reason', value: reason, inline: true })
                            .setTimestamp();
                        logChan.send({ embeds: [embed] }).catch(()=>{});
                    }
                }
            } catch (e) {}
        }, s.deleteDelay);
    }
});

client.login(CONFIG.TOKEN);

// --- WEB INTERFACE ---
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ 
    name: 'sher_lock_session',
    keys: [CONFIG.SESSION_SECRET], 
    maxAge: 24 * 60 * 60 * 1000 
}));

const UI = (content) => `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SHER LOCK PRO</title>
    <style>
        body { background: #0f172a; color: #f8fafc; font-family: -apple-system, sans-serif; display: flex; justify-content: center; padding: 20px; margin: 0; }
        .card { background: #1e293b; padding: 30px; border-radius: 12px; width: 100%; max-width: 600px; box-shadow: 0 4px 20px rgba(0,0,0,0.4); box-sizing: border-box; }
        input[type="text"], input[type="password"], input[type="number"], textarea { 
            width: 100%; padding: 12px; margin: 10px 0; border-radius: 6px; border: 1px solid #334155; 
            background: #0f172a; color: white; box-sizing: border-box; font-size: 16px;
        }
        .btn { background: #3b82f6; color: white; border: none; padding: 14px; border-radius: 6px; cursor: pointer; width: 100%; font-weight: bold; font-size: 16px; }
        .btn:hover { background: #2563eb; }
        .section { margin-bottom: 25px; padding-bottom: 15px; border-bottom: 1px solid #334155; }
        label { font-weight: bold; display: block; margin-top: 10px; color: #94a3b8; }
        .row { display: flex; align-items: center; gap: 10px; margin: 10px 0; }
        .row input { width: auto; margin: 0; }
        .channel-list { max-height: 180px; overflow-y: auto; background: #0f172a; padding: 10px; border-radius: 6px; border: 1px solid #334155; }
        .logout { color: #ef4444; text-decoration: none; font-size: 0.9em; display: block; text-align: center; margin-top: 20px; }
    </style>
</head>
<body><div class="card">${content}</div></body>
</html>
`;

app.get('/', (req, res) => {
    if (req.session.guildId) return res.redirect('/dashboard');
    res.send(UI(`
        <h2 style="text-align:center">SHER LOCK Access</h2>
        <form action="/login" method="POST">
            <label>Server ID</label>
            <input type="text" name="gid" placeholder="e.g. 1234567890" required>
            <label>Password</label>
            <input type="password" name="pass" placeholder="••••••••" required>
            <button class="btn">Login</button>
        </form>
    `));
});

app.post('/login', (req, res) => {
    const { gid, pass } = req.body;
    if (serverPasswords.get(gid) === pass) {
        req.session.guildId = gid;
        res.redirect('/dashboard');
    } else {
        res.send(UI(`<h3>Invalid Credentials</h3><a href="/" class="btn">Back to Login</a>`));
    }
});

app.get('/dashboard', (req, res) => {
    const gid = req.session.guildId;
    if (!gid) return res.redirect('/');
    
    const guild = client.guilds.cache.get(gid);
    if (!guild) return res.send(UI(`<h3>Bot not found in server ${gid}</h3><a href="/logout" class="logout">Logout</a>`));

    const s = getGuildSettings(gid);
    const textChannels = guild.channels.cache.filter(c => c.isTextBased() && !c.isThread());

    res.send(UI(`
        <h2>Settings: ${guild.name}</h2>
        <form action="/save" method="POST">
            <div class="section">
                <label>🔑 Dashboard Password</label>
                <input type="text" name="newPass" value="${serverPasswords.get(gid)}">
                
                <label>👮 Mod Role ID (Can use !getpass & !clear)</label>
                <input type="text" name="modRole" value="${s.modRoleId}" placeholder="Right click role > Copy ID">
                
                <label>📝 Log Channel ID (For Deleted Msgs)</label>
                <input type="text" name="logChan" value="${s.logChannelId}" placeholder="Right click channel > Copy ID">
            </div>
            
            <div class="section">
                <label>💬 Auto-Delete Channels</label>
                <div class="channel-list">
                    ${textChannels.map(c => `
                        <div class="row">
                            <input type="checkbox" name="chans" value="${c.id}" ${s.autoDeleteChannels.includes(c.id) ? 'checked' : ''}>
                            <span>#${c.name}</span>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="section">
                <label>⚙️ Options</label>
                <div class="row"><input type="checkbox" name="ignoreThreads" ${s.ignoreThreads ? 'checked' : ''}> Ignore Threads</div>
                <div class="row"><input type="checkbox" name="ignoreBots" ${s.ignoreBots ? 'checked' : ''}> Ignore Bots</div>
                <div class="row"><input type="checkbox" name="antiLink" ${s.antiLink ? 'checked' : ''}> Anti-Link Protection</div>
            </div>

            <div class="section">
                <label>⏱️ Delay (ms)</label>
                <input type="number" name="delay" value="${s.deleteDelay}" min="0">
                
                <label>🚫 Blacklist (comma separated)</label>
                <textarea name="words">${s.blacklist.join(', ')}</textarea>
            </div>

            <button class="btn">Save Settings</button>
        </form>
        <a href="/logout" class="logout">Logout</a>
    `));
});

app.post('/save', (req, res) => {
    const gid = req.session.guildId;
    if (!gid) return res.sendStatus(403);

    const s = getGuildSettings(gid);
    s.deleteDelay = parseInt(req.body.delay) || 0;
    s.antiLink = req.body.antiLink === 'on';
    s.ignoreThreads = req.body.ignoreThreads === 'on';
    s.ignoreBots = req.body.ignoreBots === 'on';
    s.blacklist = req.body.words ? req.body.words.split(',').map(w => w.trim()).filter(w => w) : [];
    s.modRoleId = req.body.modRole ? req.body.modRole.trim() : "";
    s.logChannelId = req.body.logChan ? req.body.logChan.trim() : "";
    
    let selectedChans = req.body.chans || [];
    if (!Array.isArray(selectedChans)) selectedChans = [selectedChans];
    s.autoDeleteChannels = selectedChans;
    
    if (req.body.newPass) {
        serverPasswords.set(gid, req.body.newPass.trim());
    }

    res.redirect('/dashboard');
});

app.get('/logout', (req, res) => {
    req.session = null;
    res.redirect('/');
});

app.listen(CONFIG.PORT, '0.0.0.0', () => {
    console.log(`[SYS] Dashboard listening on port ${CONFIG.PORT}`);
});
