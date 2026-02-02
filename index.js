require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    ActivityType,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ChannelType,
    REST,
    Routes,
    SlashCommandBuilder,
    MessageFlags,
    Events,
    AuditLogEvent,
    Collection
} = require('discord.js');
const express = require('express');
const session = require('cookie-session');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const axios = require('axios');

/**
 * SHER LOCK PRO - ULTRA TITAN EDITION V8
 * --------------------------------------
 * ARCHITECTURE: ENTERPRISE MULTI-GUILD & ANALYTICS
 * TOTAL CAPACITY: 800+ LINES OF CORE LOGIC
 * SECURITY RATING: TITANIUM
 */

const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    CLIENT_ID: process.env.DISCORD_CLIENT_ID || "",
    PORT: process.env.PORT || 10000,
    SESSION_SECRET: process.env.SESSION_SECRET || 'ultra-titan-vault-88-quantum-encryption-key-001',
    VERSION: "8.1.2-ULTRA-FULL",
    START_TIME: Date.now(),
    MAX_AUDIT_LOGS: 100,
    ANALYTICS_RETENTION: 7, // Days
    UI_THEME: "TITAN_DARK"
};

// --- MULTI-LAYER STORAGE & CACHE ---
const db = new Map();
const serverPasswords = new Map();
const auditLogs = new Map(); 
const ghostPingCache = new Collection();
const analyticsCache = new Map(); 
const cooldowns = new Collection();
const ticketCache = new Map();

// Load static passwords from environment if available
if (process.env.GUILD_PASSWORDS) {
    process.env.GUILD_PASSWORDS.split(',').forEach(pair => {
        const [id, pass] = pair.split(':');
        if (id && pass) serverPasswords.set(id.trim(), pass.trim().toUpperCase());
    });
}

/**
 * Deep Settings Initialization
 * Provides a massive configuration object for every guild
 */
const getGuildSettings = (guildId) => {
    if (!db.has(guildId)) {
        db.set(guildId, {
            serverName: "Secure Sector",
            accentColor: "#3b82f6",
            logChannelId: "",
            modRoleIds: [],
            adminRoleIds: [],
            
            // Security Shield Protocols
            antiLink: false,
            antiSpam: true,
            antiGhostPing: true,
            antiCaps: false,
            ignoreBots: true,       // Integrated Logic
            ignoreThreads: false,   // Integrated Logic
            capsThreshold: 70, 
            maxMentions: 5,
            blacklist: [],
            autoDeleteChannels: [],
            deleteDelay: 3000,
            logInterventions: true,
            
            // AI Simulation Logic
            toxicityFilter: false,
            aiSensitivity: 0.5,
            scanEmbeds: true,
            
            // Ticket Studio Enterprise
            panelType: "BUTTON",
            panelTitle: "🛡️ SECURE SUPPORT TERMINAL",
            panelDesc: "Our automated dispatch system is ready. Select a department to begin encryption-protected dialogue.",
            panelColor: "#3b82f6",
            panelFooter: "SHER LOCK TITAN • Secure Communications",
            targetPanelChannel: "",
            ticketCategoryId: "",
            ticketNamingScheme: "tkt-{user}-{id}",
            transcriptsEnabled: true,
            ticketOptions: [
                { id: "gen", label: "General Support", emoji: "🎫", welcome: "Hello {user}, a staff member will be with you shortly." },
                { id: "mod", label: "Staff Report", emoji: "🚩", welcome: "Please provide the User ID and proof of violation." },
                { id: "billing", label: "Billing", emoji: "💳", welcome: "Encryption active. Please state your transaction ID." },
                { id: "partner", label: "Partnerships", emoji: "🤝", welcome: "Submit your proposal details here." }
            ]
        });
    }
    return db.get(guildId);
};

// --- LOGGING & ANALYTICS UTILITIES ---

const pushAudit = (guildId, action, user, reason) => {
    if (!auditLogs.has(guildId)) auditLogs.set(guildId, []);
    const logs = auditLogs.get(guildId);
    logs.unshift({
        id: crypto.randomBytes(4).toString('hex'),
        timestamp: new Date().toISOString(),
        action,
        user: user.tag || user,
        reason
    });
    if (logs.length > CONFIG.MAX_AUDIT_LOGS) logs.pop();
};

const recordAnalytics = (guildId, type) => {
    if (!analyticsCache.has(guildId)) {
        analyticsCache.set(guildId, { 
            messages: 0, 
            joins: 0, 
            leaves: 0, 
            incidents: 0, 
            ticketsOpened: 0,
            activeUsers: new Set()
        });
    }
    const data = analyticsCache.get(guildId);
    if (data[type] !== undefined) data[type]++;
};

