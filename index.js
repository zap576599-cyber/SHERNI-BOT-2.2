/**
 * SHER BOT - TITAN-MEGA V-ELITE (OG RESTORED)
 * --------------------------------------------------------
 * A comprehensive security and management solution.
 * FIXED: Web route handling & Command permissions
 */

require('dotenv').config();
const { 
    Client, GatewayIntentBits, Partials, ActivityType, PermissionFlagsBits, 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    ChannelType, REST, Routes, SlashCommandBuilder, Events, Collection
} = require('discord.js');
const express = require('express');
const session = require('cookie-session');
const bodyParser = require('body-parser');
const crypto = require('crypto');

// --- INITIALIZATION ---
const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    PORT: process.env.PORT || 10000,
    SESSION_SECRET: process.env.SESSION_SECRET || 'titan-mega-secret-v-elite',
};

// State Management
const db = new Map(); 
const serverKeys = new Map(); 

/**
 * Retrieves or initializes guild settings
 */
const getSettings = (gid) => {
    if (!db.has(gid)) {
        db.set(gid, {
            autoDeleteChannels: [],
            blacklistedWords: ["scam", "hack", "discord.gg"],
            ignoreAdmins: true,
            ignoreBots: true,
            ticketCategory: null,
            ticketTitle: "SHER SUPPORT",
            ticketColor: "#0ea5e9",
            lockdownActive: false
        });
    }
    return db.get(gid);
};

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildModeration
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

// --- KEY GENERATION UTILITY ---
const generateKeyForGuild = (guildId) => {
    const key = crypto.randomBytes(3).toString('hex').toUpperCase();
    serverKeys.set(guildId, key);
    return key;
};

// --- DISCORD LOGIC ---

// 1. New Guild Setup
client.on(Events.GuildCreate, async (guild) => {
    const key = generateKeyForGuild(guild.id);
    try {
        const owner = await guild.fetchOwner();
        const welcome = new EmbedBuilder()
            .setTitle("🛡️ SHER BOT | TITAN-MEGA DEPLOYED")
            .setDescription(`Your node has been established in **${guild.name}**. Use the credentials below to access the management terminal.`)
            .addFields(
                { name: "Node ID", value: `\`${guild.id}\``, inline: true },
                { name: "Access Key", value: `\`${key}\``, inline: true }
            )
            .setThumbnail(guild.iconURL())
            .setColor("#0ea5e9")
            .setFooter({ text: "TITAN-MEGA V-ELITE SECURITY" });
        await owner.send({ embeds: [welcome] });
    } catch (e) { console.log(`[!] DM failed for guild ${guild.id}`); }
});

// 2. Firewall / Auto-Purge Logic
client.on(Events.MessageCreate, async (msg) => {
    if (!msg.guild || msg.author.bot) return;
    const s = getSettings(msg.guild.id);
    
    if (s.ignoreAdmins && msg.member?.permissions.has(PermissionFlagsBits.Administrator)) return;

    // Word Filtering
    const hasForbidden = s.blacklistedWords.some(w => msg.content.toLowerCase().includes(w.toLowerCase()));
    if (hasForbidden) {
        return msg.delete().catch(() => {});
    }

    // Auto-Delete Timing
    const channelDel = s.autoDeleteChannels.find(c => c.id === msg.channel.id);
    if (channelDel) {
        setTimeout(() => msg.delete().catch(() => {}), channelDel.delay || 5000);
    }
});

