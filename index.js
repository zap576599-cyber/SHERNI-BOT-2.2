/**
 * SHER BOT - TITAN-MEGA V-ELITE (OG RESTORED)
 * --------------------------------------------------------
 * A comprehensive security and management solution.
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
const auditLogs = new Map(); // Activity logs

const getSettings = (gid) => {
    if (!db.has(gid)) {
        db.set(gid, {
            autoDeleteChannels: [], // {id, delay}
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

// --- DISCORD LOGIC ---

// 1. DM Security Key on Join
client.on(Events.GuildCreate, async (guild) => {
    const key = crypto.randomBytes(3).toString('hex').toUpperCase();
    serverKeys.set(guild.id, key);
    
    try {
        const owner = await guild.fetchOwner();
        const welcome = new EmbedBuilder()
            .setTitle("🛡️ SHER BOT | TITAN-MEGA DEPLOYED")
            .setDescription(`Your node has been established in **${guild.name}**. Use the credentials below to access the Sapphire Command Center.`)
            .addFields(
                { name: "Node ID", value: `\`${guild.id}\``, inline: true },
                { name: "Access Key", value: `\`${key}\``, inline: true }
            )
            .setColor("#0ea5e9");
        await owner.send({ embeds: [welcome] });
    } catch (e) {
        console.log(`Could not DM owner of ${guild.id}`);
    }
});

// 2. Auto-Deletion & Bypass Matrix
client.on(Events.MessageCreate, async (msg) => {
    if (!msg.guild) return;
    const s = getSettings(msg.guild.id);

    // Bypass Logic
    if (s.ignoreBots && msg.author.bot) return;
    if (s.ignoreAdmins && msg.member?.permissions.has(PermissionFlagsBits.Administrator)) return;

    // Word Filter
    const hasForbidden = s.blacklistedWords.some(w => msg.content.toLowerCase().includes(w.toLowerCase()));
    if (hasForbidden) {
        await msg.delete().catch(() => {});
        return;
    }

    // Specific Channel Auto-Deletion
    const channelDel = s.autoDeleteChannels.find(c => c.id === msg.channel.id);
    if (channelDel) {
        setTimeout(() => msg.delete().catch(() => {}), channelDel.delay || 5000);
    }
});

// 3. Command Interactions (Slash Commands)
client.on(Events.InteractionCreate, async (i) => {
    const s = getSettings(i.guildId);

    if (i.isChatInputCommand()) {
        const { commandName, options } = i;

        if (commandName === 'terminal') {
            const key = serverKeys.get(i.guildId);
            return i.reply({ content: `📡 **Node ID:** \`${i.guildId}\`\n🔑 **Key:** \`${key}\`\n*Access key for the Command Center.*`, ephemeral: true });
        }

        if (commandName === 'lockdown') {
            if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) return i.reply("Unauthorized.");
            const state = options.getBoolean('state');
            const role = i.guild.roles.everyone;
            
            await role.setPermissions(state ? 
                role.permissions.remove(PermissionFlagsBits.SendMessages) : 
                role.permissions.add(PermissionFlagsBits.SendMessages)
            );
            s.lockdownActive = state;
            return i.reply(`🚨 Emergency Lockdown: **${state ? 'ACTIVATED' : 'DEACTIVATED'}**`);
        }

        if (commandName === 'ban') {
            if (!i.member.permissions.has(PermissionFlagsBits.BanMembers)) return i.reply("Insufficient permissions.");
            const user = i.options.getUser('target');
            await i.guild.members.ban(user);
            return i.reply(`🔨 Successfully banned **${user.tag}**`);
        }
    }

    // 4. Ticket Engine (Sapphire Style)
    if (i.isButton()) {
        if (i.customId === 'tkt_create') {
            await i.deferReply({ ephemeral: true });
            const channel = await i.guild.channels.create({
                name: `ticket-${i.user.username.slice(0,5)}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ]
            });

            const embed = new EmbedBuilder()
                .setTitle(s.ticketTitle)
                .setDescription("A staff member will assist you shortly.")
                .setColor(s.ticketColor);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('tkt_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger)
            );

            await channel.send({ content: `<@${i.user.id}>`, embeds: [embed], components: [row] });
            return i.editReply(`✅ Ticket created: ${channel}`);
        }

        if (i.customId === 'tkt_close') {
            await i.reply("🛡️ Terminating session in 5s...");
            setTimeout(() => i.channel.delete().catch(() => {}), 5000);
        }
    }
});

// --- WEB INTERFACE (SAPPHIRE DESIGN) ---
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
        <a href="/firewall" class="nav-link ${active==='firewall'?'active':''}">Firewall</a>
        <a href="/tickets" class="nav-link ${active==='tickets'?'active':''}">Ticket Panel</a>
        <a href="/logout" class="mt-auto nav-link text-rose-500">Disconnect</a>
    </nav>
    <main class="flex-1 p-12 overflow-y-auto">${content}</main>
</body>
</html>`;

app.get('/', (req, res) => res.send(`
    <body style="background:#020617; display:flex; align-items:center; justify-content:center; height:100vh; font-family:sans-serif;">
        <form action="/login" method="POST" style="background:#0f172a; padding:3.5rem; border-radius:2rem; width:400px; border:1px solid rgba(255,255,255,0.05); text-align:center;">
            <h2 style="color:#0ea5e9; font-size:2rem; font-weight:900; margin-bottom:2rem; font-style:italic;">SHER LOGIN</h2>
            <input name="gid" placeholder="Node ID" required style="width:100%; padding:1.2rem; margin-bottom:1rem; border-radius:0.75rem; border:1px solid #1e293b; background:#020617; color:white;">
            <input name="key" type="password" placeholder="Access Key" required style="width:100%; padding:1.2rem; margin-bottom:2rem; border-radius:0.75rem; border:1px solid #1e293b; background:#020617; color:white;">
            <button style="width:100%; padding:1.2rem; border-radius:0.75rem; border:none; background:#0ea5e9; color:white; font-weight:900; cursor:pointer;">ESTABLISH UPLINK</button>
        </form>
    </body>
`));

app.post('/login', (req, res) => {
    const { gid, key } = req.body;
    if (serverKeys.get(gid) === key.toUpperCase()) {
        req.session.gid = gid;
        res.redirect('/dash');
    } else res.send("Access Denied.");
});

app.get('/dash', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    res.send(UI_WRAPPER(`
        <h2 class="text-4xl font-black mb-10">System Overview</h2>
        <div class="grid grid-cols-2 gap-8">
            <div class="glass p-10">
                <p class="text-slate-500 font-bold uppercase text-xs mb-2">Emergency Status</p>
                <h3 class="text-3xl font-black ${s.lockdownActive?'text-rose-500':'text-emerald-500'}">${s.lockdownActive?'LOCKDOWN ACTIVE':'SECURE'}</h3>
            </div>
            <div class="glass p-10">
                <p class="text-slate-500 font-bold uppercase text-xs mb-2">Node Encryption</p>
                <h3 class="text-3xl font-black text-sky-500">TITAN-MEGA OG</h3>
            </div>
        </div>
    `));
});

app.get('/firewall', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    const guild = client.guilds.cache.get(req.session.gid);
    const channels = guild ? guild.channels.cache.filter(c => c.type === ChannelType.GuildText) : [];

    res.send(UI_WRAPPER(`
        <h2 class="text-4xl font-black mb-10">Firewall Matrix</h2>
        <div class="glass p-10">
            <form action="/add-autodel" method="POST" class="flex gap-4 mb-10">
                <select name="cid" class="flex-1 bg-slate-900 border border-slate-800 p-4 rounded-xl">
                    ${channels.map(c => `<option value="${c.id}">#${c.name}</option>`).join('')}
                </select>
                <input name="delay" type="number" placeholder="Delay (ms)" value="5000" class="w-32 bg-slate-900 border border-slate-800 p-4 rounded-xl text-white">
                <button class="bg-sky-500 px-10 font-black rounded-xl uppercase text-xs">Deploy Node</button>
            </form>
            <div class="space-y-4">
                ${s.autoDeleteChannels.map(rule => `
                    <div class="flex justify-between items-center p-6 bg-white/5 rounded-2xl border border-white/5">
                        <span class="font-bold text-sky-400">#${guild.channels.cache.get(rule.id)?.name}</span>
                        <span class="text-slate-500 text-xs font-bold uppercase">${rule.delay}ms Purge</span>
                        <a href="/del-rule?id=${rule.id}" class="text-rose-500 font-black text-xs uppercase">Deactivate</a>
                    </div>
                `).join('')}
            </div>
        </div>
    `, 'firewall'));
});

app.post('/add-autodel', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    s.autoDeleteChannels.push({ id: req.body.cid, delay: parseInt(req.body.delay) });
    res.redirect('/firewall');
});

app.get('/del-rule', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    s.autoDeleteChannels = s.autoDeleteChannels.filter(c => c.id !== req.query.id);
    res.redirect('/firewall');
});

app.get('/logout', (req, res) => { req.session = null; res.redirect('/'); });

// --- BOOT SEQUENCE ---
client.once('ready', async () => {
    console.log(`[TITAN] Online as ${client.user.tag}`);
    
    const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
    const commands = [
        new SlashCommandBuilder().setName('terminal').setDescription('View access key'),
        new SlashCommandBuilder().setName('lockdown').setDescription('Toggle server safety').addBooleanOption(o => o.setName('state').setDescription('True for Lockdown').setRequired(true)),
        new SlashCommandBuilder().setName('ban').setDescription('Remove a user').addUserOption(o => o.setName('target').setDescription('User').setRequired(true)),
        new SlashCommandBuilder().setName('setup-panel').setDescription('Deploy ticket button')
    ].map(c => c.toJSON());

    try {
        await rest.put(Routes.applicationCommands(CONFIG.CLIENT_ID), { body: commands });
        console.log("[REST] Commands Synced.");
    } catch (e) { console.error(e); }
});

app.listen(CONFIG.PORT, () => console.log(`[WEB] Gateway on port ${CONFIG.PORT}`));
client.login(CONFIG.TOKEN);
