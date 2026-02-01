require('dotenv').config();
const { Client, GatewayIntentBits, Partials, REST, Routes, PermissionsBitField } = require('discord.js');
const express = require('express');
const session = require('cookie-session');
const bodyParser = require('body-parser');
const axios = require('axios');

// --- CONFIGURATION ---
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
// CRITICAL FIX: Look for both URL and URI spellings just in case
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || process.env.DISCORD_REDIRECT_URL;
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'sher-bot-secret-123';

console.log('--- SHER BOT STARTUP ---');
console.log('Using Redirect URI:', REDIRECT_URI);
if (!REDIRECT_URI) console.error('❌ ERROR: No Redirect URI found in Render Environment!');
console.log('------------------------');

const db = {
    settings: new Map()
};

function getSettings(guildId) {
    if (!db.settings.has(guildId)) {
        db.settings.set(guildId, {
            autoDeleteChannels: [],
            ignoreBots: false,
            ignoreThreads: false,
            ignoredUsers: [],
        });
    }
    return db.settings.get(guildId);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel]
});

// Slash Commands setup
const commands = [
    {
        name: 'ban',
        description: 'Ban a user',
        options: [
            { name: 'user', type: 6, description: 'User to ban', required: true },
            { name: 'reason', type: 3, description: 'Reason', required: false }
        ]
    },
    {
        name: 'timeout',
        description: 'Mute a user',
        options: [
            { name: 'user', type: 6, description: 'User to mute', required: true },
            { name: 'minutes', type: 4, description: 'Minutes', required: true }
        ]
    }
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
    console.log(`SHER BOT is online as ${client.user.tag}`);
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    } catch (error) {
        console.error('Failed to register commands:', error);
    }
});

// Auto-Delete Logic
client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.id === client.user.id) return;
    const settings = getSettings(message.guild.id);
    if (settings.autoDeleteChannels.includes(message.channel.id)) {
        if (settings.ignoredUsers.includes(message.author.id)) return;
        if (settings.ignoreBots && message.author.bot) return;
        if (settings.ignoreThreads && message.channel.isThread()) return;
        
        try {
            setTimeout(async () => {
                if (message.deletable) await message.delete().catch(() => {});
            }, 1000);
        } catch (e) {}
    }
});

client.login(TOKEN);

// --- WEB SERVER ---
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    name: 'sher_session',
    keys: [SESSION_SECRET],
    maxAge: 24 * 60 * 60 * 1000
}));

const ui = (content, user = null) => `
<!DOCTYPE html>
<html>
<head>
    <title>SHER BOT Dashboard</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: 'Segoe UI', sans-serif; background: #2f3136; color: #dcddde; padding: 20px; line-height: 1.6; }
        .card { max-width: 650px; margin: auto; background: #36393f; padding: 25px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
        .btn { background: #5865f2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block; border: none; cursor: pointer; font-weight: 600; }
        .btn:hover { background: #4752c4; }
        .logout { color: #ed4245; text-decoration: none; font-size: 0.9em; }
        hr { border: 0; border-top: 1px solid #4f545c; margin: 20px 0; }
        input[type="text"] { width: 100%; padding: 10px; background: #202225; border: 1px solid #202225; color: white; border-radius: 4px; box-sizing: border-box; }
        .channel-row { background: #2f3136; padding: 10px; margin: 5px 0; border-radius: 4px; display: flex; align-items: center; }
        input[type="checkbox"] { margin-right: 12px; transform: scale(1.2); }
    </style>
</head>
<body>
    <div class="card">
        ${user ? `<div style="display:flex; justify-content:space-between; align-items:center;">
            <span>Logged in as <b>${user.username}</b></span>
            <a href="/logout" class="logout">Logout</a>
        </div><hr>` : ''}
        ${content}
    </div>
</body>
</html>
`;

app.get('/', (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    res.send(ui(`
        <h1 style="color:white; margin-top:0;">SHER BOT Admin</h1>
        <p>Control the auto-delete and moderation settings for your server.</p>
        <a href="/login" class="btn">Login with Discord</a>
    `));
});

