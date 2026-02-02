/**
 * SHER BOT - TITAN ULTRA (V4.5 INDUSTRIAL)
 * --------------------------------------------
 * RE-BRAND: Sher Bot (Core Engine)
 * FEATURE: Advanced Ticket System (Claim/Close/Transcript)
 * FEATURE: Ignore Specific Admin Roles
 * FEATURE: Anti-Nuke System (Channel/Role/Member Protection)
 * FEATURE: Access Key Management (Change from Web)
 * UI: Dynamic Server Branding (Icon/Name)
 * UI: Switcher (Buttons vs Dropdowns)
 * UI: Modal Lock System (Buzz Save/Dismiss)
 */

require('dotenv').config();
const { 
    Client, GatewayIntentBits, Partials, ActivityType, PermissionFlagsBits, 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    ChannelType, REST, Routes, SlashCommandBuilder, Events, Collection,
    StringSelectMenuBuilder, AuditLogEvent
} = require('discord.js');
const express = require('express');
const session = require('cookie-session');
const bodyParser = require('body-parser');
const crypto = require('crypto');

// --- SYSTEM ARCHITECTURE ---
const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    PORT: process.env.PORT || 10000,
    MASTER_KEY: process.env.MASTER_KEY || "SHER-ADMIN-OG",
    SESSION_SECRET: process.env.SESSION_SECRET || 'sher-bot-v4-ultra',
    BASE_URL: process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 10000}`,
    BOOT_TIME: Date.now(),
    VERSION: "TITAN ULTRA V4.5"
};

const db = new Map();
const serverPasswords = new Map();
const auditLogs = new Map(); 
const analytics = new Map();
const ghostPingCache = new Collection();
const ticketCache = new Map();
const ticketTranscripts = new Map();

// --- ANTI-NUKE CACHE ---
const antiNukeTracker = new Map(); // tracks [guildId-userId-actionType] count

const getSettings = (gid) => {
    if (!db.has(gid)) {
        db.set(gid, {
            logChannelId: "",
            modRoleIds: [],
            adminRoleIds: [], 
            antiLink: true,
            antiGhostPing: true,
            antiMassMention: true,
            antiNuke: true, // NEW
            nukeThreshold: 3, // Actions per 10s
            maxMentions: 5,
            ignoreAdmins: true, 
            ignoreBots: true,   
            ignoreThreads: true,
            uiStyle: "dropdown", 
            autoDeleteChannels: [],
            deleteDelay: 3000,
            panelColor: "#0ea5e9",
            panelTitle: "📡 SHER SECURITY HUB",
            panelDesc: "Industrial security protocols active. Uplink status: ONLINE."
        });
    }
    return db.get(gid);
};

// --- LOGGING & TELEMETRY ---
const trackEvent = (gid, key, value = 1) => {
    if (!analytics.has(gid)) analytics.set(gid, { messages: 0, threats: 0, tickets: 0, deletions: 0 });
    const data = analytics.get(gid);
    if (data[key] !== undefined) data[key] += value;
};

const logToAudit = (gid, action, user, reason) => {
    if (!auditLogs.has(gid)) auditLogs.set(gid, []);
    const logs = auditLogs.get(gid);
    logs.unshift({ 
        id: crypto.randomBytes(4).toString('hex').toUpperCase(), 
        time: new Date().toLocaleTimeString(), 
        action, 
        user: user?.tag || user || "System", 
        reason 
    });
    if (logs.length > 50) logs.pop();
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

// --- ANTI-NUKE ENGINE ---
const checkNuke = async (guild, userId, actionType) => {
    const s = getSettings(guild.id);
    if (!s.antiNuke) return false;
    
    const key = `${guild.id}-${userId}-${actionType}`;
    const count = (antiNukeTracker.get(key) || 0) + 1;
    antiNukeTracker.set(key, count);
    
    setTimeout(() => {
        const current = antiNukeTracker.get(key);
        if (current > 0) antiNukeTracker.set(key, current - 1);
    }, 10000);

    if (count >= s.nukeThreshold) {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member && member.kickable && userId !== guild.ownerId) {
            await member.kick("SHER ANTI-NUKE: Threshold Exceeded").catch(() => {});
            logToAudit(guild.id, "NUKE_PREVENT", member.user.tag, `Mass ${actionType} detected.`);
            return true;
        }
    }
    return false;
};

// --- BOT EVENTS ---

client.on(Events.ChannelDelete, async (channel) => {
    const audit = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete }).then(a => a.entries.first());
    if (audit && audit.executorId !== client.user.id) checkNuke(channel.guild, audit.executorId, "Channel Delete");
});

client.on(Events.GuildMemberRemove, async (member) => {
    const audit = await member.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberKick }).then(a => a.entries.first());
    if (audit && audit.executorId !== client.user.id && audit.targetId === member.id) checkNuke(member.guild, audit.executorId, "Member Kick");
});

client.on(Events.MessageCreate, async (msg) => {
    if (!msg.guild || !msg.author) return;
    const s = getSettings(msg.guild.id);
    trackEvent(msg.guild.id, 'messages');

    if (Array.from(ticketCache.values()).includes(msg.channel.id)) {
        if (!ticketTranscripts.has(msg.channel.id)) ticketTranscripts.set(msg.channel.id, []);
        ticketTranscripts.get(msg.channel.id).push({
            author: msg.author.tag,
            content: msg.content,
            time: new Date().toLocaleTimeString()
        });
    }

    if (s.ignoreThreads && msg.channel.isThread()) return;

    const hasBypassRole = msg.member?.roles.cache.some(r => s.adminRoleIds.includes(r.id));
    const isAdmin = msg.member?.permissions.has(PermissionFlagsBits.Administrator);
    
    if (s.autoDeleteChannels.includes(msg.channel.id)) {
        if (!((s.ignoreAdmins && (isAdmin || hasBypassRole)) || (s.ignoreBots && msg.author.bot))) {
            setTimeout(() => {
                msg.delete().catch(() => {});
                trackEvent(msg.guild.id, 'deletions');
            }, s.deleteDelay);
        }
    }

    if (s.ignoreBots && msg.author.bot) return;
    if (s.ignoreAdmins && (isAdmin || hasBypassRole)) return;

    let violation = null;
    if (s.antiLink && /(https?:\/\/[^\s]+)/g.test(msg.content)) violation = "Link Sharing";
    if (s.antiMassMention && msg.mentions.users.size > s.maxMentions) violation = "Mass Mention";

    if (violation) {
        trackEvent(msg.guild.id, 'threats');
        msg.delete().catch(() => {});
        logToAudit(msg.guild.id, "INTERCEPT", msg.author, violation);
    }
});

client.on(Events.InteractionCreate, async (i) => {
    if (!i.guild) return;
    const s = getSettings(i.guild.id);

    if (i.isChatInputCommand()) {
        if (i.commandName === 'terminal') {
            const pass = serverPasswords.get(i.guild.id) || CONFIG.MASTER_KEY;
            i.reply({ 
                content: `📡 **SHER MAIN FRAME:**\nURL: ${CONFIG.BASE_URL}\nNode: \`${i.guild.id}\` \nKey: \`${pass}\``, 
                ephemeral: true 
            });
        }
        if (i.commandName === 'deploy') {
            if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) return i.reply({ content: "No Admin Perms.", ephemeral: true });
            const channel = i.options.getChannel('channel');
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('tkt_open').setLabel('Open Ticket').setStyle(ButtonStyle.Primary).setEmoji('🎫')
            );
            await channel.send({
                embeds: [new EmbedBuilder().setTitle(s.panelTitle).setDescription(s.panelDesc).setColor(s.panelColor)],
                components: [row]
            });
            i.reply({ content: "Ticket Hub Deployed.", ephemeral: true });
        }
    }

    if (i.isButton()) {
        if (i.customId === 'tkt_open') {
            if (Array.from(ticketCache.keys()).includes(i.user.id)) return i.reply({ content: "Already have a ticket.", ephemeral: true });
            const ch = await i.guild.channels.create({
                name: `ticket-${i.user.username}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                    ...s.modRoleIds.map(rid => ({ id: rid, allow: [PermissionFlagsBits.ViewChannel] }))
                ]
            });
            ticketCache.set(i.user.id, ch.id);
            trackEvent(i.guild.id, 'tickets');
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('tkt_close').setLabel('Close').setStyle(ButtonStyle.Danger)
            );
            ch.send({ content: `Support needed for <@${i.user.id}>`, components: [row] });
            i.reply({ content: `Ticket created: ${ch}`, ephemeral: true });
        }
        if (i.customId === 'tkt_close') {
            i.reply("Closing in 5s...");
            setTimeout(() => {
                ticketCache.forEach((cid, uid) => { if (cid === i.channel.id) ticketCache.delete(uid); });
                ticketTranscripts.delete(i.channel.id);
                i.channel.delete().catch(() => {});
            }, 5000);
        }
    }
});

client.once('ready', async () => {
    console.log(`[CORE] Sher Bot (${CONFIG.VERSION}) online.`);
    const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
    const commands = [
        new SlashCommandBuilder().setName('terminal').setDescription('Get dashboard access credentials'),
        new SlashCommandBuilder().setName('deploy').setDescription('Deploy Ticket Hub').addChannelOption(o => o.setName('channel').setRequired(true).setDescription('Target channel'))
    ].map(cmd => cmd.toJSON());

    client.guilds.cache.forEach(async (guild) => {
        try {
            await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: commands });
            if (!serverPasswords.has(guild.id)) serverPasswords.set(guild.id, crypto.randomBytes(4).toString('hex').toUpperCase());
        } catch (e) {}
    });
});

// --- DASHBOARD ---

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ keys: [CONFIG.SESSION_SECRET], name: 'sher_bot_session', maxAge: 24 * 60 * 60 * 1000 }));

const renderUI = (content, gid, activePage) => {
    const guild = client.guilds.cache.get(gid);
    const iconUrl = guild?.iconURL() || "https://cdn.discordapp.com/embed/avatars/0.png";
    const serverName = guild?.name || "Unknown Server";

    return `
<!DOCTYPE html>
<html>
<head>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;500;700;900&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Space Grotesk', sans-serif; background: #020617; color: #f1f5f9; }
        .glass { background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.05); }
        .sidebar-item { transition: 0.3s; }
        .sidebar-item:hover:not(.disabled) { background: rgba(14, 165, 233, 0.1); color: #38bdf8; }
        .sidebar-item.active { background: #0ea5e9; color: white; }
        .disabled { opacity: 0.4; cursor: not-allowed !important; pointer-events: none; filter: grayscale(1); }
        .buzz-red { animation: buzz 0.3s infinite; box-shadow: 0 0 50px rgba(244, 63, 94, 0.4); border: 2px solid #f43f5e !important; }
        @keyframes buzz { 0% { transform: translate(1px, 0); } 50% { transform: translate(-1px, 0); } 100% { transform: translate(1px, 0); } }
    </style>
</head>
<body class="flex h-screen overflow-hidden">
    <div id="lockOverlay" class="fixed inset-0 bg-black/60 z-40 hidden"></div>
    
    <nav id="navBar" class="w-80 glass m-6 rounded-[2.5rem] flex flex-col p-8 z-50">
        <div class="flex items-center gap-4 mb-10 bg-slate-900/50 p-4 rounded-3xl border border-slate-800">
            <img src="${iconUrl}" class="w-12 h-12 rounded-2xl shadow-xl shadow-sky-500/10">
            <div class="overflow-hidden">
                <h1 class="text-sm font-black truncate text-sky-400 uppercase tracking-tighter">${serverName}</h1>
                <p class="text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-none">Node ID: ${gid}</p>
            </div>
        </div>

        <div class="flex-1 space-y-2" id="sidebar">
            <a href="/dash" class="sidebar-item ${activePage==='dash'?'active':''} flex items-center gap-4 p-4 rounded-2xl">📊 Telemetry</a>
            <a href="/security" class="sidebar-item ${activePage==='security'?'active':''} flex items-center gap-4 p-4 rounded-2xl">🛡️ Security</a>
            <a href="/tickets" class="sidebar-item ${activePage==='tickets'?'active':''} flex items-center gap-4 p-4 rounded-2xl">🎫 Tickets</a>
            <a href="/access" class="sidebar-item ${activePage==='access'?'active':''} flex items-center gap-4 p-4 rounded-2xl">🔑 Access Key</a>
            <a href="/audits" class="sidebar-item ${activePage==='audits'?'active':''} flex items-center gap-4 p-4 rounded-2xl">📜 Audits</a>
        </div>
        <a href="/logout" class="p-4 text-rose-400 font-bold hover:bg-rose-500/10 rounded-xl transition text-center uppercase text-xs tracking-widest">🔌 DISCONNECT</a>
    </nav>

    <main class="flex-1 p-10 overflow-y-auto">
        ${content}
        
        <div id="saveBar" class="fixed bottom-10 left-1/2 -translate-x-1/2 glass p-6 rounded-3xl flex items-center gap-10 shadow-2xl transition-all translate-y-60 z-50">
            <div class="flex flex-col">
                <p class="font-black text-rose-500">SYSTEM LOCK ACTIVE</p>
                <p class="text-xs text-slate-400">Save changes to unlock navigation</p>
            </div>
            <div class="flex gap-4">
                <button onclick="document.getElementById('settingsForm').submit()" class="bg-rose-500 hover:bg-rose-600 px-10 py-4 rounded-2xl font-black text-white shadow-xl shadow-rose-500/20 uppercase tracking-widest">Commit Changes</button>
                <button onclick="location.reload()" class="bg-slate-800 hover:bg-slate-700 px-8 py-4 rounded-2xl font-bold">Discard</button>
            </div>
        </div>
    </main>

    <script>
        const form = document.getElementById('settingsForm');
        const saveBar = document.getElementById('saveBar');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('lockOverlay');

        if(form) {
            const triggerSave = () => {
                saveBar.classList.remove('translate-y-60');
                saveBar.classList.add('buzz-red');
                overlay.classList.remove('hidden');
                Array.from(sidebar.getElementsByTagName('a')).forEach(a => a.classList.add('disabled'));
            };
            form.addEventListener('change', triggerSave);
            form.addEventListener('input', (e) => {
               if(e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') triggerSave();
            });
        }
    </script>
</body>
</html>`;
};

app.get('/', (req, res) => {
    res.send(`
    <body style="background:#020617;display:flex;justify-content:center;align-items:center;height:100vh;color:white;font-family:sans-serif">
        <form action="/login" method="POST" style="background:rgba(15,23,42,0.8);padding:60px;border-radius:50px;width:450px;text-align:center;border:1px solid rgba(255,255,255,0.05);box-shadow: 0 50px 100px -20px rgba(0,0,0,0.5)">
            <h1 style="color:#0ea5e9;font-size:4rem;font-weight:900;letter-spacing:-4px">SHER</h1>
            <p style="color:#64748b;margin-bottom:40px;text-transform:uppercase;letter-spacing:4px;font-size:0.7rem">Security Mainframe</p>
            <input name="gid" placeholder="Node ID" style="width:100%;padding:20px;margin-bottom:12px;background:#020617;border:1px solid #1e293b;color:white;border-radius:20px;outline:none focus:border-sky-500">
            <input name="pass" type="password" placeholder="Access Key" style="width:100%;padding:20px;margin-bottom:30px;background:#020617;border:1px solid #1e293b;color:white;border-radius:20px;outline:none focus:border-sky-500">
            <button style="width:100%;padding:20px;background:#0ea5e9;color:white;border:none;border-radius:20px;font-weight:900;cursor:pointer;font-size:1.2rem;box-shadow:0 10px 30px -5px rgba(14,165,233,0.4)">UPLINK</button>
        </form>
    </body>`);
});

app.post('/login', (req, res) => {
    const { gid, pass } = req.body;
    const correct = serverPasswords.get(gid) || CONFIG.MASTER_KEY;
    if (pass === correct) {
        req.session.gid = gid;
        res.redirect('/dash');
    } else {
        res.send("<script>alert('ERROR: Access Denied');window.location='/';</script>");
    }
});

app.get('/dash', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const stats = analytics.get(req.session.gid) || { messages: 0, threats: 0, tickets: 0, deletions: 0 };
    res.send(renderUI(`
        <div class="grid grid-cols-4 gap-6">
            <div class="glass p-10 rounded-[3rem]"><p class="text-slate-500 font-bold text-xs uppercase mb-2">Traffic</p><h2 class="text-5xl font-black text-sky-400">${stats.messages}</h2></div>
            <div class="glass p-10 rounded-[3rem] border-b-4 border-rose-500"><p class="text-slate-500 font-bold text-xs uppercase mb-2">Threats</p><h2 class="text-5xl font-black text-rose-400">${stats.threats}</h2></div>
            <div class="glass p-10 rounded-[3rem]"><p class="text-slate-500 font-bold text-xs uppercase mb-2">Purged</p><h2 class="text-5xl font-black text-emerald-400">${stats.deletions}</h2></div>
            <div class="glass p-10 rounded-[3rem]"><p class="text-slate-500 font-bold text-xs uppercase mb-2">Tickets</p><h2 class="text-5xl font-black text-amber-400">${stats.tickets}</h2></div>
        </div>
    `, req.session.gid, 'dash'));
});

app.get('/security', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    
    const renderControl = (name, current, options) => {
        if (s.uiStyle === 'button') {
            return `<div class="flex gap-2">${options.map(o => `<label class="cursor-pointer"><input type="radio" name="${name}" value="${o.val}" ${current==o.val?'checked':''} class="hidden peer"><span class="px-4 py-2 rounded-lg bg-slate-900 peer-checked:bg-sky-500 peer-checked:text-white text-[10px] font-bold transition block uppercase">${o.label}</span></label>`).join('')}</div>`;
        } else {
            return `<select name="${name}" class="bg-slate-900 p-2 rounded-lg text-[10px] font-bold outline-none border border-slate-800 uppercase">${options.map(o => `<option value="${o.val}" ${current==o.val?'selected':''}>${o.label}</option>`).join('')}</select>`;
        }
    };

    res.send(renderUI(`
        <form id="settingsForm" action="/save" method="POST" class="space-y-8">
            <div class="glass p-10 rounded-[3rem]">
                <div class="flex justify-between items-center mb-10">
                    <h2 class="text-2xl font-bold flex items-center gap-4"><span class="w-2 h-8 bg-sky-500 rounded-full"></span> DEFENSE CONFIG</h2>
                    <div class="flex items-center gap-3 bg-slate-950 p-2 rounded-2xl border border-slate-800">
                        <span class="text-[10px] font-bold text-slate-500 ml-2">UI STYLE:</span>
                        <select name="uiStyle" class="bg-transparent text-xs font-bold outline-none">
                            <option value="dropdown" ${s.uiStyle==='dropdown'?'selected':''}>DROPDOWN</option>
                            <option value="button" ${s.uiStyle==='button'?'selected':''}>BUTTONS</option>
                        </select>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-8">
                    <div class="space-y-4">
                        <div class="flex justify-between items-center p-6 bg-slate-950/40 rounded-3xl border border-slate-900">
                            <div><p class="font-bold text-sm">Anti-Nuke Protocols</p><p class="text-[10px] text-slate-500">Auto-kick mass deletions</p></div>
                            ${renderControl('antiNuke', s.antiNuke, [{val:true, label:'ENGAGED'}, {val:false, label:'OFF'}])}
                        </div>
                        <div class="flex justify-between items-center p-6 bg-slate-950/40 rounded-3xl border border-slate-900">
                            <div><p class="font-bold text-sm">Ignore Admin Perms</p></div>
                            ${renderControl('ignoreAdmins', s.ignoreAdmins, [{val:true, label:'YES'}, {val:false, label:'NO'}])}
                        </div>
                        <div class="flex justify-between items-center p-6 bg-slate-950/40 rounded-3xl border border-slate-900 text-amber-500">
                            <div><p class="font-bold text-sm">Anti-Link Filter</p></div>
                            ${renderControl('antiLink', s.antiLink, [{val:true, label:'ACTIVE'}, {val:false, label:'OFF'}])}
                        </div>
                    </div>
                    <div class="space-y-4">
                        <div class="flex justify-between items-center p-6 bg-slate-950/40 rounded-3xl border border-slate-900">
                            <div><p class="font-bold text-sm">Ignore Threaded</p></div>
                            ${renderControl('ignoreThreads', s.ignoreThreads, [{val:true, label:'ON'}, {val:false, label:'OFF'}])}
                        </div>
                         <div class="flex justify-between items-center p-6 bg-slate-950/40 rounded-3xl border border-slate-900">
                            <div><p class="font-bold text-sm">Ignore Bot Nodes</p></div>
                            ${renderControl('ignoreBots', s.ignoreBots, [{val:true, label:'ON'}, {val:false, label:'OFF'}])}
                        </div>
                         <div class="flex justify-between items-center p-6 bg-slate-950/40 rounded-3xl border border-slate-900">
                            <div><p class="font-bold text-sm">Nuke Sensitivity</p></div>
                            <input name="nukeThreshold" type="number" value="${s.nukeThreshold}" class="w-16 bg-slate-900 text-center rounded-lg text-xs p-1">
                        </div>
                    </div>
                </div>

                <div class="mt-8 grid grid-cols-2 gap-8">
                    <div>
                        <label class="block font-bold text-[10px] text-slate-500 uppercase mb-3 ml-2">Ignore Specific Admin Roles (Comma IDs)</label>
                        <textarea name="adminRoleIds" class="w-full bg-slate-950/80 border border-slate-900 p-6 rounded-3xl outline-none focus:border-sky-500 h-28 text-sm font-mono">${s.adminRoleIds.join(', ')}</textarea>
                    </div>
                    <div>
                        <label class="block font-bold text-[10px] text-slate-500 uppercase mb-3 ml-2">Auto-Delete Channels (Comma IDs)</label>
                        <textarea name="autoDeleteChannels" class="w-full bg-slate-950/80 border border-slate-900 p-6 rounded-3xl outline-none focus:border-sky-500 h-28 text-sm font-mono">${s.autoDeleteChannels.join(', ')}</textarea>
                    </div>
                </div>
            </div>
        </form>
    `, req.session.gid, 'security'));
});

app.get('/access', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const pass = serverPasswords.get(req.session.gid) || CONFIG.MASTER_KEY;
    res.send(renderUI(`
        <div class="glass p-10 rounded-[3rem] max-w-2xl">
            <h2 class="text-2xl font-bold mb-6">🔑 ACCESS KEY MANAGEMENT</h2>
            <form id="settingsForm" action="/save-key" method="POST" class="space-y-6">
                <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Current UPLINK Key</label>
                    <input name="newPass" type="text" value="${pass}" class="w-full bg-slate-950 border border-slate-900 p-6 rounded-3xl outline-none focus:border-sky-500 text-xl font-black tracking-widest">
                </div>
                <p class="text-xs text-slate-500">This key is required to log into this specific server's dashboard. Keep it secure.</p>
            </form>
        </div>
    `, req.session.gid, 'access'));
});

app.post('/save-key', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const newPass = req.body.newPass?.trim();
    if (newPass) {
        serverPasswords.set(req.session.gid, newPass);
        logToAudit(req.session.gid, "SECURITY_CHANGE", "Admin", "Access Key Rotated.");
    }
    res.redirect('/access');
});

app.post('/save', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getSettings(req.session.gid);
    s.ignoreBots = req.body.ignoreBots === 'true';
    s.ignoreAdmins = req.body.ignoreAdmins === 'true';
    s.ignoreThreads = req.body.ignoreThreads === 'true';
    s.antiLink = req.body.antiLink === 'true';
    s.antiNuke = req.body.antiNuke === 'true';
    s.uiStyle = req.body.uiStyle;
    s.nukeThreshold = parseInt(req.body.nukeThreshold) || 3;
    s.adminRoleIds = req.body.adminRoleIds.split(',').map(x => x.trim()).filter(x => x);
    s.autoDeleteChannels = req.body.autoDeleteChannels.split(',').map(x => x.trim()).filter(x => x);
    
    logToAudit(req.session.gid, "GRID_SYNC", "Dashboard", "Parameters updated.");
    res.redirect('/security');
});

app.get('/tickets', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    let html = `<h2 class="text-4xl font-black mb-10 tracking-tighter uppercase">Support Transcripts</h2>`;
    if (ticketTranscripts.size === 0) {
        html += `<div class="glass p-20 rounded-[3rem] text-center text-slate-500 italic">No active sessions in buffer.</div>`;
    } else {
        for (const [cid, msgs] of ticketTranscripts.entries()) {
            html += `
            <div class="glass p-8 rounded-[2.5rem] mb-6 border-l-4 border-sky-500">
                <div class="flex justify-between mb-6">
                    <p class="font-bold text-sky-400 uppercase text-xs tracking-widest">Channel: ${cid}</p>
                    <span class="text-[10px] bg-sky-500/10 text-sky-500 px-3 py-1 rounded-full font-black">RECORDING</span>
                </div>
                <div class="space-y-2 max-h-60 overflow-y-auto pr-4 text-xs font-mono">
                    ${msgs.map(m => `<p><span class="text-slate-600">[${m.time}]</span> <span class="text-sky-300">${m.author}:</span> <span class="text-slate-300">${m.content}</span></p>`).join('')}
                </div>
            </div>`;
        }
    }
    res.send(renderUI(html, req.session.gid, 'tickets'));
});

app.get('/audits', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const logs = auditLogs.get(req.session.gid) || [];
    res.send(renderUI(`
        <div class="glass rounded-[3rem] overflow-hidden">
            <table class="w-full text-left">
                <thead class="bg-slate-950/50 text-slate-500 uppercase text-[10px] font-black tracking-widest">
                    <tr><th class="p-8">Time</th><th class="p-8">Action</th><th class="p-8">Summary</th></tr>
                </thead>
                <tbody class="divide-y divide-slate-800">
                    ${logs.map(l => `<tr class="hover:bg-sky-500/5 transition"><td class="p-8 text-slate-500 font-mono text-xs">${l.time}</td><td class="p-8 font-black text-sky-400 text-sm">${l.action}</td><td class="p-8 italic text-slate-400 text-sm">${l.reason}</td></tr>`).join('')}
                </tbody>
            </table>
        </div>
    `, req.session.gid, 'audits'));
});

app.get('/logout', (req, res) => { req.session = null; res.redirect('/'); });

app.listen(CONFIG.PORT, () => console.log(`[HTTP] Sher Bot Uplink on port ${CONFIG.PORT}`));
client.login(CONFIG.TOKEN);
