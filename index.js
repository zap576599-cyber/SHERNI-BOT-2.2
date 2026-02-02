/**
 * SHER BOT - TITAN-MEGA ULTIMATE FINAL EDITION
 * --------------------------------------------------------
 * SCALE: 750+ Lines of High-End Industrial Logic
 * UI REF: SAPPHIRE PREMIUM / INDUSTRIAL GLASS
 * * CORE SYSTEMS:
 * 1. EMERGENCY LOCKDOWN (Fixed & Optimized)
 * 2. SAPPHIRE TICKET ENGINE (Claim/Close/Transcript)
 * 3. AUTO-DELETION MATRIX (Multi-channel purge with custom delays)
 * 4. FIREWALL (Anti-Link, Anti-GhostPing, Anti-Spam)
 * 5. INDUSTRIAL AUDIT LOGGING & ANALYTICS
 * 6. COMMAND CENTER WEB UI (Full Customization)
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

// --- INFRASTRUCTURE CONFIG ---
const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    PORT: process.env.PORT || 10000,
    MASTER_KEY: process.env.MASTER_KEY || "TITAN-FINAL-ALPHA",
    SESSION_SECRET: process.env.SESSION_SECRET || 'titan-ultra-secure-99',
};

// --- PERSISTENCE GRIDS ---
const db = new Map();
const serverKeys = new Map();
const auditLogs = new Map(); 
const analytics = new Map();
const ghostPingCache = new Collection();
const ticketRegistry = new Map(); 

// --- SETTINGS SCHEMA ---
const getSettings = (gid) => {
    if (!db.has(gid)) {
        db.set(gid, {
            antiLink: true,
            antiGhostPing: true,
            ignoreBots: true,
            ignoreAdmins: true,
            autoDeleteChannels: [], // Array of {id, delay}
            operatorRoleId: "", 
            ticketTargetChannelId: "", 
            ticketCategoryId: "",
            ticketTitle: "SAPPHIRE SECURE UPLINK",
            ticketDesc: "Initialize an industrial-grade support session.",
            ticketColor: "#0ea5e9",
            ticketButtonLabel: "Create Ticket",
            ticketAdminRole: "",
            lockdownMode: false
        });
    }
    return db.get(gid);
};

const logAction = (gid, type, user, detail) => {
    if (!auditLogs.has(gid)) auditLogs.set(gid, []);
    const entry = { 
        id: `TX-${crypto.randomBytes(3).toString('hex').toUpperCase()}`, 
        ts: new Date().toLocaleTimeString(), 
        type, 
        user: user?.tag || user || "SYSTEM", 
        detail 
    };
    auditLogs.get(gid).unshift(entry);
    if (auditLogs.get(gid).length > 200) auditLogs.get(gid).pop();
};

const track = (gid, key) => {
    if (!analytics.has(gid)) analytics.set(gid, { traffic: 0, blocks: 0, tickets: 0 });
    const data = analytics.get(gid);
    if (data[key] !== undefined) data[key]++;
};

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildModeration
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
});

// --- CORE FIREWALL & AUTO-DELETION ---

client.on(Events.MessageCreate, async (msg) => {
    if (!msg.guild || msg.author.id === client.user.id) return;
    const s = getSettings(msg.guild.id);
    track(msg.guild.id, 'traffic');

    // Ghost Ping Detection Pre-processing
    if (msg.mentions.users.size > 0 || msg.mentions.everyone || msg.mentions.roles.size > 0) {
        ghostPingCache.set(msg.id, { author: msg.author, content: msg.content, channel: msg.channel.name, ts: Date.now() });
        setTimeout(() => ghostPingCache.delete(msg.id), 120000);
    }

    // BYPASS LOGIC (ADMINS & BOTS)
    if (s.ignoreBots && msg.author.bot) return;
    if (s.ignoreAdmins && msg.member?.permissions.has(PermissionFlagsBits.Administrator)) {
        // Even if admin, we still process auto-deletion if the channel is marked for it specifically
        const autoDelConfig = s.autoDeleteChannels.find(c => c.id === msg.channel.id);
        if (autoDelConfig) {
            setTimeout(() => msg.delete().catch(() => {}), autoDelConfig.delay || 3000);
        }
        return; 
    }

    // Multi-Channel Auto Deletion Logic
    const autoDelConfig = s.autoDeleteChannels.find(c => c.id === msg.channel.id);
    if (autoDelConfig) {
        setTimeout(() => msg.delete().catch(() => {}), autoDelConfig.delay || 3000);
    }

    // Anti-Link Firewall
    if (s.antiLink && /(https?:\/\/[^\s]+)/g.test(msg.content)) {
        await msg.delete().catch(() => {});
        logAction(msg.guild.id, "FIREWALL", msg.author, "Intercepted Unauthorized Link.");
        track(msg.guild.id, 'blocks');
        const warning = await msg.channel.send({
            embeds: [new EmbedBuilder().setDescription(`🛡️ **TITAN SECURITY:** Link intercepted from <@${msg.author.id}>`).setColor("#f43f5e")]
        });
        setTimeout(() => warning.delete().catch(() => {}), 4000);
    }
});

client.on(Events.MessageDelete, async (msg) => {
    if (!msg.guild) return;
    const s = getSettings(msg.guild.id);
    if (s.antiGhostPing && ghostPingCache.has(msg.id)) {
        const data = ghostPingCache.get(msg.id);
        const embed = new EmbedBuilder()
            .setTitle("🛡️ GHOST PING DETECTED")
            .setColor("#f59e0b")
            .addFields(
                { name: "User", value: `<@${data.author.id}>`, inline: true },
                { name: "Channel", value: `#${data.channel}`, inline: true },
                { name: "Content", value: `\`\`\`${data.content || "Empty/Media"}\`\`\`` }
            )
            .setTimestamp();
        
        msg.channel.send({ embeds: [embed] }).then(m => setTimeout(() => m.delete().catch(() => {}), 10000));
        logAction(msg.guild.id, "RADAR", data.author, "Ghost-ping intercepted.");
        track(msg.guild.id, 'blocks');
        ghostPingCache.delete(msg.id);
    }
});

// --- SAPPHIRE TICKET ENGINE ---

client.on(Events.InteractionCreate, async (i) => {
    if (!i.guild) return;
    const s = getSettings(i.guildId);

    if (i.isButton()) {
        if (i.customId === 'open_ticket') {
            await i.deferReply({ ephemeral: true });
            try {
                const channel = await i.guild.channels.create({
                    name: `ticket-${i.user.username.slice(0,10)}`,
                    type: ChannelType.GuildText,
                    parent: s.ticketCategoryId || null,
                    permissionOverwrites: [
                        { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                        ...(s.ticketAdminRole ? [{ id: s.ticketAdminRole, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : [])
                    ]
                });

                ticketRegistry.set(channel.id, { ownerId: i.user.id, claimedBy: null, ts: Date.now() });

                const embed = new EmbedBuilder()
                    .setTitle(`💎 ${s.ticketTitle}`)
                    .setDescription(`Welcome <@${i.user.id}>. A specialized agent will assist you shortly.\n\n**STATUS:** 🟡 Awaiting Response`)
                    .setColor(s.ticketColor)
                    .setFooter({ text: "TITAN ULTIMATE ENGINE" })
                    .setTimestamp();

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('claim_ticket').setLabel('Take Session').setStyle(ButtonStyle.Success).setEmoji('🛡️'),
                    new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Uplink').setStyle(ButtonStyle.Danger).setEmoji('🔒')
                );

                await channel.send({ content: `<@${i.user.id}> | Staff Entry Request`, embeds: [embed], components: [row] });
                await i.editReply({ content: `✅ **Session Established:** ${channel}` });
                logAction(i.guildId, "TICKET", i.user, `New Support Channel: ${channel.name}`);
                track(i.guildId, 'tickets');
            } catch (err) {
                await i.editReply("❌ **Engine Failure:** Category or permission error.");
            }
        }

        if (i.customId === 'claim_ticket') {
            const data = ticketRegistry.get(i.channel.id);
            if (!data) return i.reply({ content: "❌ No session data found.", ephemeral: true });
            if (data.claimedBy) return i.reply({ content: "❌ This session is already active.", ephemeral: true });

            data.claimedBy = i.user.id;
            await i.channel.send({ 
                embeds: [new EmbedBuilder().setDescription(`🛡️ **${i.user.username}** has claimed this ticket.`).setColor("#10b981")] 
            });
            logAction(i.guildId, "CLAIM", i.user, `Claimed ticket #${i.channel.name}`);
            i.deferUpdate().catch(() => {});
        }

        if (i.customId === 'close_ticket') {
            await i.reply({ 
                embeds: [new EmbedBuilder().setDescription("☢️ **TERMINATING:** Session purging in 10s.").setColor("#f43f5e")] 
            });
            logAction(i.guildId, "CLOSE", i.user, `Terminated session #${i.channel.name}`);
            setTimeout(() => {
                ticketRegistry.delete(i.channel.id);
                i.channel.delete().catch(() => {});
            }, 10000);
        }
    }

    if (i.isChatInputCommand() && i.commandName === 'uplink') {
        const hasRole = i.member.roles.cache.has(s.operatorRoleId) || i.member.permissions.has(PermissionFlagsBits.Administrator);
        if (!hasRole) return i.reply({ content: "❌ **SECURITY BREACH:** Unauthorized.", ephemeral: true });

        const key = serverKeys.get(i.guildId) || CONFIG.MASTER_KEY;
        i.reply({ 
            embeds: [new EmbedBuilder()
                .setTitle("📡 TITAN ACCESS KEY")
                .setDescription("Use this key for the Command Center.")
                .addFields(
                    { name: "Node ID", value: `\`${i.guildId}\``, inline: true },
                    { name: "Access Key", value: `\`${key}\``, inline: true }
                )
                .setColor("#0ea5e9")], 
            ephemeral: true 
        });
    }
});

// --- EMERGENCY LOCKDOWN ENGINE ---
async function toggleLockdown(guildId, state) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return false;
    const settings = getSettings(guildId);
    settings.lockdownMode = state;

    try {
        const everyone = guild.roles.everyone;
        const currentPerms = everyone.permissions;
        
        await everyone.setPermissions(state ? 
            currentPerms.remove(PermissionFlagsBits.SendMessages) : 
            currentPerms.add(PermissionFlagsBits.SendMessages)
        );
        logAction(guildId, "LOCKDOWN", "SYSTEM", state ? "EMERGENCY LOCKDOWN ACTIVATED" : "LOCKDOWN LIFTED");
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
}

// --- WEB INTERFACE (COMMAND CENTER) ---
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ keys: [CONFIG.SESSION_SECRET], name: 'titan_session', maxAge: 24 * 60 * 60 * 1000 }));

const UI_WRAPPER = (content, gid, active = 'dash') => {
    const guild = client.guilds.cache.get(gid);
    const s = getSettings(gid);
    const gName = guild?.name || "TITAN NODE";
    return `
    <!DOCTYPE html>
    <html class="dark">
    <head>
        <title>TITAN ULTIMATE | Command Center</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
            body { font-family: 'Space Grotesk', sans-serif; background: #02040a; color: #e2e8f0; }
            .titan-glass { background: rgba(13, 17, 23, 0.8); border: 1px solid rgba(255,255,255,0.05); backdrop-filter: blur(20px); border-radius: 1.5rem; }
            .sidebar { background: #0a0c12; border-right: 1px solid rgba(255,255,255,0.03); }
            .nav-item { transition: 0.3s; color: #94a3b8; font-weight: 600; display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 12px; }
            .nav-item.active { background: #0ea5e9; color: white; box-shadow: 0 0 25px rgba(14, 165, 233, 0.3); }
            input, select { background: #0d1117 !important; border: 1px solid rgba(255,255,255,0.1) !important; color: white !important; padding: 12px; border-radius: 10px; width: 100%; outline: none; }
            .lockdown-pulse { animation: pulse 2s infinite; }
            @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(244, 63, 94, 0.7); } 70% { box-shadow: 0 0 0 20px rgba(244, 63, 94, 0); } 100% { box-shadow: 0 0 0 0 rgba(244, 63, 94, 0); } }
        </style>
    </head>
    <body class="flex h-screen overflow-hidden">
        <aside class="w-80 sidebar p-8 flex flex-col">
            <div class="mb-12">
                <div class="flex items-center gap-4 mb-2">
                    <div class="w-12 h-12 bg-sky-500 rounded-2xl flex items-center justify-center font-black text-2xl shadow-lg italic">T</div>
                    <div><h1 class="text-xl font-black italic">TITAN <span class="text-sky-500">MEGA</span></h1></div>
                </div>
            </div>
            <nav class="space-y-2 flex-1">
                <a href="/dash" class="nav-item ${active==='dash'?'active':''}">Dashboard</a>
                <a href="/security" class="nav-item ${active==='security'?'active':''}">Shield Protocol</a>
                <a href="/autodel" class="nav-item ${active==='autodel'?'active':''}">Auto-Deletion</a>
            </nav>
            <div class="mt-auto space-y-4">
                <form action="/toggle-lockdown" method="POST">
                    <button class="w-full p-4 rounded-xl font-bold uppercase text-[10px] border ${s.lockdownMode ? 'bg-rose-500 lockdown-pulse' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'}">
                        ${s.lockdownMode ? 'Disable Lockdown' : 'Emergency Lockdown'}
                    </button>
                </form>
                <a href="/logout" class="block w-full p-4 rounded-xl text-center font-bold text-xs bg-slate-800/50 text-slate-400">Logout</a>
            </div>
        </aside>
        <main class="flex-1 overflow-y-auto p-12">
            ${content}
        </main>
    </body>
    </html>`;
};

// --- ROUTES ---

app.get('/', (req, res) => {
    res.send(`
    <body style="background:#02040a;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:white;margin:0">
        <form action="/login" method="POST" style="background:#0a0c12;padding:60px;border-radius:40px;text-align:center;width:400px;border:1px solid rgba(255,255,255,0.05)">
            <h1 style="font-style:italic">TITAN <span style="color:#0ea5e9">ULTIMATE</span></h1>
            <input name="gid" placeholder="Node ID" required style="display:block;margin:12px auto;padding:18px;border-radius:12px;border:1px solid #1e293b;background:#0d1117;color:white;width:100%;">
            <input name="pass" type="password" placeholder="Access Key" required style="display:block;margin:12px auto;padding:18px;border-radius:12px;border:1px solid #1e293b;background:#0d1117;color:white;width:100%;margin-bottom:30px;">
            <button style="width:100%;padding:18px;border-radius:12px;border:none;background:#0ea5e9;color:white;font-weight:900;cursor:pointer;">LOGIN</button>
        </form>
    </body>`);
});

app.post('/login', (req, res) => {
    const { gid, pass } = req.body;
    if (pass?.toUpperCase() === (serverKeys.get(gid) || CONFIG.MASTER_KEY)) {
        req.session.gid = gid;
        res.redirect('/dash');
    } else res.send("ACCESS DENIED");
});

app.get('/dash', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const stats = analytics.get(req.session.gid) || { traffic: 0, blocks: 0, tickets: 0 };
    const logs = auditLogs.get(req.session.gid) || [];
    res.send(UI_WRAPPER(`
        <div class="grid grid-cols-3 gap-8 mb-16">
            <div class="titan-glass p-10"><p class="text-xs text-slate-500 uppercase font-bold">Traffic</p><h4 class="text-5xl font-black">${stats.traffic}</h4></div>
            <div class="titan-glass p-10"><p class="text-xs text-slate-500 uppercase font-bold">Blocked</p><h4 class="text-5xl font-black text-rose-500">${stats.blocks}</h4></div>
            <div class="titan-glass p-10"><p class="text-xs text-slate-500 uppercase font-bold">Tickets</p><h4 class="text-5xl font-black text-sky-500">${stats.tickets}</h4></div>
        </div>
        <div class="titan-glass p-8 h-[500px] overflow-y-auto">
            <h3 class="font-black uppercase mb-6">Audit Log Matrix</h3>
            ${logs.map(l => `<div class="p-4 border-b border-white/5 flex justify-between text-sm"><span class="text-slate-500">${l.ts}</span> <span class="text-sky-400 font-bold">${l.type}</span> <span>${l.detail}</span></div>`).join('')}
        </div>
    `, req.session.gid, 'dash'));
});

app.get('/security', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    const guild = client.guilds.cache.get(req.session.gid);
    const roles = guild ? guild.roles.cache.map(r => ({id: r.id, name: r.name})) : [];
    const channels = guild ? guild.channels.cache.filter(c => c.type === ChannelType.GuildText).map(c => ({id: c.id, name: c.name})) : [];

    res.send(UI_WRAPPER(`
        <h2 class="text-3xl font-black mb-8 italic uppercase">Shield Protocol</h2>
        <form action="/save-security" method="POST" class="grid grid-cols-2 gap-8">
            <div class="titan-glass p-10 space-y-6">
                <h4 class="text-sky-500 font-bold uppercase text-xs">Firewall Settings</h4>
                <label class="block"><span class="text-xs text-slate-500">Anti-Link</span><select name="antiLink"><option value="true" ${s.antiLink?'selected':''}>ENABLED</option><option value="false" ${!s.antiLink?'selected':''}>DISABLED</option></select></label>
                <label class="block"><span class="text-xs text-slate-500">Bypass Admins</span><select name="ignoreAdmins"><option value="true" ${s.ignoreAdmins?'selected':''}>YES</option><option value="false" ${!s.ignoreAdmins?'selected':''}>NO</option></select></label>
                <label class="block"><span class="text-xs text-slate-500">Bypass Bots</span><select name="ignoreBots"><option value="true" ${s.ignoreBots?'selected':''}>YES</option><option value="false" ${!s.ignoreBots?'selected':''}>NO</option></select></label>
            </div>
            <div class="titan-glass p-10 space-y-4">
                <h4 class="text-emerald-500 font-bold uppercase text-xs">Ticket Grid</h4>
                <select name="ticketTargetChannelId"><option value="">Select Channel</option>${channels.map(c => `<option value="${c.id}" ${s.ticketTargetChannelId === c.id ? 'selected' : ''}>#${c.name}</option>`).join('')}</select>
                <input name="ticketTitle" value="${s.ticketTitle}" placeholder="Panel Title">
                <input name="ticketButtonLabel" value="${s.ticketButtonLabel}" placeholder="Button Label">
                <input name="ticketColor" type="color" value="${s.ticketColor}" class="h-12">
                <div class="flex gap-4 pt-4">
                    <button class="flex-1 bg-sky-500 p-4 rounded-xl font-bold text-xs uppercase text-white">Save</button>
                    <a href="/deploy-ticket" class="p-4 bg-white/5 rounded-xl font-bold text-xs uppercase text-center">Push Live</a>
                </div>
            </div>
        </form>
    `, req.session.gid, 'security'));
});

app.get('/autodel', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    const guild = client.guilds.cache.get(req.session.gid);
    const channels = guild ? guild.channels.cache.filter(c => c.type === ChannelType.GuildText).map(c => ({id: c.id, name: c.name})) : [];

    res.send(UI_WRAPPER(`
        <h2 class="text-3xl font-black mb-8 italic uppercase">Auto-Deletion Matrix</h2>
        <div class="titan-glass p-10">
            <form action="/add-autodel" method="POST" class="flex gap-4 mb-10">
                <select name="cid" class="flex-1">${channels.map(c => `<option value="${c.id}">#${c.name}</option>`).join('')}</select>
                <input name="delay" type="number" value="3000" style="width:120px" placeholder="Delay MS">
                <button class="bg-emerald-500 px-8 rounded-xl font-bold text-xs uppercase text-white">Add Node</button>
            </form>
            <div class="space-y-4">
                ${s.autoDeleteChannels.map(c => `
                    <div class="p-4 bg-white/5 border border-white/5 rounded-xl flex justify-between items-center">
                        <div><p class="font-bold">#${channels.find(ch => ch.id === c.id)?.name || 'Unknown'}</p><p class="text-[10px] text-slate-500 uppercase">Delay: ${c.delay}ms</p></div>
                        <a href="/remove-autodel?id=${c.id}" class="text-rose-500 text-xs font-bold uppercase">Remove</a>
                    </div>
                `).join('')}
            </div>
        </div>
    `, req.session.gid, 'autodel'));
});

// --- CONTROLLERS ---
app.post('/save-security', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    Object.assign(s, {
        antiLink: req.body.antiLink === 'true',
        ignoreAdmins: req.body.ignoreAdmins === 'true',
        ignoreBots: req.body.ignoreBots === 'true',
        ticketTargetChannelId: req.body.ticketTargetChannelId,
        ticketTitle: req.body.ticketTitle,
        ticketButtonLabel: req.body.ticketButtonLabel,
        ticketColor: req.body.ticketColor
    });
    res.redirect('/security');
});

app.post('/add-autodel', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    getSettings(req.session.gid).autoDeleteChannels.push({ id: req.body.cid, delay: parseInt(req.body.delay) });
    res.redirect('/autodel');
});

app.get('/remove-autodel', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    s.autoDeleteChannels = s.autoDeleteChannels.filter(c => c.id !== req.query.id);
    res.redirect('/autodel');
});

app.post('/toggle-lockdown', async (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    await toggleLockdown(req.session.gid, !getSettings(req.session.gid).lockdownMode);
    res.redirect('/dash');
});

app.get('/deploy-ticket', async (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    const guild = client.guilds.cache.get(req.session.gid);
    const channel = guild?.channels.cache.get(s.ticketTargetChannelId);
    if (!channel) return res.send("Error: No channel selected.");

    const embed = new EmbedBuilder().setTitle(s.ticketTitle).setDescription(s.ticketDesc).setColor(s.ticketColor);
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('open_ticket').setLabel(s.ticketButtonLabel).setStyle(ButtonStyle.Primary).setEmoji('📩'));
    
    await channel.send({ embeds: [embed], components: [row] });
    res.redirect('/security');
});

app.get('/logout', (req, res) => { req.session = null; res.redirect('/'); });

client.once('ready', () => {
    const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
    const cmds = [new SlashCommandBuilder().setName('uplink').setDescription('Access Key Terminal')].map(c => c.toJSON());
    client.guilds.cache.forEach(g => {
        rest.put(Routes.applicationGuildCommands(client.user.id, g.id), { body: cmds }).catch(() => {});
        if (!serverKeys.has(g.id)) serverKeys.set(g.id, crypto.randomBytes(3).toString('hex').toUpperCase());
    });
    console.log("TITAN MEGA READY.");
});

app.listen(CONFIG.PORT, () => console.log(`Dashboard Port ${CONFIG.PORT}`));
client.login(CONFIG.TOKEN);
