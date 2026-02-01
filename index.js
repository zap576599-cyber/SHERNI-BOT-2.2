require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    ActivityType,
    PermissionFlagsBits
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

// Map to store passwords (GuildID -> Password)
const serverPasswords = new Map();

// Parse passwords from Render Environment Variables
const loadPasswords = () => {
    if (CONFIG.RAW_PASSWORDS) {
        CONFIG.RAW_PASSWORDS.split(',').forEach(pair => {
            const [id, pass] = pair.split(':');
            if (id && pass) serverPasswords.set(id.trim(), pass.trim());
        });
    }
};
loadPasswords();

// Helper for generating random setup keys for new servers
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
    
    // Assign random passwords to any servers that don't have one in ENV yet
    client.guilds.cache.forEach(guild => {
        if (!serverPasswords.has(guild.id)) {
            const temp = generateRandomPass();
            serverPasswords.set(guild.id, temp);
            console.log(`[SETUP] Generated Temp Pass for ${guild.name}: ${temp}`);
        }
    });
});

// Notify owner on join with their random password
client.on('guildCreate', async (guild) => {
    const tempPass = generateRandomPass();
    serverPasswords.set(guild.id, tempPass);
    try {
        const owner = await guild.fetchOwner();
        owner.send(`🛡️ **SHER LOCK Setup Required**\nTo access your dashboard for **${guild.name}**, use:\n**Server ID:** \`${guild.id}\` \n**Password:** \`${tempPass}\`\n\nYou can change this password in the dashboard.`);
    } catch (e) { console.log("Could not DM owner."); }
});

client.on('messageCreate', async (msg) => {
    if (!msg.guild || msg.author.id === client.user.id) return;

    // Safety Command for Owners to retrieve password
    if (msg.content === '!getpass' && msg.member.permissions.has(PermissionFlagsBits.Administrator)) {
        const pass = serverPasswords.get(msg.guild.id);
        return msg.reply({ content: `The dashboard password for this server is: ||${pass}||` });
    }

    const s = getGuildSettings(msg.guild.id);
    let trigger = false;

    // Filter Logic
    if (msg.author.bot && s.ignoreBots) return;
    if (msg.channel.isThread() && s.ignoreThreads) return;
    
    if (s.antiLink && msg.content.match(/https?:\/\/[^\s]+/)) trigger = true;
    if (s.blacklist.some(word => msg.content.toLowerCase().includes(word.toLowerCase()))) trigger = true;
    if (s.autoDeleteChannels.includes(msg.channel.id)) trigger = true;

    if (trigger) {
        setTimeout(() => {
            msg.delete().catch(() => {});
        }, s.deleteDelay);
    }
});

client.login(CONFIG.TOKEN).catch(err => console.error("Discord Login Error:", err));

// --- WEB INTERFACE ---
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ 
    name: 'sher_lock_session',
    keys: [CONFIG.SESSION_SECRET], 
    maxAge: 24 * 60 * 60 * 1000 
}));

const UI = (content, authed = false) => `
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
        <p style="text-align:center; color: #94a3b8;">Enter Server ID and Password to manage settings.</p>
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
                <small style="color: #64748b">Change this to your preferred access key.</small>
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
                <label>⚙️ General Options</label>
                <div class="row">
                    <input type="checkbox" name="ignoreThreads" ${s.ignoreThreads ? 'checked' : ''}>
                    <span>Ignore Threads</span>
                </div>
                <div class="row">
                    <input type="checkbox" name="ignoreBots" ${s.ignoreBots ? 'checked' : ''}>
                    <span>Ignore Bots</span>
                </div>
                <div class="row">
                    <input type="checkbox" name="antiLink" ${s.antiLink ? 'checked' : ''}>
                    <span>Anti-Link Protection</span>
                </div>
            </div>

            <div class="section">
                <label>⏱️ Deletion Delay (ms)</label>
                <input type="number" name="delay" value="${s.deleteDelay}" min="0">
                
                <label>🚫 Blacklist Words (comma separated)</label>
                <textarea name="words" placeholder="scam, badword, link">${s.blacklist.join(', ')}</textarea>
            </div>

            <button class="btn">Save Configuration</button>
        </form>
        <a href="/logout" class="logout">Logout from Server Dashboard</a>
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