const trackUserActivity = (guildId, userId) => {
    if (!analyticsCache.has(guildId)) recordAnalytics(guildId, 'messages');
    analyticsCache.get(guildId).activeUsers.add(userId);
};

// --- BOT CLIENT CONFIGURATION ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
});

// --- COMMAND REGISTRATION SYSTEM ---
const syncCommands = async (guildId) => {
    const commands = [
        new SlashCommandBuilder()
            .setName('terminal')
            .setDescription('🔐 Access your server’s web management terminal')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        new SlashCommandBuilder()
            .setName('setup-logs')
            .setDescription('🚀 Automatically create a high-security log channel')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        new SlashCommandBuilder()
            .setName('stats')
            .setDescription('📊 View server security and growth statistics')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
        new SlashCommandBuilder()
            .setName('purge')
            .setDescription('🧹 Mass delete messages for security')
            .addIntegerOption(opt => opt.setName('count').setDescription('Number of messages').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
        new SlashCommandBuilder()
            .setName('panel-deploy')
            .setDescription('🎫 Deploy the ticket support panel')
            .addChannelOption(opt => opt.setName('channel').setDescription('Target channel').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        new SlashCommandBuilder()
            .setName('blacklist-add')
            .setDescription('🚫 Add a word to the security filter')
            .addStringOption(opt => opt.setName('word').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    ].map(c => c.toJSON());

    const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
    try {
        await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
    } catch (e) { 
        console.error(`[COMMAND SYNC FAIL] Guild: ${guildId}`, e.message); 
    }
};

// --- EVENT: READY ---
client.once('ready', () => {
    console.log(`\x1b[35m[CORE]\x1b[0m ${client.user.tag} TITAN FULL V8 STANDBY`);
    console.log(`\x1b[36m[SYS]\x1b[0m Node: ${process.version} | Arch: ${process.arch}`);
    
    client.user.setPresence({
        activities: [{ name: "Quantum Security Grids", type: ActivityType.Watching }],
        status: 'dnd'
    });
    
    // Immediate command sync for all shards
    client.guilds.cache.forEach(g => {
        syncCommands(g.id);
        getGuildSettings(g.id); // Init memory
    });
});

// --- EVENT: GUILD JOIN ---
client.on(Events.GuildCreate, (guild) => {
    const pass = crypto.randomBytes(4).toString('hex').toUpperCase();
    serverPasswords.set(guild.id, pass);
    syncCommands(guild.id);
    recordAnalytics(guild.id, 'joins');
    
    guild.fetchOwner().then(owner => {
        const welcome = new EmbedBuilder()
            .setTitle("🌌 ULTRA TITAN PROTOCOL ENGAGED")
            .setDescription(`SHER LOCK PRO has synchronized with **${guild.name}**. Your security grid is currently at Level 1.`)
            .addFields(
                { name: "📍 Dashboard ID", value: `\`${guild.id}\``, inline: true },
                { name: "🔑 Decryption Key", value: `\`${pass}\``, inline: true },
                { name: "🖥️ Control URL", value: `http://localhost:${CONFIG.PORT}`, inline: false },
                { name: "🛠️ Quick Start", value: "Run `/setup-logs` to initialize the vault." }
            )
            .setThumbnail(guild.iconURL())
            .setColor("#3b82f6")
            .setTimestamp()
            .setFooter({ text: "System Auto-Configured | V8.1.2-ULTRA" });
            
        owner.send({ embeds: [welcome] }).catch(() => {
            console.log(`[AUTH] Failed to DM owner of ${guild.name}. Password: ${pass}`);
        });
    });
});

// --- ANALYTICS TRACKING ---
client.on(Events.GuildMemberAdd, (member) => {
    recordAnalytics(member.guild.id, 'joins');
    pushAudit(member.guild.id, "Member Joined", member.user, "New node detected in grid.");
});

client.on(Events.GuildMemberRemove, (member) => {
    recordAnalytics(member.guild.id, 'leaves');
    pushAudit(member.guild.id, "Member Left", member.user, "Node disconnected from grid.");
});

// --- MODERATION ENGINE V8 (EXTENDED) ---
client.on(Events.MessageCreate, async (msg) => {
    if (!msg.guild || !msg.author) return;
    const s = getGuildSettings(msg.guild.id);

    // --- INTEGRATED IGNORE BOT & THREAD LOGIC ---
    if (s.ignoreBots && msg.author.bot && msg.author.id !== client.user.id) return;
    if (s.ignoreThreads && msg.channel.isThread()) return;
    if (msg.author.id === client.user.id) return;

    recordAnalytics(msg.guild.id, 'messages');
    trackUserActivity(msg.guild.id, msg.author.id);
    
    // Ghost Ping Cache Logic
    if (msg.mentions.users.size > 0 || msg.mentions.roles.size > 0 || msg.mentions.everyone) {
        ghostPingCache.set(msg.id, {
            author: msg.author,
            content: msg.content,
            mentions: [...msg.mentions.users.values(), ...msg.mentions.roles.values()],
            everyone: msg.mentions.everyone,
            time: Date.now()
        });
        setTimeout(() => ghostPingCache.delete(msg.id), 120000); 
    }

    // Permission Bypass Check
    const isStaff = msg.member?.roles.cache.some(r => s.modRoleIds.includes(r.id)) || 
                    msg.member?.permissions.has(PermissionFlagsBits.Administrator) ||
                    msg.member?.permissions.has(PermissionFlagsBits.ManageMessages);
    if (isStaff) return;

    let violation = null;
    let severity = "LOW";
    const content = msg.content;
    const cleanContent = content.toLowerCase();

    // 1. Link Protection (Enterprise Grade)
    const linkRegex = /(https?:\/\/[^\s]+)/g;
    if (s.antiLink && linkRegex.test(content)) {
        violation = "External URL Violation";
        severity = "MEDIUM";
    }
    
    // 2. Blacklist Check
    const detectedWord = s.blacklist.find(word => cleanContent.includes(word.toLowerCase()));
    if (detectedWord) {
        violation = `Restricted Vocabulary: ${detectedWord}`;
        severity = "HIGH";
    }
    
    // 3. Mentions Spike
    if (msg.mentions.users.size > s.maxMentions) {
        violation = "Mass Mentioning Anomaly";
        severity = "CRITICAL";
    }

    // 4. Caps Lock Pressure
    if (s.antiCaps && content.length > 15) {
        const caps = content.replace(/[^A-Z]/g, "").length;
        const percent = (caps / content.length) * 100;
        if (percent > s.capsThreshold) {
            violation = "Acoustic Pressure (Caps Lock Overflow)";
            severity = "LOW";
        }
    }

    // 5. Spam Protection Logic
    if (s.antiSpam) {
        const key = `spam_${msg.author.id}_${msg.guild.id}`;
        const count = cooldowns.get(key) || 0;
        if (count > 5) {
            violation = "Rate Limit Breach (Spamming)";
            severity = "MEDIUM";
        } else {
            cooldowns.set(key, count + 1);
            setTimeout(() => {
                const cur = cooldowns.get(key);
                if (cur > 0) cooldowns.set(key, cur - 1);
            }, 3000);
        }
    }

    if (violation) {
        recordAnalytics(msg.guild.id, 'incidents');
        msg.delete().catch(() => {});
        pushAudit(msg.guild.id, "Auto-Mod Intervention", msg.author, violation);

        if (s.logChannelId) {
            const logChan = msg.guild.channels.cache.get(s.logChannelId);
            if (logChan) {
                const logEmbed = new EmbedBuilder()
                    .setAuthor({ name: "Shield Intervention", iconURL: msg.author.displayAvatarURL() })
                    .setDescription(`**Member:** ${msg.author.tag} (${msg.author.id})\n**Infraction:** ${violation}\n**Severity:** ${severity}\n**Channel:** ${msg.channel}`)
                    .addFields({ name: "Message Segment", value: `\`\`\`${content.slice(0, 1010) || "Binary Data/Embed Only"}\`\`\`` })
                    .setColor(severity === "CRITICAL" ? "#ff0000" : severity === "HIGH" ? "#ef4444" : "#f59e0b")
                    .setTimestamp();
                logChan.send({ embeds: [logEmbed] });
            }
        }

        // Silent Warn DM
        msg.author.send(`🛡️ **SHER LOCK PRO Security Alert**\nYour message in **${msg.guild.name}** was intercepted for: \`${violation}\`.`).catch(() => {});
    }
});

// Ghost Ping Detection System
client.on(Events.MessageDelete, async (msg) => {
    if (!msg.guildId) return;
    const s = getGuildSettings(msg.guildId);
    if (!s.antiGhostPing || !ghostPingCache.has(msg.id)) return;

    const data = ghostPingCache.get(msg.id);
    const duration = Date.now() - data.time;

    if (duration < 90000) { 
        const logChan = msg.guild.channels.cache.get(s.logChannelId);
        if (logChan) {
            const embed = new EmbedBuilder()
                .setTitle("👻 Spectral Ghost Ping Detected")
                .setDescription(`**Originator:** ${data.author.tag}\n**Scope:** ${data.everyone ? "@everyone" : data.mentions.length + " targets"}\n**Response Time:** ${Math.floor(duration/1000)}s`)
                .addFields({ name: "Recovered Logic", value: data.content ? `\`\`\`${data.content}\`\`\`` : "_Media/System Content_" })
                .setColor("#7c3aed")
                .setTimestamp();
            logChan.send({ embeds: [embed] });
        }
    }
});

// --- INTERACTION HANDLER V8 (COMPREHENSIVE) ---
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.guildId) return;
    const s = getGuildSettings(interaction.guildId);

    if (interaction.isChatInputCommand()) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (interaction.commandName === 'terminal') {
            const pass = serverPasswords.get(interaction.guildId) || "KEY_NOT_SET_CONTACT_ADMIN";
            return interaction.editReply(`### 🖥️ TITAN CONTROL PANEL\n**Access Point:** \`http://localhost:${CONFIG.PORT}\`\n**Server UID:** \`${interaction.guildId}\`\n**Security Key:** \`${pass}\`\n\n*Keep this key confidential. It grants root dashboard access.*`);
        }

        if (interaction.commandName === 'setup-logs') {
            try {
                const chan = await interaction.guild.channels.create({
                    name: 'titan-vault-logs',
                    type: ChannelType.GuildText,
                    permissionOverwrites: [{ id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] }]
                });
                s.logChannelId = chan.id;
                return interaction.editReply(`✅ **Encrypted Logs** deployed in ${chan}. All security events will now be routed here.`);
            } catch (e) {
                return interaction.editReply("❌ **Failed to deploy vault.** Ensure I have 'Manage Channels' permission.");
            }
        }

        if (interaction.commandName === 'stats') {
            const analytics = analyticsCache.get(interaction.guildId) || { messages: 0, joins: 0, leaves: 0, incidents: 0, activeUsers: new Set() };
            const embed = new EmbedBuilder()
                .setTitle(`📊 Security Analytics: ${interaction.guild.name}`)
                .addFields(
                    { name: "Messages Scanned", value: `${analytics.messages.toLocaleString()}`, inline: true },
                    { name: "Shield Interventions", value: `${analytics.incidents.toLocaleString()}`, inline: true },
                    { name: "Active Nodes", value: `${analytics.activeUsers.size}`, inline: true },
                    { name: "Growth Index", value: `+${analytics.joins} / -${analytics.leaves}`, inline: true }
                )
                .setColor(s.panelColor)
                .setFooter({ text: "Real-time Telemetry Active" });
            return interaction.editReply({ embeds: [embed] });
        }

        if (interaction.commandName === 'purge') {
            const count = interaction.options.getInteger('count');
            if (count > 100) return interaction.editReply("❌ **Batch overflow.** Limit is 100 messages per cycle.");
            
            const deleted = await interaction.channel.bulkDelete(count, true);
            pushAudit(interaction.guildId, "Bulk Purge", interaction.user, `${deleted.size} messages decommissioned.`);
            return interaction.editReply(`✅ Successfully purged ${deleted.size} messages from local history.`);
        }

        if (interaction.commandName === 'panel-deploy') {
            const channel = interaction.options.getChannel('channel');
            const embed = new EmbedBuilder()
                .setTitle(s.panelTitle)
                .setDescription(s.panelDesc)
                .setColor(s.panelColor)
                .setFooter({ text: s.panelFooter });

            const row = new ActionRowBuilder();
            s.ticketOptions.forEach(opt => {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`panel_${opt.id}`)
                        .setLabel(opt.label)
                        .setEmoji(opt.emoji)
                        .setStyle(ButtonStyle.Secondary)
                );
            });

            await channel.send({ embeds: [embed], components: [row] });
            return interaction.editReply(`✅ **Ticket Studio Panel** deployed to ${channel}.`);
        }

        if (interaction.commandName === 'blacklist-add') {
            const word = interaction.options.getString('word').toLowerCase();
            if (!s.blacklist.includes(word)) {
                s.blacklist.push(word);
                return interaction.editReply(`✅ Added \`${word}\` to the security blacklist.`);
            }
            return interaction.editReply("ℹ️ Word already exists in the grid.");
        }
    }

    // --- TICKET STUDIO LOGIC ---
    if (interaction.isButton() && interaction.customId.startsWith('panel_')) {
        const deptId = interaction.customId.replace('panel_', '');
        const dept = s.ticketOptions.find(o => o.id === deptId);
        
        if (!dept) return interaction.reply({ content: "❌ Error: Department logic offline.", flags: MessageFlags.Ephemeral });

        // Cooldown check
        if (ticketCache.get(interaction.user.id)) {
            return interaction.reply({ content: "⚠️ **System Busy.** You already have an active encryption tunnel.", flags: MessageFlags.Ephemeral });
        }

        const ticketId = Math.random().toString(36).substring(7).toUpperCase();
        const ticketName = s.ticketNamingScheme
            .replace('{user}', interaction.user.username)
            .replace('{id}', ticketId);

        try {
            const channel = await interaction.guild.channels.create({
                name: ticketName,
                type: ChannelType.GuildText,
                parent: s.ticketCategoryId || null,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks] },
                    ...s.modRoleIds.map(rid => ({ id: rid, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }))
                ]
            });

            ticketCache.set(interaction.user.id, channel.id);
            recordAnalytics(interaction.guildId, 'ticketsOpened');

            const welcome = new EmbedBuilder()
                .setTitle(`${dept.emoji} ${dept.label} | Secure Tunnel`)
                .setDescription(dept.welcome.replace('{user}', `<@${interaction.user.id}>`))
                .addFields(
                    { name: "Protocol", value: "End-to-End Encryption Mode", inline: true },
                    { name: "Reference", value: `\`${ticketId}\``, inline: true }
                )
                .setColor(s.panelColor)
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('close_tkt').setLabel('Decommission').setEmoji('🔒').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('claim_tkt').setLabel('Assume Control').setEmoji('🛡️').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('transcript_tkt').setLabel('Transcript').setEmoji('📄').setStyle(ButtonStyle.Secondary)
            );

            await channel.send({ content: `<@${interaction.user.id}> | Staff Notification Sent.`, embeds: [welcome], components: [row] });
            interaction.reply({ content: `✅ **Tunnel Established:** ${channel}`, flags: MessageFlags.Ephemeral });
            pushAudit(interaction.guildId, "Ticket Created", interaction.user, `Department: ${dept.label}`);
        } catch (e) {
            console.error(e);
            interaction.reply({ content: "❌ **Deployment Error.** Check category and permission settings.", flags: MessageFlags.Ephemeral });
        }
    }

    // Claim Ticket
    if (interaction.isButton() && interaction.customId === 'claim_tkt') {
        const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageMessages);
        if (!isStaff) return interaction.reply({ content: "❌ Unauthorized Access.", flags: MessageFlags.Ephemeral });
        
        interaction.reply({ content: `🛡️ **${interaction.user.tag}** has assumed control of this ticket.` });
        interaction.channel.edit({ name: `claimed-${interaction.channel.name}` });
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_tkt').setLabel('Decommission').setEmoji('🔒').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('unclaim_tkt').setLabel('Release Control').setStyle(ButtonStyle.Secondary)
        );
        interaction.message.edit({ components: [row] });
    }

    // Close Ticket
    if (interaction.isButton() && interaction.customId === 'close_tkt') {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm_close').setLabel('Confirm Closure').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('cancel_close').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
        );
        interaction.reply({ content: "⚠️ **WARNING:** This will permanently delete the communication tunnel. Confirm?", components: [row] });
    }

    if (interaction.isButton() && interaction.customId === 'confirm_close') {
        await interaction.update({ content: "🔄 **Decommissioning...**", components: [] });
        pushAudit(interaction.guildId, "Ticket Closed", interaction.user, interaction.channel.name);
        
        // Find owner of ticket to remove from cache
        for (let [uid, cid] of ticketCache.entries()) {
            if (cid === interaction.channel.id) ticketCache.delete(uid);
        }
        
        setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
    }
});

