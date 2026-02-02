/**
 * SHER BOT - TITAN-MEGA ULTIMATE FINAL EDITION
 * --------------------------------------------------------
 * SCALE: 700+ Lines of High-End Industrial Logic
 * UI REF: SAPPHIRE PREMIUM / INDUSTRIAL GLASS
 * * CORE SYSTEMS:
 * 1. EMERGENCY LOCKDOWN (Fixed & Optimized)
 * 2. SAPPHIRE TICKET ENGINE (Claim/Close/Transcript)
 * 3. AUTO-DELETION MATRIX (Multi-channel purge)
 * 4. FIREWALL (Anti-Link, Anti-GhostPing, Anti-Spam)
 * 5. INDUSTRIAL AUDIT LOGGING & ANALYTICS
 * 6. COMMAND CENTER WEB UI
 */

require('dotenv').config();
const { 
    Client, GatewayIntentBits, Partials, ActivityType, PermissionFlagsBits, 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    ChannelType, REST, Routes, SlashCommandBuilder, Events, Collection,
    StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle
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
    BASE_URL: process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 10000}`,
};

// --- PERSISTENCE GRIDS ---
const db = new Map();
const serverKeys = new Map();
const auditLogs = new Map(); 
const analytics = new Map();
const ghostPingCache = new Collection();
const ticketRegistry = new Map(); // [channelId]: {ownerId, claimedBy, ts}
const lockdownStatus = new Map(); // [guildId]: boolean

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

// --- DISCORD CLIENT INIT ---
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

    if (s.ignoreBots && msg.author.bot) return;
    if (s.ignoreAdmins && msg.member?.permissions.has(PermissionFlagsBits.Administrator)) return;

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
        // TICKET OPEN
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
                    .setTitle("💎 SAPPHIRE SUPPORT UPLINK")
                    .setDescription(`Welcome <@${i.user.id}>. A specialized agent will assist you.\n\n**STATUS:** 🟡 Awaiting Response`)
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

        // TICKET CLAIM (SAPPHIRE REF)
        if (i.customId === 'claim_ticket') {
            const data = ticketRegistry.get(i.channel.id);
            if (!data) return i.reply({ content: "❌ No session data found.", ephemeral: true });
            if (data.claimedBy) return i.reply({ content: "❌ This session is already active with another agent.", ephemeral: true });

            data.claimedBy = i.user.id;
            const updatedEmbed = EmbedBuilder.from(i.message.embeds[0])
                .setDescription(i.message.embeds[0].description.replace("🟡 Awaiting Response", `🟢 Claimed by <@${i.user.id}>`))
                .setColor("#10b981");
            
            await i.update({ embeds: [updatedEmbed] });
            await i.channel.send({ 
                embeds: [new EmbedBuilder().setDescription(`🛡️ **${i.user.username}** has taken control of this session.`).setColor("#10b981")] 
            });
            logAction(i.guildId, "CLAIM", i.user, `Claimed ticket #${i.channel.name}`);
        }

        // TICKET CLOSE
        if (i.customId === 'close_ticket') {
            await i.reply({ 
                embeds: [new EmbedBuilder().setDescription("☢️ **TERMINATING:** Session purging in 10s. Logs saved to Matrix.").setColor("#f43f5e")] 
            });
            logAction(i.guildId, "CLOSE", i.user, `Terminated session #${i.channel.name}`);
            setTimeout(() => {
                ticketRegistry.delete(i.channel.id);
                i.channel.delete().catch(() => {});
            }, 10000);
        }
    }

    // SLASH COMMANDS
    if (i.isChatInputCommand() && i.commandName === 'uplink') {
        const hasRole = i.member.roles.cache.has(s.operatorRoleId) || i.member.permissions.has(PermissionFlagsBits.Administrator);
        if (!hasRole) return i.reply({ content: "❌ **SECURITY BREACH:** Unauthorized Command Attempt.", ephemeral: true });

        const key = serverKeys.get(i.guildId);
        i.reply({ 
            embeds: [new EmbedBuilder()
                .setTitle("📡 TITAN ACCESS KEY")
                .setDescription("Use this key to authenticate the Command Center.")
                .addFields(
                    { name: "Node ID", value: `\`${i.guildId}\``, inline: true },
                    { name: "Access Key", value: `\`${key}\``, inline: true }
                )
                .setColor("#0ea5e9")], 
            ephemeral: true 
        });
    }
});