app.get('/login', (req, res) => {
    if (!REDIRECT_URI) return res.send("Error: Missing Redirect URI in Render Settings.");
    const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds`;
    res.redirect(url);
});

app.get('/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect('/');
    
    try {
        const tokenRes = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: REDIRECT_URI,
            scope: 'identify guilds'
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const { access_token } = tokenRes.data;
        const userRes = await axios.get('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${access_token}` } });
        const guildsRes = await axios.get('https://discord.com/api/users/@me/guilds', { headers: { Authorization: `Bearer ${access_token}` } });

        req.session.user = userRes.data;
        req.session.guilds = guildsRes.data;
        res.redirect('/dashboard');
    } catch (err) {
        console.error('OAUTH ERROR:', err.response?.data || err.message);
        res.send(`Login failed. Discord said: ${JSON.stringify(err.response?.data || "Unknown Error")}. Check your Client Secret and Redirect URI.`);
    }
});

app.get('/dashboard', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    
    const adminGuilds = req.session.guilds.filter(g => (BigInt(g.permissions) & 0x8n) === 0x8n);
    const selectedId = req.query.guild_id;

    if (!selectedId) {
        const list = adminGuilds.map(g => `
            <div class="channel-row" style="justify-content: space-between;">
                <span>${g.name}</span>
                <a href="/dashboard?guild_id=${g.id}" class="btn" style="padding: 5px 12px; font-size: 0.8em;">Manage</a>
            </div>
        `).join('') || '<p>You are not an admin in any servers.</p>';
        return res.send(ui(`<h2>Select a Server</h2>${list}`, req.session.user));
    }

    const discordGuild = client.guilds.cache.get(selectedId);
    if (!discordGuild) return res.send(ui(`<p>SHER BOT is not in this server! Invite it first.</p><a href="/dashboard" class="btn">Back</a>`, req.session.user));

    const settings = getSettings(selectedId);
    const channels = discordGuild.channels.cache.filter(c => c.isTextBased() && !c.isThread());
    
    const channelHtml = channels.map(c => `
        <div class="channel-row">
            <input type="checkbox" name="channels" value="${c.id}" ${settings.autoDeleteChannels.includes(c.id) ? 'checked' : ''}>
            #${c.name}
        </div>
    `).join('');

    res.send(ui(`
        <h2>Settings: ${discordGuild.name}</h2>
        <form action="/save" method="POST">
            <input type="hidden" name="guild_id" value="${selectedId}">
            
            <p><b>Clean these channels:</b></p>
            ${channelHtml}
            
            <hr>
            <p><b>Filters:</b></p>
            <div class="channel-row"><input type="checkbox" name="ignoreBots" ${settings.ignoreBots ? 'checked' : ''}> Ignore Bot Messages</div>
            <div class="channel-row"><input type="checkbox" name="ignoreThreads" ${settings.ignoreThreads ? 'checked' : ''}> Ignore Threads</div>
            
            <hr>
            <p><b>Ignore these Users (IDs, comma separated):</b></p>
            <input type="text" name="ignoredUsers" value="${settings.ignoredUsers.join(', ')}" placeholder="12345678, 87654321">
            
            <br><br>
            <button type="submit" class="btn" style="background: #3ba55c; width: 100%;">Save Changes</button>
            <p style="text-align:center;"><a href="/dashboard" style="color:#aaa;">Go Back</a></p>
        </form>
    `, req.session.user));
});

app.post('/save', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    const { guild_id, ignoreBots, ignoreThreads, ignoredUsers } = req.body;
    let { channels } = req.body;
    
    if (!channels) channels = [];
    if (!Array.isArray(channels)) channels = [channels];

    const settings = getSettings(guild_id);
    settings.autoDeleteChannels = channels;
    settings.ignoreBots = !!ignoreBots;
    settings.ignoreThreads = !!ignoreThreads;
    settings.ignoredUsers = ignoredUsers ? ignoredUsers.split(',').map(id => id.trim()).filter(id => id.length > 0) : [];

    res.redirect(`/dashboard?guild_id=${guild_id}`);
});

app.get('/logout', (req, res) => { req.session = null; res.redirect('/'); });

app.listen(PORT, () => console.log(`Dashboard active on port ${PORT}`));