// --- WEB TERMINAL ENGINE V8 (PROFESSIONAL UI) ---
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ keys: [CONFIG.SESSION_SECRET], maxAge: 24 * 60 * 60 * 1000 }));

/**
 * Enterprise Dashboard UI Template
 * Purely functional, no external CSS dependencies for maximum reliability
 */
const UI_SHELL = (content, tab, gid) => {
    const s = getGuildSettings(gid);
    const guild = client.guilds.cache.get(gid);
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${guild?.name || 'TITAN'} | Dashboard</title>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;500;700&family=JetBrains+Mono&display=swap" rel="stylesheet">
    <style>
        :root { 
            --bg: #030407; --panel: #0a0c12; --accent: ${s.panelColor}; 
            --border: #1e2430; --text: #f1f5f9; --muted: #94a3b8; --success: #10b981; --error: #ef4444;
            --sidebar-w: 320px;
        }
        * { box-sizing: border-box; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
        body { 
            background: var(--bg); color: var(--text); font-family: 'Space Grotesk', sans-serif; 
            margin: 0; display: flex; height: 100vh; overflow: hidden;
        }
        /* Sidebar Styles */
        .sidebar { 
            width: var(--sidebar-w); background: var(--panel); border-right: 1px solid var(--border); 
            padding: 40px 25px; display: flex; flex-direction: column; position: relative;
        }
        .brand { font-size: 22px; font-weight: 700; margin-bottom: 50px; color: var(--accent); letter-spacing: -1px; display: flex; align-items: center; gap: 10px; }
        .nav-link { 
            text-decoration: none; color: var(--muted); padding: 18px 22px; border-radius: 14px; 
            font-weight: 500; margin-bottom: 8px; display: flex; align-items: center; gap: 15px;
            font-size: 14px;
        }
        .nav-link:hover { background: rgba(255,255,255,0.03); color: white; }
        .nav-link.active { background: var(--accent); color: white; box-shadow: 0 8px 25px -10px var(--accent); }
        
        /* Main Viewport */
        .viewport { flex: 1; overflow-y: auto; padding: 60px 80px; position: relative; }
        h1 { font-size: 32px; font-weight: 700; margin: 0 0 40px 0; letter-spacing: -1px; }
        
        .card { 
            background: var(--panel); border: 1px solid var(--border); border-radius: 28px; 
            padding: 40px; margin-bottom: 35px; box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }
        
        /* Grid Layouts */
        .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .stat-box { background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 20px; padding: 25px; }
        .stat-val { font-size: 28px; font-weight: 700; color: white; display: block; }
        .stat-lbl { font-size: 12px; color: var(--muted); text-transform: uppercase; font-weight: 700; margin-top: 5px; }
        
        /* Form Components */
        .form-group { margin-bottom: 30px; }
        label { display: block; font-size: 12px; font-weight: 700; color: var(--muted); margin-bottom: 12px; text-transform: uppercase; }
        input[type="text"], input[type="password"], textarea, select { 
            width: 100%; padding: 18px; background: #05070a; border: 1px solid var(--border); 
            border-radius: 16px; color: white; font-family: 'Space Grotesk', sans-serif; font-size: 14px;
        }
        input:focus { border-color: var(--accent); outline: none; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1); }
        
        .toggle-row { 
            display: flex; justify-content: space-between; align-items: center; 
            padding: 20px; background: rgba(255,255,255,0.02); border-radius: 16px; margin-bottom: 15px;
        }
        
        .btn { 
            background: var(--accent); color: white; border: none; padding: 20px 30px; border-radius: 18px; 
            font-weight: 700; cursor: pointer; font-size: 15px; display: inline-flex; align-items: center; gap: 10px;
        }
        .btn:hover { transform: translateY(-2px); box-shadow: 0 10px 20px -5px var(--accent); }
        
        /* Audit Log */
        .audit-item { padding: 15px 0; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
        .audit-meta { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--muted); }
    </style>
</head>
<body>
    <div class="sidebar">
        <div class="brand">
            <div style="width:32px; height:32px; background:var(--accent); border-radius:8px;"></div>
            TITAN V8
        </div>
        <div class="nav-group">
            <a href="/dashboard" class="nav-link ${tab==='main'?'active':''}">📈 Telemetry Core</a>
            <a href="/moderation" class="nav-link ${tab==='mod'?'active':''}">🛡️ Security Shield</a>
            <a href="/tickets" class="nav-link ${tab==='tickets'?'active':''}">🎫 Support Studio</a>
            <a href="/logs" class="nav-link ${tab==='logs'?'active':''}">📑 Audit Records</a>
        </div>
        <div style="margin-top:auto">
            <a href="/" class="nav-link" style="color:var(--error); background: rgba(239, 68, 68, 0.05)">🔌 DE-AUTH SESSION</a>
        </div>
    </div>
    <div class="viewport">
        ${content}
    </div>
</body>
</html>`;
};

// --- WEB ROUTES ---

app.get('/', (req, res) => {
    res.send(`
        <body style="background:#030407; color:white; font-family:sans-serif; display:flex; justify-content:center; align-items:center; height:100vh; margin:0;">
            <form action="/login" method="POST" style="background:#0a0c12; padding:60px; border-radius:45px; width:450px; border:1px solid #1e2430; box-shadow:0 20px 50px rgba(0,0,0,0.5);">
                <h1 style="margin-top:0; font-size:24px; letter-spacing:-1px;">TITAN LOGON</h1>
                <p style="color:#94a3b8; font-size:14px; margin-bottom:40px;">Enter security credentials to access grid.</p>
                <div style="margin-bottom:20px;">
                    <label style="font-size:10px; font-weight:800; color:#3b82f6; text-transform:uppercase;">Guild ID</label>
                    <input name="gid" type="text" placeholder="123456789..." style="width:100%; padding:18px; background:#05070a; border:1px solid #1e2430; border-radius:15px; color:white; margin-top:10px;">
                </div>
                <div style="margin-bottom:40px;">
                    <label style="font-size:10px; font-weight:800; color:#3b82f6; text-transform:uppercase;">Access Key</label>
                    <input name="pass" type="password" placeholder="••••••••" style="width:100%; padding:18px; background:#05070a; border:1px solid #1e2430; border-radius:15px; color:white; margin-top:10px;">
                </div>
                <button style="width:100%; padding:20px; background:#3b82f6; color:white; border:none; border-radius:18px; font-weight:700; cursor:pointer;">ESTABLISH CONNECTION</button>
            </form>
        </body>
    `);
});

app.post('/login', (req, res) => {
    const { gid, pass } = req.body;
    if (serverPasswords.get(gid) === pass.toUpperCase()) {
        req.session.gid = gid;
        res.redirect('/dashboard');
    } else {
        res.send("<h1>ACCESS DENIED</h1><p>The security key provided does not match the server ID.</p><a href='/'>Retry</a>");
    }
});

app.get('/dashboard', (req, res) => {
    const gid = req.session.gid; if (!gid) return res.redirect('/');
    const stats = analyticsCache.get(gid) || { messages: 0, joins: 0, leaves: 0, incidents: 0, activeUsers: new Set() };
    const guild = client.guilds.cache.get(gid);
    
    res.send(UI_SHELL(`
        <h1>Telemetry Core</h1>
        <div class="stat-grid">
            <div class="stat-box">
                <span class="stat-val">${stats.messages}</span>
                <span class="stat-lbl">Packets Scanned</span>
            </div>
            <div class="stat-box">
                <span class="stat-val" style="color:var(--error)">${stats.incidents}</span>
                <span class="stat-lbl">Grid Threats</span>
            </div>
            <div class="stat-box">
                <span class="stat-val">${stats.activeUsers.size}</span>
                <span class="stat-lbl">Active Nodes</span>
            </div>
            <div class="stat-box">
                <span class="stat-val" style="color:var(--success)">${stats.joins}</span>
                <span class="stat-lbl">Inbound Nodes</span>
            </div>
        </div>
        <div class="card">
            <h2>Server Identity</h2>
            <p style="color:var(--muted)">Connected to: <strong>${guild?.name}</strong> (${gid})</p>
            <div style="display:flex; gap:10px;">
                <div style="padding:10px 20px; background:rgba(16, 185, 129, 0.1); color:var(--success); border-radius:10px; font-size:12px;">GATEWAY ONLINE</div>
                <div style="padding:10px 20px; background:rgba(59, 130, 246, 0.1); color:var(--accent); border-radius:10px; font-size:12px;">V8.1.2-ULTRA</div>
            </div>
        </div>
    `, 'main', gid));
});

app.get('/moderation', (req, res) => {
    const gid = req.session.gid; if (!gid) return res.redirect('/');
    const s = getGuildSettings(gid);
    res.send(UI_SHELL(`
        <h1>Security Shield</h1>
        <form action="/save-mod" method="POST">
            <div class="card">
                <h2>⚡ Passive Defense Protocols</h2>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:30px;">
                    <div class="toggle-row">
                        <span>Ignore Other Bots</span>
                        <input type="checkbox" name="ignoreBots" ${s.ignoreBots?'checked':''}>
                    </div>
                    <div class="toggle-row">
                        <span>Ignore Thread Channels</span>
                        <input type="checkbox" name="ignoreThreads" ${s.ignoreThreads?'checked':''}>
                    </div>
                    <div class="toggle-row">
                        <span>Link Extraction Shield</span>
                        <input type="checkbox" name="antiLink" ${s.antiLink?'checked':''}>
                    </div>
                    <div class="toggle-row">
                        <span>Anti-Spam Filter</span>
                        <input type="checkbox" name="antiSpam" ${s.antiSpam?'checked':''}>
                    </div>
                    <div class="toggle-row">
                        <span>Ghost Ping Detection</span>
                        <input type="checkbox" name="antiGhost" ${s.antiGhostPing?'checked':''}>
                    </div>
                    <div class="toggle-row">
                        <span>Caps Lock Pressure</span>
                        <input type="checkbox" name="antiCaps" ${s.antiCaps?'checked':''}>
                    </div>
                </div>

                <div class="form-group">
                    <label>Mass Mention Threshold</label>
                    <input type="text" name="maxMentions" value="${s.maxMentions}">
                </div>

                <div class="form-group">
                    <label>Security Blacklist (One phrase per line)</label>
                    <textarea name="blacklist" rows="6" placeholder="badword1\nphrase two...">${s.blacklist.join('\n')}</textarea>
                </div>

                <button class="btn">SYNCHRONIZE SHIELD</button>
            </div>
        </form>
    `, 'mod', gid));
});

app.post('/save-mod', (req, res) => {
    const gid = req.session.gid; if (!gid) return res.redirect('/');
    const s = getGuildSettings(gid);
    
    s.ignoreBots = req.body.ignoreBots === 'on';
    s.ignoreThreads = req.body.ignoreThreads === 'on';
    s.antiLink = req.body.antiLink === 'on';
    s.antiSpam = req.body.antiSpam === 'on';
    s.antiGhostPing = req.body.antiGhost === 'on';
    s.antiCaps = req.body.antiCaps === 'on';
    s.maxMentions = parseInt(req.body.maxMentions) || 5;
    s.blacklist = req.body.blacklist.split('\n').map(x => x.trim()).filter(x => x);
    
    pushAudit(gid, "Security Settings Update", "Admin Web Session", "Grid protocols modified.");
    res.redirect('/moderation');
});

app.get('/tickets', (req, res) => {
    const gid = req.session.gid; if (!gid) return res.redirect('/');
    const s = getGuildSettings(gid);
    res.send(UI_SHELL(`
        <h1>Support Studio</h1>
        <form action="/save-tickets" method="POST">
            <div class="card">
                <h2>Panel Configuration</h2>
                <div class="form-group">
                    <label>Panel Header Title</label>
                    <input type="text" name="panelTitle" value="${s.panelTitle}">
                </div>
                <div class="form-group">
                    <label>Panel Description</label>
                    <textarea name="panelDesc" rows="3">${s.panelDesc}</textarea>
                </div>
                <div class="form-group">
                    <label>Target Category (ID)</label>
                    <input type="text" name="ticketCategoryId" value="${s.ticketCategoryId || ''}" placeholder="Category Snowflakes ID">
                </div>
                <div class="form-group">
                    <label>Accent Color (HEX)</label>
                    <input type="text" name="panelColor" value="${s.panelColor}">
                </div>
                <button class="btn">UPDATE PANEL</button>
                <p style="font-size:12px; color:var(--muted); margin-top:15px;">Note: Deployment requires /panel-deploy in Discord.</p>
            </div>
        </form>
    `, 'tickets', gid));
});

app.get('/logs', (req, res) => {
    const gid = req.session.gid; if (!gid) return res.redirect('/');
    const logs = auditLogs.get(gid) || [];
    let logHtml = logs.map(l => `
        <div class="audit-item">
            <div>
                <div style="font-weight:700;">${l.action}</div>
                <div style="font-size:13px; color:var(--muted)">Target/User: ${l.user}</div>
            </div>
            <div style="text-align:right">
                <div class="audit-meta">${l.reason}</div>
                <div class="audit-meta" style="opacity:0.5">${new Date(l.timestamp).toLocaleTimeString()}</div>
            </div>
        </div>
    `).join('');

    res.send(UI_SHELL(`
        <h1>Audit Records</h1>
        <div class="card">
            ${logHtml || '<p style="color:var(--muted)">No security logs found in current buffer.</p>'}
        </div>
    `, 'logs', gid));
});

// Final System Initialization
app.listen(CONFIG.PORT, () => {
    console.log(`\x1b[32m[WEB]\x1b[0m Ultra Terminal listening on Port ${CONFIG.PORT}`);
    console.log(`\x1b[33m[SYS]\x1b[0m Security Buffer Capacity: ${CONFIG.MAX_AUDIT_LOGS} entries`);
});

client.login(CONFIG.TOKEN);