// 3. Command Interactions
client.on(Events.InteractionCreate, async (i) => {
    if (!i.isChatInputCommand()) return;
    const s = getSettings(i.guildId);
    const { commandName, options } = i;

    if (commandName === 'terminal') {
        // SECURITY FIX: Only Admins should see the key
        if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return i.reply({ content: "Access Denied: High-level clearance required.", ephemeral: true });
        }

        let key = serverKeys.get(i.guildId);
        if(!key) key = generateKeyForGuild(i.guildId);
        return i.reply({ 
            content: `📡 **Node Uplink Established**\n**ID:** \`${i.guildId}\`\n**Key:** \`${key}\`\n\n*Keep these credentials private.*`, 
            ephemeral: true 
        });
    }

    if (commandName === 'lockdown') {
        if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return i.reply({ content: "Insufficient clearance level.", ephemeral: true });
        }
        const state = options.getBoolean('state');
        const role = i.guild.roles.everyone;
        
        try {
            await role.setPermissions(state 
                ? role.permissions.remove(PermissionFlagsBits.SendMessages) 
                : role.permissions.add(PermissionFlagsBits.SendMessages)
            );
            s.lockdownActive = state;
            return i.reply(`🚨 **Lockdown Protocol ${state ? 'ENABLED' : 'DISABLED'}**`);
        } catch (e) {
            return i.reply("Critical Error: Failed to modify server permissions.");
        }
    }
});

// --- WEB INTERFACE (TITAN-UI) ---
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ 
    name: 'titan_sess',
    keys: [CONFIG.SESSION_SECRET],
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
}));

