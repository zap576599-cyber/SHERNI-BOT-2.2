require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    ActivityType,
    EmbedBuilder
} = require('discord.js');
const express = require('express');
const session = require('cookie-session');
const bodyParser = require('body-parser');

// --- CONFIGURATION ---
const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    RAW_PASSWORDS: process.env.GUILD_PASSWORDS || "", 
    PORT: process.env.PORT || 10000,
    SESSION_SECRET: process.env.SESSION_SECRET || 'sher-bot-pro-v1'
};

const serverPasswords = new Map();
if (CONFIG.RAW_PASSWORDS) {
    CONFIG.RAW_PASSWORDS.split(',').forEach(pair => {
        const [id, pass] = pair.split(':');
        if (id && pass) serverPasswords.set(id.trim(), pass.trim());
    });
}

// --- DATA MANAGEMENT (Memory Store) ---
const db = new Map();
const getGuildSettings = (guildId) => {
    if (!db.has(guildId)) {
        db.set(guildId, {
            autoDeleteChannels: [],
            deleteDelay: 1200, // Default 1.2s
            ignoreBots: false,
            ignoreThreads: false,
            ignoredUsers: [],
            antiLink: false,
            blacklist: [],
            logChannel: null,
            autoResponses: {} // { "trigger": "reply" }
        });
    }
    return db.get(guildId);
};

// --- DISCORD BOT CLIENT ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel]
});

client.once('ready', () => {
    console.log(`[BOT] Pro Active: ${client.user.tag}`);
    client.user.setActivity('Protecting Servers', { type: ActivityType.Shield });
});

client.on('messageCreate', async (msg) => {
    if (!msg.guild || msg.author.id === client.user.id) return;
    
    const settings = getGuildSettings(msg.guild.id);
    const content = msg.content.toLowerCase();
    let shouldDelete = false;
    let reason = "Auto-Delete Channel";

    // 1. Check Ignored Users
    if (settings.ignoredUsers.includes(msg.author.id)) return;

    // 2. Anti-Link Feature
    if (settings.antiLink && (msg.content.includes('discord.gg/') || msg.content.includes('http'))) {
        shouldDelete = true;
        reason = "Anti-Link Protection";
    }

    // 3. Blacklist Feature
    if (settings.blacklist.some(word => content.includes(word.toLowerCase()))) {
        shouldDelete = true;
        reason = "Blacklisted Keyword";
    }

    // 4. Auto-Delete Channel Logic
    if (settings.autoDeleteChannels.includes(msg.channel.id)) {
        if (settings.ignoreBots && msg.author.bot) return;
        if (settings.ignoreThreads && msg.channel.isThread()) return;
        shouldDelete = true;
    }

    // 5. Auto-Response Logic (Non-deleting)
    if (!shouldDelete && settings.autoResponses[content]) {
        return msg.reply(settings.autoResponses[content]);
    }

    // Execution
    if (shouldDelete) {
        setTimeout(() => {
            if (msg.deletable) {
                msg.delete().catch(() => {});
                
                // Logging Feature
                if (settings.logChannel) {
                    const logChan = msg.guild.channels.cache.get(settings.logChannel);
                    if (logChan) {
                        logChan.send(`🗑️ **Deleted:** "${msg.content.substring(0, 100)}" from <@${msg.author.id}> in <#${msg.channel.id}>. \n**Reason:** ${reason}`).catch(() => {});
                    }
                }
            }
        }, settings.deleteDelay);
    }
});

client.login(CONFIG.TOKEN).catch(e => console.error('[BOT] Login Failed:', e.message));

// --- WEB DASHBOARD ---
const app = express();
app.set('trust proxy', 1);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    name: 'sher_session',
    keys: [CONFIG.SESSION_SECRET],
    maxAge: 24 * 60 * 60 * 1000
}));

