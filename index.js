/**
 * SHER BOT - TITAN-MEGA V-ELITE (OG RESTORED)
 * --------------------------------------------------------
 * A comprehensive security and management solution.
 * FIXED: Key Generation on boot & Aesthetic Error Screen
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

const db = new Map(); // Guild Settings
const serverKeys = new Map(); // Security Keys

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

// 1. Key generation on new guild join
client.on(Events.GuildCreate, async (guild) => {
    const key = generateKeyForGuild(guild.id);
    try {
        const owner = await guild.fetchOwner();
        const welcome = new EmbedBuilder()
            .setTitle("🛡️ SHER BOT | TITAN-MEGA DEPLOYED")
            .setDescription(`Your node has been established in **${guild.name}**.`)
            .addFields(
                { name: "Node ID", value: `\`${guild.id}\``, inline: true },
                { name: "Access Key", value: `\`${key}\``, inline: true }
            )
            .setColor("#0ea5e9");
        await owner.send({ embeds: [welcome] });
    } catch (e) { console.log(`DM failed for ${guild.id}`); }
});

// 2. Auto-Deletion logic
client.on(Events.MessageCreate, async (msg) => {
    if (!msg.guild) return;
    const s = getSettings(msg.guild.id);
    if (s.ignoreBots && msg.author.bot) return;
    if (s.ignoreAdmins && msg.member?.permissions.has(PermissionFlagsBits.Administrator)) return;

    const hasForbidden = s.blacklistedWords.some(w => msg.content.toLowerCase().includes(w.toLowerCase()));
    if (hasForbidden) return msg.delete().catch(() => {});

    const channelDel = s.autoDeleteChannels.find(c => c.id === msg.channel.id);
    if (channelDel) setTimeout(() => msg.delete().catch(() => {}), channelDel.delay || 5000);
});

// 3. Slash Commands
client.on(Events.InteractionCreate, async (i) => {
    if (!i.isChatInputCommand()) return;
    const s = getSettings(i.guildId);
    const { commandName, options } = i;

    if (commandName === 'terminal') {
        let key = serverKeys.get(i.guildId);
        if(!key) key = generateKeyForGuild(i.guildId); // Fallback generation
        return i.reply({ content: `📡 **Node ID:** \`${i.guildId}\`\n🔑 **Key:** \`${key}\``, ephemeral: true });
    }

    if (commandName === 'lockdown') {
        if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) return i.reply("Access Denied.");
        const state = options.getBoolean('state');
        const role = i.guild.roles.everyone;
        await role.setPermissions(state ? role.permissions.remove(PermissionFlagsBits.SendMessages) : role.permissions.add(PermissionFlagsBits.SendMessages));
        s.lockdownActive = state;
        return i.reply(`🚨 Lockdown: **${state ? 'ON' : 'OFF'}**`);
    }
});

// --- WEB INTERFACE (UPDATED AESTHETICS) ---
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ keys: [CONFIG.SESSION_SECRET], name: 'sher_session' }));

const UI_WRAPPER = (content, active = 'dash') => `
<!DOCTYPE html>
<html lang="en">
<head>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap" rel="stylesheet">
    <style>
        body { background: #020617; color: #f8fafc; font-family: 'Plus Jakarta Sans', sans-serif; }
        .glass { background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.05); backdrop-filter: blur(12px); border-radius: 1.25rem; }
        .nav-link { padding: 0.8rem 1.2rem; border-radius: 0.75rem; transition: 0.2s; color: #94a3b8; font-weight: 600; display: block; }
        .nav-link.active { background: #0ea5e9; color: white; box-shadow: 0 4px 20px rgba(14, 165, 233, 0.2); }
    </style>
</head>
<body class="flex h-screen overflow-hidden">
    <nav class="w-72 border-r border-slate-800 p-8 flex flex-col gap-2">
        <h1 class="text-2xl font-black italic text-sky-500 mb-10">SHER <span class="text-white">TITAN</span></h1>
        <a href="/dash" class="nav-link ${active==='dash'?'active':''}">Dashboard</a>
        <a href="/firewall" class="nav-link ${active==='firewall'?'active':''}">Firewall Matrix</a>
        <a href="/logout" class="mt-auto nav-link text-rose-500">Disconnect</a>
    </nav>
    <main class="flex-1 p-12 overflow-y-auto">${content}</main>
</body>
</html>`;

app.get('/', (req, res) => res.send(`
    <body style="background:#020617; display:flex; align-items:center; justify-content:center; height:100vh; font-family:sans-serif; color:white;">
        <form action="/login" method="POST" style="background:#0f172a; padding:3.5rem; border-radius:2rem; width:400px; border:1px solid rgba(255,255,255,0.05); text-align:center;">
            <div style="width:60px; height:60px; background:#0ea5e9; border-radius:1rem; margin:0 auto 2rem; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:1.5rem; box-shadow: 0 0 30px rgba(14,165,233,0.3);">S</div>
            <h2 style="font-size:1.5rem; font-weight:900; margin-bottom:0.5rem;">Secure Login</h2>
            <p style="color:#64748b; font-size:0.875rem; margin-bottom:2rem;">Establish encrypted uplink with Titan Node</p>
            <input name="gid" placeholder="Node ID (Server ID)" required style="width:100%; padding:1.2rem; margin-bottom:1rem; border-radius:0.75rem; border:1px solid #1e293b; background:#020617; color:white;">
            <input name="key" type="password" placeholder="Access Key" required style="width:100%; padding:1.2rem; margin-bottom:2rem; border-radius:0.75rem; border:1px solid #1e293b; background:#020617; color:white;">
            <button style="width:100%; padding:1.2rem; border-radius:0.75rem; border:none; background:#0ea5e9; color:white; font-weight:900; cursor:pointer; transition: 0.3s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">CONNECT</button>
        </form>
    </body>
`));

app.post('/login', (req, res) => {
    const { gid, key } = req.body;
    if (serverKeys.get(gid) === key.toUpperCase()) {
        req.session.gid = gid;
        res.redirect('/dash');
    } else res.redirect('/denied');
});

// AESTHETIC ERROR SCREEN
app.get('/denied', (req, res) => res.send(`
    <body style="background:#020617; display:flex; align-items:center; justify-content:center; height:100vh; font-family:sans-serif; color:white; text-align:center;">
        <div style="background:#0f172a; padding:4rem; border-radius:2rem; border:1px solid #f43f5e; box-shadow: 0 0 50px rgba(244,63,94,0.1);">
            <h1 style="color:#f43f5e; font-size:4rem; font-weight:900; margin-bottom:1rem;">403</h1>
            <h2 style="font-size:1.5rem; font-weight:900; margin-bottom:1rem;">UPLINK REJECTED</h2>
            <p style="color:#94a3b8; max-width:300px; margin-bottom:2rem;">Your credentials do not match the encrypted records on this node.</p>
            <a href="/" style="display:inline-block; background:#1e293b; color:white; text-decoration:none; padding:1rem 2rem; border-radius:0.75rem; font-weight:bold;">RE-AUTHENTICATE</a>
        </div>
    </body>
`));

app.get('/dash', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    res.send(UI_WRAPPER(`
        <h2 class="text-4xl font-black mb-10">Command Center</h2>
        <div class="grid grid-cols-2 gap-8">
            <div class="glass p-10 border-l-4 border-sky-500">
                <p class="text-slate-500 font-bold uppercase text-xs mb-2">Node Identification</p>
                <h3 class="text-2xl font-black">${req.session.gid}</h3>
            </div>
            <div class="glass p-10 border-l-4 border-${s.lockdownActive?'rose-500':'emerald-500'}">
                <p class="text-slate-500 font-bold uppercase text-xs mb-2">Shield Status</p>
                <h3 class="text-2xl font-black">${s.lockdownActive?'CRITICAL LOCKDOWN':'SYSTEMS SECURE'}</h3>
            </div>
        </div>
    `));
});

app.get('/firewall', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    const guild = client.guilds.cache.get(req.session.gid);
    const channels = guild ? guild.channels.cache.filter(c => c.type === ChannelType.GuildText) : [];
    res.send(UI_WRAPPER(`<h2 class="text-4xl font-black mb-10">Matrix Settings</h2><div class="glass p-10">
        <p class="mb-4 text-slate-400">Configure channel auto-purging nodes below.</p>
        <form action="/add-autodel" method="POST" class="flex gap-4">
            <select name="cid" class="flex-1 bg-slate-900 border border-slate-800 p-4 rounded-xl text-white">
                ${channels.map(c => `<option value="${c.id}">#${c.name}</option>`).join('')}
            </select>
            <input name="delay" type="number" value="5000" class="w-32 bg-slate-900 border border-slate-800 p-4 rounded-xl text-white">
            <button class="bg-sky-500 px-10 font-black rounded-xl uppercase text-xs">Deploy</button>
        </form>
    </div>`, 'firewall'));
});

app.get('/logout', (req, res) => { req.session = null; res.redirect('/'); });

// --- BOOT SEQUENCE ---
client.once('ready', async () => {
    console.log(`[BOOT] TITAN ONLINE: ${client.user.tag}`);
    
    // CRITICAL: Generate keys for all guilds already joined
    client.guilds.cache.forEach(guild => {
        if (!serverKeys.has(guild.id)) {
            const key = generateKeyForGuild(guild.id);
            console.log(`[KEYGEN] ${guild.name} (${guild.id}): ${key}`);
        }
    });

    const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
    const commands = [
        new SlashCommandBuilder().setName('terminal').setDescription('View access credentials'),
        new SlashCommandBuilder().setName('lockdown').setDescription('Toggle safety').addBooleanOption(o => o.setName('state').setRequired(true))
    ].map(c => c.toJSON());

    try {
        await rest.put(Routes.applicationCommands(CONFIG.CLIENT_ID), { body: commands });
    } catch (e) { console.error(e); }
});

app.listen(CONFIG.PORT, () => console.log(`[HTTP] Gateway active on ${CONFIG.PORT}`));
client.login(CONFIG.TOKEN);
