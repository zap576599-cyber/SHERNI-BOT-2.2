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
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'bruh-secret';

// DEBUG LOG: This will show up in your Render Logs tab
console.log('--- SYSTEM CHECK ---');
console.log('CLIENT_ID status:', CLIENT_ID ? '✅ Loaded' : '❌ MISSING');
console.log('REDIRECT_URI status:', REDIRECT_URI ? `✅ ${REDIRECT_URI}` : '❌ MISSING (This is why it says undefined)');
console.log('--------------------');

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

const commands = [
    {
        name: 'ban',
        description: 'Temporarily ban a user (Admin only)',
        options: [
            { name: 'user', type: 6, description: 'The user to ban', required: true },
            { name: 'reason', type: 3, description: 'Reason for ban', required: false }
        ]
    },
    {
        name: 'timeout',
        description: 'Timeout (mute) a user (Admin only)',
        options: [
            { name: 'user', type: 6, description: 'The user to timeout', required: true },
            { name: 'minutes', type: 4, description: 'Duration in minutes', required: true },
            { name: 'reason', type: 3, description: 'Reason for timeout', required: false }
        ]
    }
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
    console.log(`Bot logged in as ${client.user.tag}`);
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    } catch (error) {
        console.error('Command Register Error:', error);
    }
});

client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.id === client.user.id) return;
    const settings = getSettings(message.guild.id);
    if (settings.autoDeleteChannels.includes(message.channel.id)) {
        if (settings.ignoredUsers.includes(message.author.id)) return;
        if (settings.ignoreBots && message.author.bot) return;
        if (settings.ignoreThreads && message.channel.isThread()) return;
        try {
            setTimeout(async () => { if (message.deletable) await message.delete(); }, 1000);
        } catch (err) {}
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: 'Admins only, bruh.', ephemeral: true });
    }
    const { commandName } = interaction;
    const targetUser = interaction.options.getUser('user');
    const member = interaction.guild.members.cache.get(targetUser.id);
    if (!member) return interaction.reply({ content: 'User not found.', ephemeral: true });

    if (commandName === 'ban') {
        const reason = interaction.options.getString('reason') || 'No reason';
        await member.ban({ reason });
        await interaction.reply({ content: `🚫 Banned ${targetUser.tag}` });
    } else if (commandName === 'timeout') {
        const minutes = interaction.options.getInteger('minutes');
        await member.timeout(minutes * 60 * 1000);
        await interaction.reply({ content: `⏳ Timed out ${targetUser.tag}` });
    }
});

client.login(TOKEN);

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ name: 'session', keys: [SESSION_SECRET], maxAge: 24 * 60 * 60 * 1000 }));

const renderPage = (content, user = null) => `
<!DOCTYPE html>
<html>
<head>
    <title>Bruh Dashboard</title>
    <style>
        body { font-family: sans-serif; background: #2c2f33; color: white; padding: 20px; }
        .container { max-width: 600px; margin: auto; background: #23272a; padding: 20px; border-radius: 10px; }
        .btn { display: inline-block; padding: 10px 20px; background: #5865F2; color: white; text-decoration: none; border-radius: 5px; border: none; cursor: pointer; }
        input[type="checkbox"] { margin-right: 10px; }
        .form-section { margin-bottom: 20px; border-bottom: 1px solid #444; padding-bottom: 10px; }
    </style>
</head>
<body>
    <div class="container">
        ${user ? `<div>Logged in as <b>${user.username}</b> | <a href="/logout" style="color:#f04747">Logout</a></div><hr>` : ''}
        ${content}
    </div>
</body>
</html>
`;

app.get('/', (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    res.send(renderPage(`
        <h1>Bruh Bot Admin</h1>
        <p>Login to manage auto-delete settings.</p>
        <a href="/login" class="btn">Login with Discord</a>
    `));
});

app.get('/login', (req, res) => {
    if (!REDIRECT_URI || REDIRECT_URI === 'undefined') {
        return res.send("Error: REDIRECT_URI is not set in Render environment variables.");
    }
    const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds`;
    res.redirect(url);
});

app.get('/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect('/');
    try {
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code,
            grant_type: 'authorization_code', redirect_uri: REDIRECT_URI, scope: 'identify guilds'
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const { access_token } = tokenResponse.data;
        const userRes = await axios.get('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${access_token}` } });
        const guildsRes = await axios.get('https://discord.com/api/users/@me/guilds', { headers: { Authorization: `Bearer ${access_token}` } });

        req.session.user = userRes.data;
        req.session.guilds = guildsRes.data;
        res.redirect('/dashboard');
    } catch (err) {
        res.send('Login failed. Check Render environment variables vs Discord Portal redirects.');
    }
});

app.get('/dashboard', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    const adminGuilds = req.session.guilds.filter(g => (BigInt(g.permissions) & 0x8n) === 0x8n);
    const selectedId = req.query.guild_id;

    if (!selectedId) {
        const list = adminGuilds.map(g => `<p>${g.name} <a href="/dashboard?guild_id=${g.id}" class="btn" style="padding:5px">Manage</a></p>`).join('');
        return res.send(renderPage(`<h2>Your Servers</h2>${list}`, req.session.user));
    }

    const discordGuild = client.guilds.cache.get(selectedId);
    if (!discordGuild) return res.send(renderPage(`<p>Bot is not in this server! Invite it first.</p><a href="/dashboard">Back</a>`));

    const settings = getSettings(selectedId);
    const channels = discordGuild.channels.cache.filter(c => c.isTextBased() && !c.isThread());
    
    const channelHtml = channels.map(c => `
        <div><input type="checkbox" name="channels" value="${c.id}" ${settings.autoDeleteChannels.includes(c.id) ? 'checked' : ''}> #${c.name}</div>
    `).join('');

    res.send(renderPage(`
        <h2>Settings for ${discordGuild.name}</h2>
        <form action="/save" method="POST">
            <input type="hidden" name="guild_id" value="${selectedId}">
            <div class="form-section">
                <label><b>Channels to Clean:</b></label><br>${channelHtml}
            </div>
            <div class="form-section">
                <input type="checkbox" name="ignoreBots" ${settings.ignoreBots ? 'checked' : ''}> Ignore Bots<br>
                <input type="checkbox" name="ignoreThreads" ${settings.ignoreThreads ? 'checked' : ''}> Ignore Threads
            </div>
            <div class="form-section">
                <label><b>Ignore User IDs (comma separated):</b></label><br>
                <input type="text" name="ignoredUsers" value="${settings.ignoredUsers.join(',')}" style="width:100%; padding:5px; background:#444; color:white; border:none;">
            </div>
            <button type="submit" class="btn">Save Config</button>
            <a href="/dashboard" style="color:#aaa; margin-left:10px;">Back</a>
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
    settings.ignoredUsers = ignoredUsers ? ignoredUsers.split(',').map(id => id.trim()) : [];

    res.redirect(`/dashboard?guild_id=${guild_id}`);
});

app.get('/logout', (req, res) => { req.session = null; res.redirect('/'); });

app.listen(PORT, () => console.log(`Dashboard on port ${PORT}`));
