require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    REST, 
    Routes, 
    PermissionsBitField,
    ActivityType 
} = require('discord.js');
const express = require('express');
const session = require('cookie-session');
const bodyParser = require('body-parser');
const axios = require('axios');

// --- CONFIGURATION ---
// Note: Adjusted to match your exact Render Env Var keys from the screenshot
const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
    // Matching your screenshot: DISCORD_REDIRECT_URL
    REDIRECT_URI: process.env.DISCORD_REDIRECT_URL || process.env.DISCORD_REDIRECT_URI,
    PORT: process.env.PORT || 10000,
    SESSION_SECRET: process.env.SESSION_SECRET || 'sher-bot-optimized-key-2024'
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

const SLASH_COMMANDS = [
    {
        name: 'ban',
        description: 'Ban a member',
        options: [
            { name: 'user', type: 6, description: 'Target user', required: true },
            { name: 'reason', type: 3, description: 'Reason', required: false }
        ]
    },
    {
        name: 'timeout',
        description: 'Mute a member',
        options: [
            { name: 'user', type: 6, description: 'Target user', required: true },
            { name: 'minutes', type: 4, description: 'Duration', required: true }
        ]
    },
    { name: 'ping', description: 'Check bot latency' }
];

client.once('ready', async () => {
    console.log(`[BOT] Connected as ${client.user.tag}`);
    client.user.setActivity('Cleaning Servers', { type: ActivityType.Watching });

    const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(CONFIG.CLIENT_ID), { body: SLASH_COMMANDS });
        console.log('[BOT] Slash commands synced globally.');
    } catch (err) {
        console.error('[BOT] Sync Error:', err.message);
    }
});

client.on('messageCreate', async (msg) => {
    if (!msg.guild) return;
    const settings = getGuildSettings(msg.guild.id);
    if (settings.autoDeleteChannels.includes(msg.channel.id)) {
        if (settings.ignoredUsers.includes(msg.author.id)) return;
        if (settings.ignoreBots && msg.author.bot) return;
        if (settings.ignoreThreads && msg.channel.isThread()) return;
        setTimeout(() => { if (msg.deletable) msg.delete().catch(() => {}); }, 1200);
    }
});

client.on('interactionCreate', async (int) => {
    if (!int.isChatInputCommand()) return;
    if (!int.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
        return int.reply({ content: 'Insufficient permissions.', ephemeral: true });
    }
    const { commandName, options, guild } = int;
    const target = options.getUser('user');
    const member = target ? guild.members.cache.get(target.id) : null;
    try {
        if (commandName === 'ping') await int.reply(`Pong! \`${client.ws.ping}ms\``);
        if (commandName === 'ban') {
            await member.ban({ reason: options.getString('reason') || 'No reason' });
            await int.reply(`🚫 Banned **${target.tag}**`);
        }
        if (commandName === 'timeout') {
            const mins = options.getInteger('minutes');
            await member.timeout(mins * 60 * 1000);
            await int.reply(`⏳ Muted **${target.tag}** for ${mins}m`);
        }
    } catch (err) {
        int.reply({ content: `Error: ${err.message}`, ephemeral: true });
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
    maxAge: 86400000,
    secure: false, 
    httpOnly: true
}));

app.get('/health', (req, res) => res.status(200).send('OK'));

const LAYOUT = (body, user) => `
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
        .btn { background: var(--primary); color: #fff; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; text-decoration: none; font-weight: bold; transition: 0.2s; }
        .card-inner { background: #23272A; padding: 15px; border-radius: 8px; border: 1px solid #3E4147; margin-bottom: 20px; }
        .channel-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; max-height: 200px; overflow-y: auto; padding: 10px; background: #1E2124; border-radius: 5px; }
        input[type="text"] { width: 100%; padding: 12px; border-radius: 5px; border: 1px solid #444; background: #1E2124; color: #fff; margin-top: 5px; }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="nav">
            <h2 style="margin:0">SHER BOT</h2>
            ${user ? `<span>${user.username} | <a href="/logout" style="color:#F04747">Logout</a></span>` : ''}
        </div>
        ${body}
    </div>
</body>
</html>
`;