const UI_WRAPPER = (content, active = 'dash') => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap" rel="stylesheet">
    <style>
        body { background: #020617; color: #f8fafc; font-family: 'Plus Jakarta Sans', sans-serif; }
        .glass { background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.05); backdrop-filter: blur(12px); border-radius: 1.25rem; }
        .nav-link { padding: 0.8rem 1.2rem; border-radius: 0.75rem; transition: 0.2s; color: #94a3b8; font-weight: 600; display: block; text-decoration: none; }
        .nav-link:hover { color: white; background: rgba(255,255,255,0.03); }
        .nav-link.active { background: #0ea5e9; color: white; box-shadow: 0 4px 20px rgba(14, 165, 233, 0.2); }
    </style>
</head>
<body class="flex h-screen overflow-hidden">
    <nav class="w-72 border-r border-slate-800 p-8 flex flex-col gap-2">
        <div class="mb-10 px-2">
            <h1 class="text-2xl font-black italic text-sky-500">SHER <span class="text-white">TITAN</span></h1>
            <p class="text-[10px] text-slate-500 font-bold tracking-widest uppercase mt-1">Mega V-Elite System</p>
        </div>
        <a href="/dash" class="nav-link ${active==='dash'?'active':''}">Dashboard</a>
        <a href="/firewall" class="nav-link ${active==='firewall'?'active':''}">Firewall Matrix</a>
        <a href="/logout" class="mt-auto nav-link text-rose-500 hover:bg-rose-500/10">Disconnect</a>
    </nav>
    <main class="flex-1 p-12 overflow-y-auto">${content}</main>
</body>
</html>`;

// Auth Routes
app.get('/', (req, res) => {
    if (req.session.gid) return res.redirect('/dash');
    res.send(`
    <body style="background:#020617; display:flex; align-items:center; justify-content:center; height:100vh; font-family:'Plus Jakarta Sans', sans-serif; color:white; margin:0;">
        <form action="/login" method="POST" style="background:#0f172a; padding:3.5rem; border-radius:2.5rem; width:400px; border:1px solid rgba(255,255,255,0.05); text-align:center;">
            <div style="width:64px; height:64px; background:#0ea5e9; border-radius:1.25rem; margin:0 auto 2rem; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:1.75rem;">S</div>
            <h2 style="font-size:1.75rem; font-weight:800; margin-bottom:0.5rem;">Secure Login</h2>
            <p style="color:#64748b; font-size:0.875rem; margin-bottom:2.5rem;">Establish encrypted uplink</p>
            <input name="gid" placeholder="Node ID" required style="width:100%; padding:1.2rem; margin-bottom:1rem; border-radius:1rem; border:1px solid #1e293b; background:#020617; color:white; outline:none;">
            <input name="key" type="password" placeholder="Access Key" required style="width:100%; padding:1.2rem; margin-bottom:2rem; border-radius:1rem; border:1px solid #1e293b; background:#020617; color:white; outline:none;">
            <button style="width:100%; padding:1.2rem; border-radius:1rem; border:none; background:#0ea5e9; color:white; font-weight:800; cursor:pointer;">CONNECT</button>
        </form>
    </body>`);
});

app.post('/login', (req, res) => {
    const { gid, key } = req.body;
    if (serverKeys.get(gid) === key.toUpperCase()) {
        req.session.gid = gid;
        res.redirect('/dash');
    } else res.redirect('/denied');
});

app.get('/denied', (req, res) => res.send(`
    <body style="background:#020617; display:flex; align-items:center; justify-content:center; height:100vh; font-family:'Plus Jakarta Sans', sans-serif; color:white; text-align:center;">
        <div style="background:#0f172a; padding:4rem; border-radius:2.5rem; border:1px solid #f43f5e;">
            <h1 style="color:#f43f5e; font-size:5rem; font-weight:900;">403</h1>
            <h2 style="font-size:1.75rem; font-weight:800;">UPLINK REJECTED</h2>
            <a href="/" style="display:inline-block; background:#1e293b; color:white; text-decoration:none; padding:1.2rem 2.5rem; border-radius:1rem; margin-top:2rem;">RE-AUTHENTICATE</a>
        </div>
    </body>
`));

// Protected Dashboard Routes
app.get('/dash', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    const guild = client.guilds.cache.get(req.session.gid);
    res.send(UI_WRAPPER(`<h2 class="text-4xl font-black mb-10">Command Center</h2><div class="grid grid-cols-2 gap-8 mb-8"><div class="glass p-10 border-l-4 border-sky-500"><p class="text-slate-500 font-bold uppercase text-[10px] mb-2">Node ID</p><h3 class="text-3xl font-black">${req.session.gid}</h3></div><div class="glass p-10 border-l-4 ${s.lockdownActive ? 'border-rose-500' : 'border-emerald-500'}"><p class="text-slate-500 font-bold uppercase text-[10px] mb-2">Shield Status</p><h3 class="text-3xl font-black">${s.lockdownActive ? 'LOCKDOWN' : 'SECURE'}</h3></div></div>`));
});

app.get('/firewall', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    const guild = client.guilds.cache.get(req.session.gid);
    const channels = guild ? guild.channels.cache.filter(c => c.type === ChannelType.GuildText) : [];
    res.send(UI_WRAPPER(`<h2 class="text-4xl font-black mb-10">Firewall Matrix</h2><div class="glass p-10 mb-8"><form action="/add-autodel" method="POST" class="flex gap-4"><select name="cid" class="flex-1 bg-slate-900 border border-slate-800 p-4 rounded-2xl text-white outline-none">${channels.map(c => `<option value="${c.id}">#${c.name}</option>`).join('')}</select><input name="delay" type="number" value="5000" class="w-40 bg-slate-900 border border-slate-800 p-4 rounded-2xl text-white outline-none"><button class="bg-sky-500 px-10 font-black rounded-2xl uppercase text-xs">Deploy</button></form></div>`, 'firewall'));
});

// FIX: Added handler for the firewall form
app.post('/add-autodel', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const { cid, delay } = req.body;
    const s = getSettings(req.session.gid);
    s.autoDeleteChannels.push({ id: cid, delay: parseInt(delay) });
    res.redirect('/firewall');
});

app.get('/logout', (req, res) => { req.session = null; res.redirect('/'); });

// --- BOOT SEQUENCE ---
client.once('ready', async () => {
    console.log(`[BOOT] TITAN ONLINE: ${client.user.tag}`);
    client.guilds.cache.forEach(guild => { if (!serverKeys.has(guild.id)) generateKeyForGuild(guild.id); });
    const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
    const commands = [
        new SlashCommandBuilder().setName('terminal').setDescription('View access credentials'),
        new SlashCommandBuilder().setName('lockdown').setDescription('Toggle message permissions').addBooleanOption(o => o.setName('state').setRequired(true))
    ].map(c => c.toJSON());
    try { await rest.put(Routes.applicationCommands(CONFIG.CLIENT_ID), { body: commands }); } catch (e) { console.error(e); }
});

app.listen(CONFIG.PORT, () => console.log(`[HTTP] Active on ${CONFIG.PORT}`));
client.login(CONFIG.TOKEN);
