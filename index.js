require('dotenv').config();
const { Client, GatewayIntentBits, Partials, REST, Routes, PermissionsBitField } = require('discord.js');
const express = require('express');
const session = require('cookie-session');
const bodyParser = require('body-parser');
const axios = require('axios');

// --- CONFIGURATION ---
// Load these from environment variables in Render
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI; // e.g., https://your-app.onrender.com/callback
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'supersecretkey';

// --- IN-MEMORY DATABASE ---
// NOTE: On free hosting like Render (free tier), this data resets if the bot restarts.
// For production, replace this with MongoDB, SQLite, or Firestore.
const db = {
    settings: new Map() // Key: GuildID, Value: Object
};

function getSettings(guildId) {
    if (!db.settings.has(guildId)) {
        db.settings.set(guildId, {
            autoDeleteChannels: [], // Array of Channel IDs
            ignoreBots: false,
            ignoreThreads: false,
            ignoredUsers: [], // Array of User IDs
        });
    }
    return db.settings.get(guildId);
}

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

// 1. Slash Command Registration
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
    console.log(`Logged in as ${client.user.tag}`);
    try {
        console.log('Started refreshing application (/) commands.');
        // Registers commands globally (can take up to an hour to update cache, instant for guild-specific)
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
});

// 2. Message Event (Auto Delete Logic)
client.on('messageCreate', async (message) => {
    if (!message.guild) return;

    const settings = getSettings(message.guild.id);
    
    // Check if channel is monitored
    if (settings.autoDeleteChannels.includes(message.channel.id)) {
        
        // Check Ignored Users
        if (settings.ignoredUsers.includes(message.author.id)) return;

        // Check Ignore Bots
        if (settings.ignoreBots && message.author.bot) return;

        // Check Ignore Threads (If message is inside a thread)
        if (settings.ignoreThreads && message.channel.isThread()) return;

        // DELETE
        try {
            // Small delay to ensure it's processed
            setTimeout(async () => {
                if (message.deletable) await message.delete();
            }, 1000);
        } catch (err) {
            console.error(`Failed to delete message in ${message.guild.name}:`, err);
        }
    }
});

// 3. Interaction Handler (Slash Commands)
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    // Security: Only allow Admins to use these commands
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: 'You do not have Administrator permissions.', ephemeral: true });
    }

    const { commandName } = interaction;
    const targetUser = interaction.options.getUser('user');
    const member = interaction.guild.members.cache.get(targetUser.id);

    if (!member) return interaction.reply({ content: 'User not found in this server.', ephemeral: true });

    if (commandName === 'ban') {
        const reason = interaction.options.getString('reason') || 'No reason provided';
        try {
            await member.ban({ reason });
            await interaction.reply({ content: `🚫 **${targetUser.tag}** has been banned. Reason: ${reason}` });
        } catch (error) {
            await interaction.reply({ content: 'Failed to ban user. Check my role hierarchy.', ephemeral: true });
        }
    } else if (commandName === 'timeout') {
        const minutes = interaction.options.getInteger('minutes');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        try {
            await member.timeout(minutes * 60 * 1000, reason);
            await interaction.reply({ content: `⏳ **${targetUser.tag}** has been timed out for ${minutes} minutes.` });
        } catch (error) {
            await interaction.reply({ content: 'Failed to timeout user. Check my role hierarchy.', ephemeral: true });
        }
    }
});

client.login(TOKEN);

// --- WEB DASHBOARD (Express) ---
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    name: 'session',
    keys: [SESSION_SECRET],
    maxAge: 24 * 60 * 60 * 1000
}));

