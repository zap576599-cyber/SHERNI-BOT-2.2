require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    ActivityType 
} = require('discord.js');
const express = require('express');
const session = require('cookie-session');
const bodyParser = require('body-parser');

// --- CONFIGURATION ---
const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    // Set this in Render Env: ADMIN_PASSWORD
    PASSWORD: process.env.ADMIN_PASSWORD || 'admin123', 
    PORT: process.env.PORT || 10000,
    SESSION_SECRET: process.env.SESSION_SECRET || 'sher-bot-password-auth-v1'
};

// --- DATA MANAGEMENT ---
const db = new Map();
const getGuildSettings = (guildId) => {
    if (!db.has(guildId)) {
        db.set(guildId, {
            autoDeleteChannels: [],
            ignoreBots: false,
            ignoreThreads: false,
            ignoredUsers: [],
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
    console.log(`[BOT] Logged in as ${client.user.tag}`);
    client.user.setActivity('Cleaning Servers', { type: ActivityType.Watching });
});

client.on('messageCreate', async (msg) => {
    if (!msg.guild || msg.author.id === client.user.id) return;
    const settings = getGuildSettings(msg.guild.id);
    if (settings.autoDeleteChannels.includes(msg.channel.id)) {
        if (settings.ignoredUsers.includes(msg.author.id)) return;
        if (settings.ignoreBots && msg.author.bot) return;
        if (settings.ignoreThreads && msg.channel.isThread()) return;
        setTimeout(() => { if (msg.deletable) msg.delete().catch(() => {}); }, 1200);
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

const LAYOUT = (body, loggedIn = false) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SHER DASHBOARD</title>
    <style>
        :root { --primary: #5865F2; --bg: #23272A; --card: #2C2F33; --text: #FFFFFF; --muted: #B9BBBE; }
        body { font-family: 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 15px; display: flex; justify-content: center; }
        .wrapper { width: 100%; max-width: 800px; background: var(--card); padding: 30px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
        .nav { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #444; margin-bottom: 25px; padding-bottom: 15px; }
        .btn { background: var(--primary); color: #fff; padding: 12px 20px; border: none; border-radius: 5px; cursor: pointer; text-decoration: none; font-weight: bold; transition: 0.2s; display: inline-block; }
        .card-inner { background: #23272A; padding: 15px; border-radius: 8px; border: 1px solid #3E4147; margin-bottom: 20px; }
        .channel-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; max-height: 250px; overflow-y: auto; padding: 10px; background: #1E2124; border-radius: 5px; }
        input[type="password"], input[type="text"] { width: 100%; padding: 12px; border-radius: 5px; border: 1px solid #444; background: #1E2124; color: #fff; margin-top: 5px; box-sizing: border-box; }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="nav">
            <h2 style="margin:0">SHER ADMIN</h2>
            ${loggedIn ? '<a href="/logout" style="color:#F04747; text-decoration:none">Logout</a>' : ''}
        </div>
        ${body}
    </div>
</body>
</html>
`;

app.get('/', (req, res) => {
    if (req.session.isAdmin) return res.redirect('/dashboard');
    res.send(LAYOUT(`
        <div style="text-align:center; padding: 20px 0;">
            <h1>Admin Access</h1>
            <form action="/login" method="POST">
                <input type="password" name="password" placeholder="Enter Admin Password" required autofocus>
                <br><br>
                <button type="submit" class="btn" style="width:100%">Unlock Dashboard</button>
            </form>
        </div>
    `));
});

app.post('/login', (req, res) => {
    if (req.body.password === CONFIG.PASSWORD) {
        req.session.isAdmin = true;
        res.redirect('/dashboard');
    } else {
        res.send(LAYOUT('<p style="color:#F04747; text-align:center">Wrong password. Try again.</p><br><a href="/" class="btn" style="width:100%; text-align:center">Back</a>'));
    }
});

app.get('/dashboard', (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/');
    
    const gid = req.query.guild_id;
    const guilds = client.guilds.cache;

    if (!gid) {
        const items = guilds.map(g => `
            <div class="card-inner" style="display:flex; justify-content:space-between; align-items:center;">
                <b>${g.name}</b>
                <a href="/dashboard?guild_id=${g.id}" class="btn" style="padding:5px 15px">Manage</a>
            </div>
        `).join('');
        return res.send(LAYOUT(`<h3>Servers with Bot</h3>${items || '<p>Bot is not in any servers yet.</p>'}`, true));
    }

    const discordGuild = client.guilds.cache.get(gid);
    if (!discordGuild) return res.redirect('/dashboard');

    const s = getGuildSettings(gid);
    const channels = discordGuild.channels.cache.filter(c => c.isTextBased() && !c.isThread());

    res.send(LAYOUT(`
        <a href="/dashboard" style="color:var(--muted); text-decoration:none">← Back to Servers</a>
        <h3>Configuring ${discordGuild.name}</h3>
        <form action="/save" method="POST">
            <input type="hidden" name="gid" value="${gid}">
            
            <label><b>Auto-Delete Channels</b></label>
            <div class="channel-grid">
                ${channels.map(c => `
                    <label style="display:block; padding: 5px 0;">
                        <input type="checkbox" name="chans" value="${c.id}" ${s.autoDeleteChannels.includes(c.id) ? 'checked' : ''}> #${c.name}
                    </label>
                `).join('')}
            </div>
            
            <br>
            <label><input type="checkbox" name="ib" ${s.ignoreBots ? 'checked' : ''}> Ignore Bots</label><br>
            <label><input type="checkbox" name="it" ${s.ignoreThreads ? 'checked' : ''}> Ignore Threads</label>
            
            <br><br>
            <label><b>Ignored User IDs</b> (Comma separated)</label>
            <input type="text" name="iu" value="${s.ignoredUsers.join(', ')}">
            
            <button type="submit" class="btn" style="width:100%; margin-top:20px; background:#3BA55C">Save Settings</button>
        </form>
    `, true));
});

app.post('/save', (req, res) => {
    if (!req.session.isAdmin) return res.sendStatus(403);
    const { gid, ib, it, iu } = req.body;
    let { chans } = req.body;
    if (!chans) chans = [];
    if (!Array.isArray(chans)) chans = [chans];
    
    const s = getGuildSettings(gid);
    s.autoDeleteChannels = chans;
    s.ignoreBots = !!ib; 
    s.ignoreThreads = !!it;
    s.ignoredUsers = iu ? iu.split(',').map(i => i.trim()).filter(i => i) : [];
    
    res.redirect(`/dashboard?guild_id=${gid}`);
});

app.get('/logout', (req, res) => {
    req.session = null;
    res.redirect('/');
});

app.listen(CONFIG.PORT, '0.0.0.0', () => {
    console.log(`[SYS] Admin Dashboard running on port ${CONFIG.PORT}`);
});