const LAYOUT = (body, showLogout = false) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SHER PRO DASHBOARD</title>
    <style>
        :root { --primary: #5865F2; --bg: #121212; --card: #1e1e1e; --text: #FFFFFF; --muted: #999; --accent: #3BA55C; }
        body { font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 20px; display: flex; justify-content: center; }
        .wrapper { width: 100%; max-width: 900px; background: var(--card); padding: 30px; border-radius: 15px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
        .nav { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; margin-bottom: 25px; padding-bottom: 15px; }
        .btn { background: var(--primary); color: #fff; padding: 12px 20px; border: none; border-radius: 8px; cursor: pointer; text-decoration: none; font-weight: bold; transition: 0.2s; display: inline-block; width: 100%; box-sizing: border-box; text-align: center; }
        .save-btn { background: var(--accent); margin-top: 20px; font-size: 1.1em; }
        .section { background: #252525; padding: 20px; border-radius: 10px; margin-bottom: 20px; border-left: 4px solid var(--primary); }
        .channel-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; max-height: 200px; overflow-y: auto; padding: 10px; background: #181818; border-radius: 5px; }
        input, select, textarea { width: 100%; padding: 12px; border-radius: 5px; border: 1px solid #333; background: #181818; color: #fff; margin-bottom: 15px; box-sizing: border-box; }
        label { display: block; margin-bottom: 8px; font-weight: bold; color: var(--muted); }
        .badge { background: var(--primary); font-size: 0.7em; padding: 2px 8px; border-radius: 10px; margin-left: 10px; }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="nav">
            <h2 style="margin:0">SHER LOCK <span class="badge">PRO</span></h2>
            ${showLogout ? '<a href="/logout" style="color:#F04747; text-decoration:none; font-weight:bold">Logout</a>' : ''}
        </div>
        ${body}
    </div>
</body>
</html>
`;

app.get('/', (req, res) => {
    if (req.session.authedGuild) return res.redirect('/dashboard');
    res.send(LAYOUT(`
        <div style="text-align:center;">
            <h1>Server Access</h1>
            <p style="color:var(--muted)">Manage your server's protection and automation.</p>
            <form action="/login" method="POST" style="text-align:left; max-width: 400px; margin: auto;">
                <label>Discord Server ID</label>
                <input type="text" name="guildId" placeholder="Paste ID here..." required>
                <label>Access Password</label>
                <input type="password" name="password" placeholder="••••••••" required>
                <button type="submit" class="btn">Unlock Dashboard</button>
            </form>
        </div>
    `));
});

app.post('/login', (req, res) => {
    const { guildId, password } = req.body;
    const correctPass = serverPasswords.get(guildId);
    if (correctPass && password === correctPass) {
        req.session.authedGuild = guildId;
        res.redirect('/dashboard');
    } else {
        res.send(LAYOUT(`<div style="text-align:center"><p style="color:#F04747">Access Denied.</p><a href="/" class="btn">Try Again</a></div>`));
    }
});

app.get('/dashboard', (req, res) => {
    const gid = req.session.authedGuild;
    if (!gid) return res.redirect('/');
    
    const discordGuild = client.guilds.cache.get(gid);
    if (!discordGuild) return res.send(LAYOUT(`<div style="text-align:center"><h3>Bot is not in Server ${gid}</h3><a href="/logout" class="btn">Logout</a></div>`));

    const s = getGuildSettings(gid);
    const channels = discordGuild.channels.cache.filter(c => c.isTextBased() && !c.isThread());

    res.send(LAYOUT(`
        <div style="margin-bottom:20px;">
            <h3 style="margin:0">⚙️ Settings for ${discordGuild.name}</h3>
        </div>

        <form action="/save" method="POST">
            <div class="section">
                <label>⏱️ Deletion Delay (ms)</label>
                <input type="number" name="delay" value="${s.deleteDelay}" step="100" min="0">
                <p style="font-size:0.8em; color:var(--muted)">1000ms = 1 second. Set to 0 for instant.</p>
            </div>

            <div class="section">
                <label>💬 Auto-Delete Channels</label>
                <div class="channel-grid">
                    ${channels.map(c => `<label style="color:white; font-weight:normal;"><input type="checkbox" name="chans" value="${c.id}" ${s.autoDeleteChannels.includes(c.id) ? 'checked' : ''} style="width:auto"> #${c.name}</label>`).join('')}
                </div>
            </div>

            <div class="section">
                <label>🛡️ Security & Filtering</label>
                <label style="font-weight:normal"><input type="checkbox" name="antiLink" ${s.antiLink ? 'checked' : ''} style="width:auto"> Anti-Link (Delete all URLs/Invites)</label>
                <br>
                <label>Blacklisted Words (Comma separated)</label>
                <textarea name="blacklist" rows="2" placeholder="badword1, scam, link">${s.blacklist.join(', ')}</textarea>
            </div>

            <div class="section">
                <label>📜 Logging & Exceptions</label>
                <label>Log Channel ID (Optional)</label>
                <input type="text" name="logChannel" value="${s.logChannel || ''}" placeholder="Paste channel ID for logs">
                
                <label>Ignored User IDs (Whitelist)</label>
                <input type="text" name="iu" value="${s.ignoredUsers.join(', ')}" placeholder="ID1, ID2">
                
                <label style="font-weight:normal"><input type="checkbox" name="ib" ${s.ignoreBots ? 'checked' : ''} style="width:auto"> Ignore Other Bots</label>
            </div>

            <button type="submit" class="btn save-btn">Save Pro Configuration</button>
        </form>
    `, true));
});

app.post('/save', (req, res) => {
    const gid = req.session.authedGuild;
    if (!gid) return res.sendStatus(403);

    const { delay, ib, antiLink, blacklist, logChannel, iu } = req.body;
    let { chans } = req.body;
    if (!chans) chans = [];
    if (!Array.isArray(chans)) chans = [chans];
    
    const s = getGuildSettings(gid);
    s.autoDeleteChannels = chans;
    s.deleteDelay = parseInt(delay) || 0;
    s.ignoreBots = !!ib; 
    s.antiLink = !!antiLink;
    s.logChannel = logChannel || null;
    s.blacklist = blacklist ? blacklist.split(',').map(i => i.trim()).filter(i => i) : [];
    s.ignoredUsers = iu ? iu.split(',').map(i => i.trim()).filter(i => i) : [];
    
    res.redirect('/dashboard');
});

app.get('/logout', (req, res) => {
    req.session = null;
    res.redirect('/');
});

app.listen(CONFIG.PORT, '0.0.0.0', () => {
    console.log(`[SYS] Pro Dashboard active on port ${CONFIG.PORT}`);
});