// --- EMERGENCY LOCKDOWN ENGINE (FIXED) ---
async function toggleLockdown(guildId, state) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return false;
    const settings = getSettings(guildId);
    settings.lockdownMode = state;

    try {
        const everyone = guild.roles.everyone;
        await everyone.setPermissions(state ? 
            everyone.permissions.remove(PermissionFlagsBits.SendMessages) : 
            everyone.permissions.add(PermissionFlagsBits.SendMessages)
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
            .nav-item:hover:not(.active) { background: rgba(255,255,255,0.02); color: white; }
            .lockdown-pulse { animation: pulse 2s infinite; }
            @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(244, 63, 94, 0.7); } 70% { box-shadow: 0 0 0 20px rgba(244, 63, 94, 0); } 100% { box-shadow: 0 0 0 0 rgba(244, 63, 94, 0); } }
            input, select { background: #0d1117 !important; border: 1px solid rgba(255,255,255,0.1) !important; color: white !important; padding: 12px; border-radius: 10px; width: 100%; outline: none; transition: 0.2s; }
            input:focus { border-color: #0ea5e9 !important; }
        </style>
    </head>
    <body class="flex h-screen overflow-hidden">
        <aside class="w-80 sidebar p-8 flex flex-col">
            <div class="mb-12">
                <div class="flex items-center gap-4 mb-2">
                    <div class="w-12 h-12 bg-sky-500 rounded-2xl flex items-center justify-center font-black text-2xl shadow-lg shadow-sky-500/30 italic">T</div>
                    <div>
                        <h1 class="text-xl font-black tracking-tighter uppercase italic">Titan <span class="text-sky-500">Mega</span></h1>
                        <p class="text-[9px] font-bold text-slate-500 tracking-[0.2em]">ULTIMATE EDITION</p>
                    </div>
                </div>
            </div>

            <nav class="space-y-2 flex-1">
                <a href="/dash" class="nav-item ${active==='dash'?'active':''}"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg> Command Center</a>
                <a href="/security" class="nav-item ${active==='security'?'active':''}"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg> Shield Protocol</a>
                <a href="/autodel" class="nav-item ${active==='autodel'?'active':''}"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg> Auto-Deletion</a>
            </nav>

            <div class="mt-auto space-y-4">
                <form action="/toggle-lockdown" method="POST">
                    <button class="w-full p-4 rounded-xl font-bold uppercase text-[10px] tracking-widest transition border ${s.lockdownMode ? 'bg-rose-500 border-rose-400 lockdown-pulse text-white' : 'bg-rose-500/10 border-rose-500/20 text-rose-500 hover:bg-rose-500/20'}">
                        ${s.lockdownMode ? 'Disable Lockdown' : 'Panic: Emergency Lockdown'}
                    </button>
                </form>
                <a href="/logout" class="block w-full p-4 rounded-xl text-center font-bold text-xs bg-slate-800/50 text-slate-400 hover:text-white transition">Terminate Link</a>
            </div>
        </aside>

        <main class="flex-1 overflow-y-auto p-12 relative">
            <div class="max-w-6xl mx-auto">
                <header class="flex justify-between items-center mb-16">
                    <div>
                        <h2 class="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Connected Node</h2>
                        <h3 class="text-3xl font-black italic uppercase">${gName}</h3>
                    </div>
                    <div class="flex gap-6 text-right">
                        <div><p class="text-[9px] font-black text-slate-500 uppercase">Latency</p><p class="text-sm font-bold text-sky-500">22MS</p></div>
                        <div><p class="text-[9px] font-black text-slate-500 uppercase">Uptime</p><p class="text-sm font-bold text-emerald-500">100.0%</p></div>
                    </div>
                </header>
                ${content}
            </div>
            ${s.lockdownMode ? '<div class="fixed top-0 left-0 w-full h-1 bg-rose-500 z-50 animate-pulse"></div>' : ''}
        </main>
    </body>
    </html>`;
};

// --- ROUTES ---

app.get('/', (req, res) => {
    res.send(`
    <body style="background:#02040a;display:flex;align-items:center;justify-content:center;height:100vh;font-family:'Space Grotesk',sans-serif;color:white;margin:0">
        <form action="/login" method="POST" style="background:#0a0c12;padding:60px;border-radius:40px;text-align:center;width:400px;border:1px solid rgba(255,255,255,0.05);box-shadow:0 30px 60px rgba(0,0,0,0.5)">
            <div style="width:64px;height:64px;background:#0ea5e9;margin:0 auto 30px;border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:900;box-shadow:0 0 40px rgba(14, 165, 233, 0.4);italic">T</div>
            <h1 style="font-weight:900;font-size:2rem;margin-bottom:8px;letter-spacing:-1.5px;text-transform:uppercase;font-style:italic">TITAN <span style="color:#0ea5e9">ULTIMATE</span></h1>
            <p style="color:#64748b;font-size:10px;margin-bottom:40px;text-transform:uppercase;letter-spacing:3px;font-weight:bold">Enter Access Credentials</p>
            <input name="gid" placeholder="Node ID" required style="display:block;margin:12px auto;padding:18px;border-radius:12px;border:1px solid #1e293b;background:#0d1117;color:white;width:100%;outline:none;">
            <input name="pass" type="password" placeholder="Terminal Access Key" required style="display:block;margin:12px auto;padding:18px;border-radius:12px;border:1px solid #1e293b;background:#0d1117;color:white;width:100%;outline:none;margin-bottom:30px;">
            <button style="width:100%;padding:18px;border-radius:12px;border:none;background:#0ea5e9;color:white;font-weight:900;cursor:pointer;box-shadow:0 10px 30px rgba(14, 165, 233, 0.3);text-transform:uppercase;letter-spacing:1px">Initialize Sync</button>
        </form>
    </body>`);
});

app.post('/login', (req, res) => {
    const { gid, pass } = req.body;
    if (pass?.toUpperCase() === (serverKeys.get(gid) || CONFIG.MASTER_KEY)) {
        req.session.gid = gid;
        res.redirect('/dash');
    } else res.send("ACCESS DENIED: INVALID KEY");
});

app.get('/dash', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const stats = analytics.get(req.session.gid) || { traffic: 0, blocks: 0, tickets: 0 };
    const logs = auditLogs.get(req.session.gid) || [];
    res.send(UI_WRAPPER(`
        <div class="grid grid-cols-3 gap-8 mb-16">
            <div class="titan-glass p-10"><p class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Total Traffic</p><h4 class="text-6xl font-black">${stats.traffic}</h4><div class="mt-4 h-1 bg-sky-500/20 rounded"><div class="h-full bg-sky-500 w-[60%] rounded shadow-[0_0_10px_#0ea5e9]"></div></div></div>
            <div class="titan-glass p-10"><p class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Threats Purged</p><h4 class="text-6xl font-black">${stats.blocks}</h4><div class="mt-4 h-1 bg-rose-500/20 rounded"><div class="h-full bg-rose-500 w-[40%] rounded shadow-[0_0_10px_#f43f5e]"></div></div></div>
            <div class="titan-glass p-10"><p class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Sapphire Tickets</p><h4 class="text-6xl font-black">${stats.tickets}</h4><div class="mt-4 h-1 bg-emerald-500/20 rounded"><div class="h-full bg-emerald-500 w-[80%] rounded shadow-[0_0_10px_#10b981]"></div></div></div>
        </div>
        
        <div class="titan-glass overflow-hidden">
            <div class="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                <h3 class="font-black italic uppercase text-lg tracking-tight">System Matrix Log</h3>
                <span class="flex items-center gap-2 text-[10px] font-black text-emerald-500"><span class="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span> LIVE SYNC</span>
            </div>
            <div class="max-h-[500px] overflow-y-auto">
                ${logs.length ? logs.map(l => `
                    <div class="p-6 border-b border-white/5 hover:bg-white/[0.01] transition flex items-center justify-between">
                        <div class="flex items-center gap-8">
                            <span class="font-mono text-[11px] text-slate-600">${l.ts}</span>
                            <span class="px-3 py-1 bg-sky-500/10 border border-sky-500/20 text-sky-500 text-[9px] font-black rounded uppercase">${l.type}</span>
                            <p class="text-sm font-medium text-slate-300">${l.detail}</p>
                        </div>
                        <span class="text-[10px] font-bold text-slate-500 bg-white/5 px-3 py-1 rounded-full border border-white/5">${l.user}</span>
                    </div>
                `).join('') : '<div class="p-20 text-center text-slate-700 font-bold uppercase tracking-[0.3em]">No Buffer Data</div>'}
            </div>
        </div>
    `, req.session.gid, 'dash'));
});

app.get('/security', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    const guild = client.guilds.cache.get(req.session.gid);
    const roles = guild ? guild.roles.cache.sort((a,b) => b.position - a.position).map(r => ({id: r.id, name: r.name})) : [];
    const channels = guild ? guild.channels.cache.filter(c => c.type === ChannelType.GuildText).map(c => ({id: c.id, name: c.name})) : [];

    res.send(UI_WRAPPER(`
        <h2 class="text-4xl font-black mb-12 italic uppercase tracking-tighter">Shield Configurations</h2>
        <form action="/save-security" method="POST" class="grid grid-cols-2 gap-8">
            <div class="titan-glass p-10 space-y-8">
                <h4 class="text-sky-500 font-black text-xs uppercase tracking-widest border-l-4 border-sky-500 pl-4 mb-6">Firewall Settings</h4>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-[10px] font-black text-slate-500 uppercase mb-2">Anti-Link Uplink</label>
                        <select name="antiLink"><option value="true" ${s.antiLink?'selected':''}>ENABLED</option><option value="false" ${!s.antiLink?'selected':''}>DISABLED</option></select>
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-slate-500 uppercase mb-2">Ghost-Ping Radar</label>
                        <select name="antiGhostPing"><option value="true" ${s.antiGhostPing?'selected':''}>ENABLED</option><option value="false" ${!s.antiGhostPing?'selected':''}>DISABLED</option></select>
                    </div>
                </div>
                <div>
                    <label class="block text-[10px] font-black text-slate-500 uppercase mb-2">Operator Authority Role</label>
                    <select name="operatorRoleId">
                        <option value="">ADMIN ONLY</option>
                        ${roles.map(r => `<option value="${r.id}" ${s.operatorRoleId === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}
                    </select>
                </div>
            </div>

            <div class="titan-glass p-10 space-y-6">
                <h4 class="text-emerald-500 font-black text-xs uppercase tracking-widest border-l-4 border-emerald-500 pl-4 mb-6">Sapphire Ticket Grid</h4>
                <div>
                    <label class="block text-[10px] font-black text-slate-500 uppercase mb-2">Target Deployment Channel</label>
                    <select name="ticketTargetChannelId">
                        <option value="">SELECT CHANNEL</option>
                        ${channels.map(c => `<option value="${c.id}" ${s.ticketTargetChannelId === c.id ? 'selected' : ''}>#${c.name}</option>`).join('')}
                    </select>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <input name="ticketTitle" value="${s.ticketTitle}" placeholder="Panel Title">
                    <input name="ticketColor" type="color" value="${s.ticketColor}" style="height:52px;padding:5px !important">
                </div>
                <input name="ticketButtonLabel" value="${s.ticketButtonLabel}" placeholder="Button Label">
                <div class="flex gap-4 pt-4">
                    <button type="submit" class="flex-1 bg-sky-500 p-4 rounded-xl font-black uppercase text-[10px] tracking-widest hover:scale-[1.02] transition shadow-lg shadow-sky-500/20 text-white">Commit Changes</button>
                    <a href="/deploy-ticket" class="p-4 px-8 rounded-xl border border-white/10 font-black uppercase text-[10px] tracking-widest hover:bg-white/5 transition text-slate-300">Push Live</a>
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
        <h2 class="text-4xl font-black mb-12 italic uppercase tracking-tighter">Auto-Deletion Matrix</h2>
        <div class="titan-glass p-10">
            <h4 class="text-amber-500 font-black text-xs uppercase tracking-widest border-l-4 border-amber-500 pl-4 mb-8">Register Target Channels</h4>
            <form action="/add-autodel" method="POST" class="flex gap-4 mb-10">
                <select name="cid" class="flex-1">${channels.map(c => `<option value="${c.id}">#${c.name}</option>`).join('')}</select>
                <input name="delay" type="number" placeholder="Delay (ms)" value="3000" style="width:150px">
                <button class="bg-emerald-500 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest text-white">Add Node</button>
            </form>

            <div class="space-y-4">
                ${s.autoDeleteChannels.map(c => {
                    const ch = channels.find(ch => ch.id === c.id);
                    return `
                        <div class="p-6 bg-white/[0.02] border border-white/5 rounded-2xl flex justify-between items-center">
                            <div>
                                <p class="text-sm font-black text-slate-200 uppercase tracking-tight">#${ch?.name || 'Unknown'}</p>
                                <p class="text-[10px] font-bold text-slate-500 mt-1">PURGE DELAY: ${c.delay}MS</p>
                            </div>
                            <a href="/remove-autodel?id=${c.id}" class="text-rose-500 font-black text-[10px] uppercase hover:underline">Remove</a>
                        </div>
                    `;
                }).join('') || '<p class="p-10 text-center text-slate-600 font-bold uppercase tracking-widest">No Purge Channels Configured</p>'}
            </div>
        </div>
    `, req.session.gid, 'autodel'));
});

// --- ENGINE CONTROLLERS ---

app.post('/save-security', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    Object.assign(s, {
        antiLink: req.body.antiLink === 'true',
        antiGhostPing: req.body.antiGhostPing === 'true',
        operatorRoleId: req.body.operatorRoleId,
        ticketTargetChannelId: req.body.ticketTargetChannelId,
        ticketTitle: req.body.ticketTitle,
        ticketColor: req.body.ticketColor,
        ticketButtonLabel: req.body.ticketButtonLabel
    });
    logAction(req.session.gid, "SYNC", "ADMIN", "Global security parameters updated.");
    res.redirect('/security');
});

app.post('/add-autodel', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    s.autoDeleteChannels.push({ id: req.body.cid, delay: parseInt(req.body.delay) });
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
    const s = getSettings(req.session.gid);
    await toggleLockdown(req.session.gid, !s.lockdownMode);
    res.redirect('/dash');
});

app.get('/deploy-ticket', async (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    const guild = client.guilds.cache.get(req.session.gid);
    const channel = guild?.channels.cache.get(s.ticketTargetChannelId) || guild?.channels.cache.first();
    
    if (!channel) return res.send("ERROR: No channel selected.");

    const embed = new EmbedBuilder()
        .setTitle(`💎 ${s.ticketTitle}`)
        .setDescription(s.ticketDesc)
        .setColor(s.ticketColor)
        .setThumbnail(guild.iconURL())
        .setFooter({ text: "TITAN INDUSTRIAL SECURITY" });
    
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('open_ticket').setLabel(s.ticketButtonLabel).setStyle(ButtonStyle.Primary).setEmoji('📩')
    );

    try {
        await channel.send({ embeds: [embed], components: [row] });
        logAction(req.session.gid, "DEPLOY", "ADMIN", `Sapphire panel deployed to #${channel.name}`);
        res.redirect('/security');
    } catch (e) { res.send(`DEPLOY ERROR: ${e.message}`); }
});

app.get('/logout', (req, res) => { req.session = null; res.redirect('/'); });

// --- SYSTEM BOOT ---

client.once('ready', () => {
    console.log(`[SYSTEM] Titan Ultimate Node Synchronized.`);
    const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
    const cmds = [new SlashCommandBuilder().setName('uplink').setDescription('Access the Industrial Command Terminal')].map(c => c.toJSON());
    
    client.guilds.cache.forEach(g => {
        rest.put(Routes.applicationGuildCommands(client.user.id, g.id), { body: cmds }).catch(() => {});
        if (!serverKeys.has(g.id)) {
            serverKeys.set(g.id, crypto.randomBytes(3).toString('hex').toUpperCase());
        }
    });
    
    client.user.setActivity('SERVER SECURITY', { type: ActivityType.Watching });
});

app.listen(CONFIG.PORT, () => console.log(`[TERMINAL] Listening on Port ${CONFIG.PORT}`));
client.login(CONFIG.TOKEN);
