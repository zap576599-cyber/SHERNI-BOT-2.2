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
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || process.env.DISCORD_REDIRECT_URL;
const PORT = process.env.PORT || 10000; 
const SESSION_SECRET = process.env.SESSION_SECRET || 'sher-bot-ultra-secret-key';

// Database Mock (In-memory)
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

// --- DISCORD CLIENT ---
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
        description: 'Ban a user from the server',
        options: [
            { name: 'user', type: 6, description: 'The user to ban', required: true },
            { name: 'reason', type: 3, description: 'Reason for the ban', required: false }
        ]
    },
    {
        name: 'timeout',
        description: 'Mute a user for a specific duration',
        options: [
            { name: 'user', type: 6, description: 'The user to mute', required: true },
            { name: 'minutes', type: 4, description: 'Duration in minutes', required: true }
        ]
    }
];

client.once('ready', async () => {
    console.log(`✅ SHER BOT is online as ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Slash commands registered successfully.');
    } catch (error) {
        console.error('❌ Failed to register commands:', error);
    }
});

// Auto-Delete Logic
client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.id === client.user.id) return;
    
    const settings = getSettings(message.guild.id);
    if (settings.autoDeleteChannels.includes(message.channel.id)) {
        // Check filters
        if (settings.ignoredUsers.includes(message.author.id)) return;
        if (settings.ignoreBots && message.author.bot) return;
        if (settings.ignoreThreads && message.channel.isThread()) return;
        
        try {
            // Short delay to allow user to see the "bruh" moment before it vanishes
            setTimeout(async () => {
                if (message.deletable) {
                    await message.delete().catch(() => {});
                }
            }, 1000);
        } catch (e) {
            console.error("Delete Error:", e);
        }
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: 'Permissions Error: You must be an Admin to use SHER BOT commands.', ephemeral: true });
    }

    const { commandName } = interaction;
    const targetUser = interaction.options.getUser('user');
    const member = interaction.guild.members.cache.get(targetUser.id);

    if (!member) return interaction.reply({ content: 'User not found in this server.', ephemeral: true });

    try {
        if (commandName === 'ban') {
            const reason = interaction.options.getString('reason') || 'No reason provided';
            await member.ban({ reason });
            await interaction.reply({ content: `🚫 **Banned:** ${targetUser.tag}` });
        } else if (commandName === 'timeout') {
            const minutes = interaction.options.getInteger('minutes');
            await member.timeout(minutes * 60 * 1000);
            await interaction.reply({ content: `⏳ **Muted:** ${targetUser.tag} for ${minutes} minutes.` });
        }
    } catch (err) {
        interaction.reply({ content: `Error: I might lack permissions to moderate that user.`, ephemeral: true });
    }
});

client.login(TOKEN).catch(err => console.error("❌ DISCORD LOGIN ERROR:", err));

// --- WEB SERVER (DASHBOARD) ---
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    name: 'sher_session',
    keys: [SESSION_SECRET],
    maxAge: 24 * 60 * 60 * 1000
}));

// Render Health Check
app.get('/health', (req, res) => res.status(200).send('OK'));

const uiWrapper = (content, user = null) => `
<!DOCTYPE html>
<html>
<head>
    <title>SHER BOT Dashboard</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: 'Inter', -apple-system, sans-serif; background: #23272a; color: #ffffff; margin: 0; padding: 20px; display: flex; justify-content: center; }
        .container { width: 100%; max-width: 800px; background: #2c2f33; padding: 40px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #444; margin-bottom: 30px; padding-bottom: 20px; }
        .btn { background: #5865f2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; border: none; cursor: pointer; font-weight: bold; transition: 0.2s; }
        .btn:hover { background: #4752c4; transform: translateY(-2px); }
        .btn-save { background: #3ba55c; width: 100%; margin-top: 20px; }
        .btn-save:hover { background: #2d8147; }
        .card { background: #23272a; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #3e4147; }
        .channel-list { max-height: 300px; overflow-y: auto; background: #202225; padding: 15px; border-radius: 6px; }
        .channel-item { display: flex; align-items: center; padding: 8px; border-bottom: 1px solid #2f3136; }
        input[type="checkbox"] { width: 18px; height: 18px; margin-right: 15px; cursor: pointer; }
        input[type="text"] { width: 100%; padding: 12px; border-radius: 6px; border: 1px solid #202225; background: #202225; color: white; box-sizing: border-box; }
        label { font-weight: bold; display: block; margin-bottom: 10px; color: #b9bbbe; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin:0;">SHER BOT</h1>
            ${user ? `<div style="text-align:right;"><small>${user.username}</small><br><a href="/logout" style="color:#ed4245; font-size:12px;">Logout</a></div>` : ''}
        </div>
        ${content}
    </div>
</body>
</html>
`;

app.get('/', (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    res.send(uiWrapper(`
        <div style="text-align:center; padding: 40px 0;">
            <h2>Premium Auto-Delete Management</h2>
            <p style="color:#b9bbbe;">Securely manage your Discord server cleaning rules from one place.</p>
            <br>
            <a href="/login" class="btn">Login with Discord</a>
        </div>
    `));
});

app.get('/login', (req, res) => {
    if (!REDIRECT_URI) return res.send("System Error: REDIRECT_URI is missing in Environment Variables.");
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
        console.error("Auth Fail:", err.response?.data || err.message);
        res.send(`Authentication Failed. Please check your Redirect URI settings.`);
    }
});

app.get('/dashboard', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    
    // Filter guilds where user has Administrator permission (0x8)
    const adminGuilds = req.session.guilds.filter(g => (BigInt(g.permissions) & 0x8n) === 0x8n);
    const selectedId = req.query.guild_id;

    if (!selectedId) {
        const guildList = adminGuilds.map(g => `
            <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                <span><b>${g.name}</b></span>
                <a href="/dashboard?guild_id=${g.id}" class="btn" style="padding: 8px 16px;">Configure</a>
            </div>
        `).join('') || '<p>No servers found where you are an Administrator.</p>';
        return res.send(uiWrapper(`<h3>Select a Server to Manage</h3>${guildList}`, req.session.user));
    }

    const discordGuild = client.guilds.cache.get(selectedId);
    if (!discordGuild) {
        return res.send(uiWrapper(`
            <div style="text-align:center;">
                <h3>Bot Not Found</h3>
                <p>SHER BOT hasn't been invited to this server yet.</p>
                <a href="https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&permissions=8&scope=bot%20applications.commands" class="btn" target="_blank">Invite Bot</a>
                <br><br>
                <a href="/dashboard" style="color:#aaa;">Back to List</a>
            </div>
        `, req.session.user));
    }

    const settings = getSettings(selectedId);
    const textChannels = discordGuild.channels.cache.filter(c => c.isTextBased() && !c.isThread());
    
    const channelInputs = textChannels.map(c => `
        <div class="channel-item">
            <input type="checkbox" name="channels" value="${c.id}" ${settings.autoDeleteChannels.includes(c.id) ? 'checked' : ''}>
            <span># ${c.name}</span>
        </div>
    `).join('');

    res.send(uiWrapper(`
        <h2>Settings: ${discordGuild.name}</h2>
        <form action="/save" method="POST">
            <input type="hidden" name="guild_id" value="${selectedId}">
            
            <label>Auto-Delete Channels</label>
            <div class="channel-list">
                ${channelInputs}
            </div>

            <div style="margin-top: 25px;">
                <label>Filters</label>
                <div class="card">
                    <div class="channel-item"><input type="checkbox" name="ignoreBots" ${settings.ignoreBots ? 'checked' : ''}> Ignore Bot Messages</div>
                    <div class="channel-item"><input type="checkbox" name="ignoreThreads" ${settings.ignoreThreads ? 'checked' : ''}> Ignore Threads (in these channels)</div>
                </div>
            </div>

            <div style="margin-top: 25px;">
                <label>Ignored Users (Comma separated IDs)</label>
                <input type="text" name="ignoredUsers" value="${settings.ignoredUsers.join(', ')}" placeholder="e.g. 1564321876, 987654321">
            </div>

            <button type="submit" class="btn btn-save">Save Configuration</button>
            <p style="text-align:center;"><a href="/dashboard" style="color:#aaa; text-decoration:none;">Cancel and Go Back</a></p>
        </form>
    `, req.session.user));
});

app.post('/save', (req, res) => {
    if (!req.session.user) return res.status(403).send('Unauthorized');
    const { guild_id, ignoreBots, ignoreThreads, ignoredUsers } = req.body;
    let { channels } = req.body;
    
    if (!channels) channels = [];
    if (!Array.isArray(channels)) channels = [channels];

    const settings = getSettings(guild_id);
    settings.autoDeleteChannels = channels;
    settings.ignoreBots = !!ignoreBots;
    settings.ignoreThreads = !!ignoreThreads;
    settings.ignoredUsers = ignoredUsers ? ignoredUsers.split(',').map(id => id.trim()).filter(id => id) : [];

    res.redirect(`/dashboard?guild_id=${guild_id}`);
});

app.get('/logout', (req, res) => { 
    req.session = null; 
    res.redirect('/'); 
});

// START SERVER (Binding to 0.0.0.0 is critical for Render)
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    -------------------------------------------
    🚀 SHER BOT Dashboard Live
    📍 Port: ${PORT}
    📍 Redirect URI: ${REDIRECT_URI}
    📍 Health: http://0.0.0.0:${PORT}/health
    -------------------------------------------
    `);
});