app.get('/', (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    res.send(LAYOUT(`
        <div style="text-align:center; padding: 40px 0;">
            <h1>Server Management</h1>
            <p>Connect your Discord account to manage auto-delete settings.</p>
            <br>
            <a href="/login" class="btn">Login with Discord</a>
        </div>
    `));
});

app.get('/login', (req, res) => {
    // If this is still undefined, we display a clear error message on screen
    if (!CONFIG.REDIRECT_URI) {
        return res.status(500).send("ERROR: DISCORD_REDIRECT_URL is missing in Render Env Vars. Check your screenshot image_33c19f.png and ensure the key name is correct.");
    }
    const url = `https://discord.com/api/oauth2/authorize?client_id=${CONFIG.CLIENT_ID}&redirect_uri=${encodeURIComponent(CONFIG.REDIRECT_URI)}&response_type=code&scope=identify%20guilds`;
    res.redirect(url);
});

app.get('/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect('/');
    try {
        const tokenResp = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: CONFIG.CLIENT_ID, client_secret: CONFIG.CLIENT_SECRET,
            code, grant_type: 'authorization_code', redirect_uri: CONFIG.REDIRECT_URI,
            scope: 'identify guilds'
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 });

        const { access_token } = tokenResp.data;
        const [u, g] = await Promise.all([
            axios.get('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${access_token}` } }),
            axios.get('https://discord.com/api/users/@me/guilds', { headers: { Authorization: `Bearer ${access_token}` } })
        ]);

        req.session.user = u.data;
        req.session.guilds = g.data;
        res.redirect('/dashboard');
    } catch (err) {
        console.error('[WEB] Auth Error:', err.response?.data || err.message);
        res.send(`Auth failed: ${err.message}`);
    }
});

app.get('/dashboard', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    const adminGuilds = req.session.guilds.filter(g => (BigInt(g.permissions) & 0x8n) === 0x8n);
    const gid = req.query.guild_id;

    if (!gid) {
        const items = adminGuilds.map(g => `
            <div class="card-inner" style="display:flex; justify-content:space-between; align-items:center;">
                <b>${g.name}</b>
                <a href="/dashboard?guild_id=${g.id}" class="btn" style="padding:5px 15px">Manage</a>
            </div>
        `).join('');
        return res.send(LAYOUT(`<h3>Select a Server</h3>${items || '<p>No servers found.</p>'}`, req.session.user));
    }

    const discordGuild = client.guilds.cache.get(gid);
    if (!discordGuild) return res.send(LAYOUT(`<p>Bot is not in this server.</p><a href="/dashboard">Go Back</a>`, req.session.user));

    const s = getGuildSettings(gid);
    const channels = discordGuild.channels.cache.filter(c => c.isTextBased() && !c.isThread());

    res.send(LAYOUT(`
        <h3>Configuring ${discordGuild.name}</h3>
        <form action="/save" method="POST">
            <input type="hidden" name="gid" value="${gid}">
            <label>Auto-Delete Channels</label>
            <div class="channel-grid">${channels.map(c => `<label><input type="checkbox" name="chans" value="${c.id}" ${s.autoDeleteChannels.includes(c.id) ? 'checked' : ''}> #${c.name}</label>`).join('')}</div>
            <br>
            <label><input type="checkbox" name="ib" ${s.ignoreBots ? 'checked' : ''}> Ignore Bots</label><br>
            <label><input type="checkbox" name="it" ${s.ignoreThreads ? 'checked' : ''}> Ignore Threads</label>
            <br><br>
            <label>Ignored User IDs</label>
            <input type="text" name="iu" value="${s.ignoredUsers.join(', ')}">
            <button type="submit" class="btn" style="width:100%; margin-top:20px; background:#3BA55C">Save</button>
        </form>
    `, req.session.user));
});

app.post('/save', (req, res) => {
    if (!req.session.user) return res.sendStatus(403);
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

app.get('/logout', (req, res) => { req.session = null; res.redirect('/'); });

// --- STARTUP ---
// Bind to 0.0.0.0 specifically for Render
app.listen(CONFIG.PORT, '0.0.0.0', () => {
    console.log(`[SYS] Web Dashboard active on port ${CONFIG.PORT}`);
});