// Basic HTML Template
const renderPage = (content, user = null) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bot Dashboard</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #2c2f33; color: white; margin: 0; padding: 0; }
        .navbar { background: #23272a; padding: 1rem; display: flex; justify-content: space-between; align-items: center; }
        .container { max-width: 800px; margin: 2rem auto; padding: 1rem; background: #23272a; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
        .btn { padding: 10px 20px; border-radius: 4px; text-decoration: none; font-weight: bold; cursor: pointer; border: none; }
        .btn-discord { background: #5865F2; color: white; }
        .btn-save { background: #43b581; color: white; margin-top: 1rem; }
        .form-group { margin-bottom: 1.5rem; border-bottom: 1px solid #444; padding-bottom: 1rem; }
        label { display: block; margin-bottom: 0.5rem; font-weight: bold; }
        select, input[type="text"] { width: 100%; padding: 8px; background: #40444b; border: 1px solid #2c2f33; color: white; border-radius: 4px; }
        .checkbox-group { display: flex; align-items: center; gap: 10px; }
        .logout { color: #f04747; text-decoration: none; margin-left: 15px; }
        .channel-list { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .channel-item { background: #2c2f33; padding: 5px; border-radius: 4px; display: flex; align-items: center; gap: 5px; }
    </style>
</head>
<body>
    <div class="navbar">
        <h2>🛡️ Auto-Mod Dashboard</h2>
        <div>
            ${user ? `<span>Logged in as ${user.username}</span> <a href="/logout" class="logout">Logout</a>` : ''}
        </div>
    </div>
    <div class="container">
        ${content}
    </div>
</body>
</html>
`;

// Routes
app.get('/', (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    res.send(renderPage(`
        <div style="text-align: center; padding: 2rem;">
            <h1>Welcome</h1>
            <p>Please login to configure the Auto-Delete Bot.</p>
            <a href="/login" class="btn btn-discord">Login with Discord</a>
        </div>
    `));
});

app.get('/login', (req, res) => {
    const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds`;
    res.redirect(url);
});

app.get('/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect('/');

    try {
        // Exchange code for token
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: REDIRECT_URI,
            scope: 'identify guilds'
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const { access_token } = tokenResponse.data;

        // Fetch User
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${access_token}` }
        });

        // Fetch Guilds
        const guildsResponse = await axios.get('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: `Bearer ${access_token}` }
        });

        req.session.user = userResponse.data;
        req.session.guilds = guildsResponse.data;
        
        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        res.send('Login failed.');
    }
});

app.get('/dashboard', async (req, res) => {
    if (!req.session.user) return res.redirect('/');

    // Filter guilds where user is Admin (Permission bit 0x8 is Admin)
    const adminGuilds = req.session.guilds.filter(g => (BigInt(g.permissions) & 0x8n) === 0x8n);

    // If a guild is selected via query param, show config
    const selectedGuildId = req.query.guild_id;
    
    if (!selectedGuildId) {
        // Show Guild Selection
        const guildListHtml = adminGuilds.map(g => 
            `<div style="margin: 10px 0; padding: 10px; background: #40444b; display: flex; justify-content: space-between; align-items: center;">
                <strong>${g.name}</strong>
                <a href="/dashboard?guild_id=${g.id}" class="btn btn-discord">Manage</a>
            </div>`
        ).join('');
        return res.send(renderPage(`<h3>Select a Server</h3>${guildListHtml}`, req.session.user));
    }

    // Verify user is still admin of selected guild (security check)
    const guild = adminGuilds.find(g => g.id === selectedGuildId);
    if (!guild) return res.redirect('/dashboard');

    // Fetch Channels and Current Settings
    const discordGuild = client.guilds.cache.get(selectedGuildId);
    if (!discordGuild) return res.send(renderPage(`<p>Bot is not in this server! Invite it first.</p>`, req.session.user));

    const settings = getSettings(selectedGuildId);
    const channels = discordGuild.channels.cache
        .filter(c => c.isTextBased() && !c.isThread())
        .map(c => ({ id: c.id, name: c.name }));

    const channelInputs = channels.map(c => `
        <div class="channel-item">
            <input type="checkbox" name="channels" value="${c.id}" ${settings.autoDeleteChannels.includes(c.id) ? 'checked' : ''}>
            #${c.name}
        </div>
    `).join('');

    const html = `
        <h3>Configuring: ${guild.name}</h3>
        <form action="/save" method="POST">
            <input type="hidden" name="guild_id" value="${guild.id}">
            
            <div class="form-group">
                <label>Auto-Delete Channels (Select Multiple)</label>
                <div class="channel-list">
                    ${channelInputs}
                </div>
            </div>

            <div class="form-group">
                <label>Settings</label>
                <div class="checkbox-group">
                    <input type="checkbox" name="ignoreBots" id="ignoreBots" ${settings.ignoreBots ? 'checked' : ''}>
                    <label for="ignoreBots" style="margin:0;">Ignore Bots (Don't delete bot messages)</label>
                </div>
                <div class="checkbox-group" style="margin-top: 10px;">
                    <input type="checkbox" name="ignoreThreads" id="ignoreThreads" ${settings.ignoreThreads ? 'checked' : ''}>
                    <label for="ignoreThreads" style="margin:0;">Ignore Threads (Don't delete messages inside threads)</label>
                </div>
            </div>

            <div class="form-group">
                <label>Ignored Users (User IDs, comma separated)</label>
                <input type="text" name="ignoredUsers" value="${settings.ignoredUsers.join(', ')}" placeholder="123456789, 987654321">
                <small style="color: #aaa;">Copy ID by enabling Developer Mode in Discord settings.</small>
            </div>

            <button type="submit" class="btn btn-save">Save Settings</button>
            <a href="/dashboard" style="margin-left: 10px; color: #aaa;">Back</a>
        </form>
    `;
    res.send(renderPage(html, req.session.user));
});

app.post('/save', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    
    const { guild_id, ignoreBots, ignoreThreads, ignoredUsers } = req.body;
    let { channels } = req.body;

    // Handle single vs multiple checkboxes (express quirk)
    if (!channels) channels = [];
    if (!Array.isArray(channels)) channels = [channels];

    const settings = getSettings(guild_id);
    
    settings.autoDeleteChannels = channels;
    settings.ignoreBots = !!ignoreBots;
    settings.ignoreThreads = !!ignoreThreads;
    
    // Parse User IDs
    settings.ignoredUsers = ignoredUsers 
        ? ignoredUsers.split(',').map(id => id.trim()).filter(id => id.length > 0)
        : [];

    console.log(`Updated settings for ${guild_id}:`, settings);
    res.redirect(`/dashboard?guild_id=${guild_id}`);
});

app.get('/logout', (req, res) => {
    req.session = null;
    res.redirect('/');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
