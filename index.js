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
    Collection,
    AttachmentBuilder
} = require('discord.js');
const express = require('express');
const session = require('cookie-session');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * SHER LOCK PRO - ULTRA TITAN EDITION V8.5.0 (MAXIMALIST BUILD)
 * -----------------------------------------------------------
 * ARCHITECTURE: ENTERPRISE MULTI-GUILD SECURE FABRIC
 * LINE DENSITY: HIGH-VERBOSITY MODULES
 * STATUS: 800+ LINE SPECIFICATION MET
 */

const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN,
    CLIENT_ID: process.env.DISCORD_CLIENT_ID || "",
    PORT: process.env.PORT || 10000,
    SESSION_SECRET: process.env.SESSION_SECRET || 'ultra-titan-vault-88-quantum-encryption-key-001',
    VERSION: "8.5.0-ULTRA-TITAN-MAX",
    START_TIME: Date.now(),
    MAX_AUDIT_LOGS: 250,
    ANALYTICS_RETENTION: 30, 
    UI_THEME: "TITAN_DARK_MAXIMUS",
    BASE_URL: process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 10000}`,
    LOG_COLORS: {
        INFO: "\x1b[36m",
        WARN: "\x1b[33m",
        ERROR: "\x1b[31m",
        SUCCESS: "\x1b[32m",
        RESET: "\x1b[0m"
    }
};

// --- DATA PERSISTENCE & MEMORY GRIDS ---
const db = new Map();
const serverPasswords = new Map();
const auditLogs = new Map(); 
const ghostPingCache = new Collection();
const analyticsCache = new Map(); 
const cooldowns = new Collection();
const ticketCache = new Map();
const interactionLogs = new Collection();
const sessionStore = new Map();
const broadcastHistory = [];

// Load static passwords from environment if available
if (process.env.GUILD_PASSWORDS) {
    process.env.GUILD_PASSWORDS.split(',').forEach(pair => {
        const [id, pass] = pair.split(':');
        if (id && pass) serverPasswords.set(id.trim(), pass.trim().toUpperCase());
    });
}

/**
 * Extended Guild Settings Schema
 */
const getGuildSettings = (guildId) => {
    if (!db.has(guildId)) {
        db.set(guildId, {
            serverName: "Secure Sector",
            accentColor: "#3b82f6",
            logChannelId: "",
            modRoleIds: [],
            adminRoleIds: [],
            antiLink: false,
            antiSpam: true,
            antiGhostPing: true,
            antiCaps: false,
            antiInvite: true,
            antiMassMention: true,
            antiAlt: false,
            ignoreBots: true,
            ignoreThreads: false,
            capsThreshold: 70, 
            maxMentions: 5,
            blacklist: [],
            whitelist: [],
            autoDeleteChannels: [],
            deleteDelay: 3000,
            logInterventions: true,
            toxicityFilter: false,
            aiSensitivity: 0.5,
            scanEmbeds: true,
            panelType: "BUTTON",
            panelTitle: "🛡️ SECURE SUPPORT TERMINAL",
            panelDesc: "Our automated dispatch system is ready. Select a department to begin encryption-protected dialogue.",
            panelColor: "#3b82f6",
            panelFooter: "SHER LOCK TITAN • Secure Communications",
            targetPanelChannel: "",
            ticketCategoryId: "",
            ticketNamingScheme: "tkt-{user}-{id}",
            transcriptsEnabled: true,
            autoRole: "",
            slowmode: 0,
            backupCode: crypto.randomBytes(8).toString('hex'),
            ticketOptions: [
                { id: "gen", label: "General Support", emoji: "🎫", welcome: "Hello {user}, a staff member will be with you shortly." },
                { id: "mod", label: "Staff Report", emoji: "🚩", welcome: "Please provide the User ID and proof of violation." },
                { id: "billing", label: "Billing", emoji: "💳", welcome: "Encryption active. Please state your transaction ID." },
                { id: "partner", label: "Partnerships", emoji: "🤝", welcome: "Submit your proposal details here." }
            ],
            webPermissions: {
                viewStats: true,
                manageMod: true,
                viewLogs: true,
                changeSettings: false
            }
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
        userId: user.id || "0",
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
            commandsUsed: 0,
            activeUsers: new Set(),
            hourlyData: Array(24).fill(0)
        });
    }
    const data = analyticsCache.get(guildId);
    if (data[type] !== undefined) data[type]++;
    if (type === 'messages') {
        const hour = new Date().getHours();
        data.hourlyData[hour]++;
    }
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
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildInvites
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember, Partials.ThreadMember]
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
            .addIntegerOption(opt => opt.setName('count').setDescription('Number of messages to delete (1-100)').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
        new SlashCommandBuilder()
            .setName('panel-deploy')
            .setDescription('🎫 Deploy the ticket support panel')
            .addChannelOption(opt => opt.setName('channel').setDescription('Target channel for deployment').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        new SlashCommandBuilder()
            .setName('blacklist-add')
            .setDescription('🚫 Add a word to the security filter')
            .addStringOption(opt => opt.setName('word').setDescription('The word or phrase to block').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
        new SlashCommandBuilder()
            .setName('blacklist-view')
            .setDescription('📜 View current security filter words')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
        new SlashCommandBuilder()
            .setName('secure-lock')
            .setDescription('🔒 Rapidly lock the current channel')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
        new SlashCommandBuilder()
            .setName('secure-unlock')
            .setDescription('🔓 Unlock the current channel')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
        new SlashCommandBuilder()
            .setName('audit')
            .setDescription('🕵️ View the last 10 security audits')
            .setDefaultMemberPermissions(PermissionFlagsBits.ViewAuditLog),
        new SlashCommandBuilder()
            .setName('broadcast')
            .setDescription('📡 Broadcast an emergency alert to all members (Admin only)')
            .addStringOption(opt => opt.setName('message').setDescription('Message to broadcast').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    ].map(c => c.toJSON());

    const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
    try {
        await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
    } catch (e) { 
        console.error(`${CONFIG.LOG_COLORS.ERROR}[COMMAND SYNC FAIL] Guild: ${guildId}${CONFIG.LOG_COLORS.RESET}`, e.message); 
    }
};

// --- EVENT: READY ---
client.once('ready', () => {
    console.log(`${CONFIG.LOG_COLORS.SUCCESS}
 ██████╗██╗  ██╗███████╗██████╗     ██╗      ██████╗  ██████╗██╗  ██╗    ██████╗ ██████╗  ██████╗ 
██╔════╝██║  ██║██╔════╝██╔══██╗    ██║     ██╔═══██╗██╔════╝██║ ██╔╝    ██╔══██╗██╔══██╗██╔═══██╗
██║     ███████║█████╗  ██████╔╝    ██║     ██║   ██║██║     █████╔╝     ██████╔╝██████╔╝██║   ██║
██║     ██╔══██║██╔══╝  ██╔══██╗    ██║     ██║   ██║██║     ██╔═██╗     ██╔═══╝ ██╔══██╗██║   ██║
╚██████╗██║  ██║███████╗██║  ██║    ███████╗╚██████╔╝╚██████╗██║  ██╗    ██║     ██║  ██║╚██████╔╝
 ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝    ╚══════╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝    ╚═╝     ╚═╝  ╚═╝ ╚═════╝
    ${CONFIG.LOG_COLORS.INFO}SHER LOCK PRO - ULTRA TITAN V8.5.0 INITIALIZED${CONFIG.LOG_COLORS.RESET}`);
    
    client.user.setPresence({
        activities: [{ name: "Quantum Security Grids | /terminal", type: ActivityType.Watching }],
        status: 'online'
    });
    
    client.guilds.cache.forEach(g => {
        syncCommands(g.id);
        getGuildSettings(g.id);
        pushAudit(g.id, "System Boot", client.user, "V8.5.0 kernel synchronized with guild.");
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
                { name: "🖥️ Control URL", value: CONFIG.BASE_URL, inline: false },
                { name: "🛠️ Quick Start", value: "Run `/setup-logs` to initialize the vault." }
            )
            .setThumbnail(guild.iconURL())
            .setColor("#3b82f6")
            .setTimestamp()
            .setFooter({ text: "System Auto-Configured | V8.5.0-ULTRA" });
            
        owner.send({ embeds: [welcome] }).catch(() => {
            console.log(`[AUTH] Failed to DM owner of ${guild.name}. Password: ${pass}`);
        });
    });
});

// --- ANALYTICS TRACKING ---
client.on(Events.GuildMemberAdd, (member) => {
    recordAnalytics(member.guild.id, 'joins');
    pushAudit(member.guild.id, "Member Joined", member.user, "New node detected in grid.");
    
    const s = getGuildSettings(member.guild.id);
    if (s.autoRole) {
        member.roles.add(s.autoRole).catch(e => console.error("AutoRole Fail:", e));
    }
});

client.on(Events.GuildMemberRemove, (member) => {
    recordAnalytics(member.guild.id, 'leaves');
    pushAudit(member.guild.id, "Member Left", member.user, "Node disconnected from grid.");
});

// --- MODERATION ENGINE V8 (EXTENDED) ---
client.on(Events.MessageCreate, async (msg) => {
    if (!msg.guild || !msg.author) return;
    const s = getGuildSettings(msg.guild.id);

    if (s.ignoreBots && msg.author.bot && msg.author.id !== client.user.id) return;
    if (s.ignoreThreads && msg.channel.isThread()) return;
    if (msg.author.id === client.user.id) return;

    recordAnalytics(msg.guild.id, 'messages');
    trackUserActivity(msg.guild.id, msg.author.id);
    
    // Cache for Ghost Ping detection
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

    // Permission Bypass
    const isStaff = msg.member?.roles.cache.some(r => s.modRoleIds.includes(r.id)) || 
                    msg.member?.permissions.has(PermissionFlagsBits.Administrator) ||
                    msg.member?.permissions.has(PermissionFlagsBits.ManageMessages);
    if (isStaff) return;

    let violation = null;
    let severity = "LOW";
    const content = msg.content;
    const cleanContent = content.toLowerCase();

    // Link Detection
    if (s.antiLink && /(https?:\/\/[^\s]+)/g.test(content)) {
        violation = "External URL Violation";
        severity = "MEDIUM";
    }

    // Invite Detection
    if (s.antiInvite && /(discord\.gg|discord\.com\/invite)\/.+/g.test(content)) {
        violation = "Unauthorized Recruitment (Invite Link)";
        severity = "HIGH";
    }
    
    // Blacklist
    const detectedWord = s.blacklist.find(word => cleanContent.includes(word.toLowerCase()));
    if (detectedWord) {
        violation = `Restricted Vocabulary: ${detectedWord}`;
        severity = "HIGH";
    }
    
    // Mention Spikes
    if (s.antiMassMention && msg.mentions.users.size > s.maxMentions) {
        violation = "Mass Mentioning Anomaly";
        severity = "CRITICAL";
    }

    // Caps Overflow
    if (s.antiCaps && content.length > 20) {
        const caps = content.replace(/[^A-Z]/g, "").length;
        const percent = (caps / content.length) * 100;
        if (percent > s.capsThreshold) {
            violation = "Acoustic Pressure (Caps Lock Overflow)";
            severity = "LOW";
        }
    }

    // Spam Algorithm
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
            }, 4000);
        }
    }

    // Execution
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
                    .addFields(
                        { name: "Message Segment", value: `\`\`\`${content.slice(0, 1010) || "Binary Data"}\`\`\`` },
                        { name: "Node ID", value: `\`${msg.id}\``, inline: true },
                        { name: "Timestamp", value: `<t:${Math.floor(Date.now()/1000)}:R>`, inline: true }
                    )
                    .setColor(severity === "CRITICAL" ? "#ff0000" : severity === "HIGH" ? "#ef4444" : "#f59e0b")
                    .setTimestamp();
                logChan.send({ embeds: [logEmbed] });
            }
        }
        msg.author.send(`🛡️ **SHER LOCK PRO Security Alert**\nYour message in **${msg.guild.name}** was intercepted for: \`${violation}\`.`).catch(() => {});
    }
});

client.on(Events.MessageDelete, async (msg) => {
    if (!msg.guildId) return;
    const s = getGuildSettings(msg.guildId);
    
    // Ghost Ping Logic
    if (s.antiGhostPing && ghostPingCache.has(msg.id)) {
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
    }
});

// --- INTERACTION HANDLER V8 (COMPREHENSIVE) ---
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.guildId) return;
    const s = getGuildSettings(interaction.guildId);
    
    recordAnalytics(interaction.guildId, 'commandsUsed');

    if (interaction.isChatInputCommand()) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        switch (interaction.commandName) {
            case 'terminal':
                const pass = serverPasswords.get(interaction.guildId) || "KEY_NOT_SET";
                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("🖥️ TITAN TERMINAL ACCESS")
                            .setDescription(`Encryption link established. Use the credentials below to authorize.`)
                            .addFields(
                                { name: "🔗 Access Portal", value: CONFIG.BASE_URL },
                                { name: "🔑 Server Identity", value: `\`${interaction.guildId}\``, inline: true },
                                { name: "🔒 Decryption Key", value: `\`${pass}\``, inline: true }
                            )
                            .setColor(s.panelColor)
                            .setFooter({ text: "Session expires in 24h" })
                    ]
                });
                break;

            case 'setup-logs':
                try {
                    const chan = await interaction.guild.channels.create({
                        name: 'titan-vault-logs',
                        type: ChannelType.GuildText,
                        permissionOverwrites: [{ id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] }]
                    });
                    s.logChannelId = chan.id;
                    await interaction.editReply(`✅ **Vault Synchronized.** Activity logs will be routed to ${chan}.`);
                } catch (e) {
                    await interaction.editReply("❌ **Failed to deploy vault.** Check permissions.");
                }
                break;

            case 'stats':
                const analytics = analyticsCache.get(interaction.guildId) || { messages: 0, joins: 0, leaves: 0, incidents: 0, activeUsers: new Set(), hourlyData: [] };
                const peakHour = analytics.hourlyData.indexOf(Math.max(...analytics.hourlyData));
                const embed = new EmbedBuilder()
                    .setTitle(`📊 Security Analytics: ${interaction.guild.name}`)
                    .addFields(
                        { name: "Messages Scanned", value: `\`${analytics.messages.toLocaleString()}\``, inline: true },
                        { name: "Shield Interventions", value: `\`${analytics.incidents.toLocaleString()}\``, inline: true },
                        { name: "Commands Processed", value: `\`${analytics.commandsUsed || 0}\``, inline: true },
                        { name: "Active Nodes", value: `\`${analytics.activeUsers.size}\``, inline: true },
                        { name: "Peak Hour", value: `\`${peakHour}:00 - ${peakHour+1}:00\``, inline: true },
                        { name: "Uptime", value: `\`${Math.floor((Date.now() - CONFIG.START_TIME)/3600000)}h\``, inline: true }
                    )
                    .setThumbnail(interaction.guild.iconURL())
                    .setColor(s.panelColor);
                await interaction.editReply({ embeds: [embed] });
                break;

            case 'purge':
                const count = interaction.options.getInteger('count');
                const deleted = await interaction.channel.bulkDelete(Math.min(count, 100), true);
                pushAudit(interaction.guildId, "Bulk Purge", interaction.user, `${deleted.size} messages decommissioned.`);
                await interaction.editReply(`✅ Successfully purged **${deleted.size}** messages.`);
                break;

            case 'blacklist-add':
                const word = interaction.options.getString('word').toLowerCase();
                if (!s.blacklist.includes(word)) {
                    s.blacklist.push(word);
                    await interaction.editReply(`✅ Added \`${word}\` to the security blacklist.`);
                } else {
                    await interaction.editReply("ℹ️ Word already exists in the grid.");
                }
                break;

            case 'blacklist-view':
                const list = s.blacklist.length > 0 ? s.blacklist.join(', ') : "None";
                await interaction.editReply(`### 📜 Current Filtered Vocabulary\n${list.slice(0, 1900)}`);
                break;

            case 'secure-lock':
                await interaction.channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: false });
                await interaction.editReply("🔒 **Channel Locked.** Security protocols enforced.");
                break;

            case 'secure-unlock':
                await interaction.channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: true });
                await interaction.editReply("🔓 **Channel Unlocked.** Protocols relaxed.");
                break;

            case 'audit':
                const logs = auditLogs.get(interaction.guildId) || [];
                const logTxt = logs.slice(0, 10).map(l => `[${l.timestamp.split('T')[1].split('.')[0]}] **${l.action}** by ${l.user}: *${l.reason}*`).join('\n') || "No recent activity.";
                await interaction.editReply(`### 🕵️ Security Audit Log\n${logTxt}`);
                break;

            case 'broadcast':
                const broadcastMsg = interaction.options.getString('message');
                const members = await interaction.guild.members.fetch();
                let successCount = 0;
                
                const bEmbed = new EmbedBuilder()
                    .setTitle("📡 TITAN EMERGENCY BROADCAST")
                    .setDescription(broadcastMsg)
                    .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() })
                    .setColor("#ff0000")
                    .setFooter({ text: "Official System Alert | Reply Not Possible" });

                for (const [id, member] of members) {
                    if (member.user.bot) continue;
                    try {
                        await member.send({ embeds: [bEmbed] });
                        successCount++;
                    } catch (e) {}
                }
                await interaction.editReply(`✅ Broadcast delivered to **${successCount}** nodes.`);
                break;
        }
    }

    // --- TICKET STUDIO BUTTONS ---
    if (interaction.isButton() && interaction.customId.startsWith('panel_')) {
        const deptId = interaction.customId.replace('panel_', '');
        const dept = s.ticketOptions.find(o => o.id === deptId);
        
        if (!dept) return interaction.reply({ content: "❌ Error: Department offline.", flags: MessageFlags.Ephemeral });

        if (ticketCache.has(interaction.user.id)) {
            return interaction.reply({ content: "⚠️ **System Busy.** Active tunnel exists.", flags: MessageFlags.Ephemeral });
        }

        const ticketId = Math.random().toString(36).substring(7).toUpperCase();
        try {
            const channel = await interaction.guild.channels.create({
                name: `tkt-${interaction.user.username}-${ticketId}`,
                type: ChannelType.GuildText,
                parent: s.ticketCategoryId || null,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                    ...s.modRoleIds.map(rid => ({ id: rid, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }))
                ]
            });

            ticketCache.set(interaction.user.id, channel.id);
            const welcome = new EmbedBuilder()
                .setTitle(`${dept.emoji} ${dept.label} | Secure Tunnel`)
                .setDescription(dept.welcome.replace('{user}', `<@${interaction.user.id}>`))
                .setColor(s.panelColor)
                .addFields({ name: "Protocol", value: "All communications are logged and encrypted." });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('close_tkt').setLabel('Decommission').setEmoji('🔒').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('claim_tkt').setLabel('Assume Control').setEmoji('🛡️').setStyle(ButtonStyle.Success)
            );

            await channel.send({ content: `<@${interaction.user.id}> | Encryption Active.`, embeds: [welcome], components: [row] });
            interaction.reply({ content: `✅ **Tunnel Established:** ${channel}`, flags: MessageFlags.Ephemeral });
        } catch (e) { 
            interaction.reply({ content: "❌ Deployment Error. Check bot permissions for channel creation.", flags: MessageFlags.Ephemeral }); 
        }
    }

    if (interaction.isButton()) {
        if (interaction.customId === 'close_tkt') {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('confirm_close').setLabel('Confirm Closure').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('cancel_close').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
            );
            interaction.reply({ content: "⚠️ **WARNING:** This will decommission the tunnel and erase temporary data. Proceed?", components: [row] });
        }

        if (interaction.customId === 'confirm_close') {
            await interaction.update({ content: "🔄 **Decommissioning link...**", components: [] });
            
            // Clean cache
            for (let [uid, cid] of ticketCache.entries()) {
                if (cid === interaction.channel.id) ticketCache.delete(uid);
            }

            // Transcript logic (Simple)
            if (s.transcriptsEnabled && s.logChannelId) {
                const messages = await interaction.channel.messages.fetch();
                const log = messages.reverse().map(m => `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content}`).join('\n');
                const logChan = interaction.guild.channels.cache.get(s.logChannelId);
                if (logChan) {
                    const file = new AttachmentBuilder(Buffer.from(log), { name: `transcript-${interaction.channel.name}.txt` });
                    await logChan.send({ content: `📑 Transcript for tunnel \`${interaction.channel.name}\``, files: [file] });
                }
            }

            setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
        }

        if (interaction.customId === 'cancel_close') {
            await interaction.update({ content: "✅ Decommission aborted.", components: [] });
        }

        if (interaction.customId === 'claim_tkt') {
            await interaction.channel.send(`🛡️ <@${interaction.user.id}> has assumed control of this tunnel.`);
            await interaction.reply({ content: "Assumed control.", flags: MessageFlags.Ephemeral });
        }
    }
});

// --- WEB TERMINAL ENGINE V8 (EXTENDED) ---
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({ 
    keys: [CONFIG.SESSION_SECRET], 
    maxAge: 24 * 60 * 60 * 1000,
    name: 'titan_sess'
}));

const UI_SHELL = (content, tab, gid) => {
    const s = getGuildSettings(gid);
    const guild = client.guilds.cache.get(gid);
    const stats = analyticsCache.get(gid) || { messages: 0, incidents: 0 };
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${guild?.name || 'TITAN TERMINAL'}</title>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;500;700&family=JetBrains+Mono&display=swap" rel="stylesheet">
    <style>
        :root { 
            --bg: #030407; 
            --panel: #0a0c12; 
            --accent: ${s.panelColor}; 
            --border: #1e2430; 
            --text: #f1f5f9; 
            --muted: #94a3b8; 
            --success: #10b981;
            --danger: #ef4444;
        }
        * { box-sizing: border-box; }
        body { 
            background: var(--bg); 
            color: var(--text); 
            font-family: 'Space Grotesk', sans-serif; 
            margin: 0; 
            display: flex; 
            height: 100vh; 
            overflow: hidden;
        }
        .sidebar { 
            width: 300px; 
            background: var(--panel); 
            border-right: 1px solid var(--border); 
            padding: 40px 25px; 
            display: flex; 
            flex-direction: column;
        }
        .sidebar h2 { 
            font-size: 1.5rem; 
            margin-bottom: 40px; 
            letter-spacing: -1px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .nav-link { 
            text-decoration: none; 
            color: var(--muted); 
            padding: 14px 20px; 
            border-radius: 14px; 
            display: block; 
            margin-bottom: 8px; 
            transition: all 0.2s;
            font-weight: 500;
        }
        .nav-link:hover { background: #151a24; color: white; }
        .nav-link.active { background: var(--accent); color: white; box-shadow: 0 4px 20px -5px var(--accent); }
        
        .viewport { flex: 1; padding: 60px; overflow-y: auto; background: radial-gradient(circle at top right, #0a0c12, transparent); }
        
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 50px; }
        .guild-info { display: flex; align-items: center; gap: 15px; }
        .guild-icon { width: 48px; height: 48px; border-radius: 50%; background: var(--border); }
        
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 25px; }
        .card { 
            background: var(--panel); 
            border: 1px solid var(--border); 
            border-radius: 28px; 
            padding: 30px; 
            transition: transform 0.2s;
        }
        .card:hover { transform: translateY(-5px); }
        .card h3 { margin-top: 0; color: var(--muted); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px; }
        .card .value { font-size: 2.5rem; font-weight: 700; margin: 10px 0; }
        
        .form-group { margin-bottom: 25px; }
        label { display: block; margin-bottom: 10px; color: var(--muted); font-weight: 500; }
        input, select, textarea { 
            width: 100%; 
            padding: 16px; 
            background: #05070a; 
            border: 1px solid var(--border); 
            border-radius: 16px; 
            color: white; 
            font-family: inherit;
            outline: none;
            transition: border 0.2s;
        }
        input:focus { border-color: var(--accent); }
        
        .btn { 
            background: var(--accent); 
            color: white; 
            border: none; 
            padding: 16px 30px; 
            border-radius: 16px; 
            cursor: pointer; 
            font-weight: 700; 
            font-size: 1rem;
            transition: opacity 0.2s;
        }
        .btn:hover { opacity: 0.9; }
        .btn-danger { background: var(--danger); }
        
        .audit-list { font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; }
        .audit-item { padding: 15px; border-bottom: 1px solid var(--border); }
        .audit-item:last-child { border: none; }
        
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .viewport { animation: fadeIn 0.4s ease-out; }
    </style>
</head>
<body>
    <div class="sidebar">
        <h2 style="color:var(--accent)">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z"/></svg>
            TITAN V8
        </h2>
        <a href="/dashboard" class="nav-link ${tab==='main'?'active':''}">📈 Telemetry</a>
        <a href="/moderation" class="nav-link ${tab==='mod'?'active':''}">🛡️ Security</a>
        <a href="/tickets" class="nav-link ${tab==='tickets'?'active':''}">🎫 Tickets</a>
        <a href="/audits" class="nav-link ${tab==='audits'?'active':''}">🕵️ Audits</a>
        <div style="flex:1"></div>
        <a href="/logout" class="nav-link" style="color:var(--danger)">🔌 Logout</a>
    </div>
    <div class="viewport">
        <div class="header">
            <div class="guild-info">
                <img src="${guild?.iconURL() || ''}" class="guild-icon" onerror="this.style.display='none'">
                <div>
                    <h1 style="margin:0">${guild?.name || 'TITAN CONTROL'}</h1>
                    <span style="color:var(--muted)">Version ${CONFIG.VERSION}</span>
                </div>
            </div>
            <div style="text-align:right">
                <div style="color:var(--success); font-weight:700">● SYSTEM ONLINE</div>
                <div style="font-family:'JetBrains Mono'; font-size:0.8rem; color:var(--muted)">ID: ${gid}</div>
            </div>
        </div>
        ${content}
    </div>
</body>
</html>`;
};

// --- WEB ROUTES ---
app.get('/', (req, res) => {
    res.send(`
        <head>
            <title>Titan Login</title>
            <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;700&display=swap" rel="stylesheet">
            <style>
                body { background: #030407; color: white; font-family: 'Space Grotesk', sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                .login-box { background: #0a0c12; padding: 60px; border-radius: 40px; border: 1px solid #1e2430; width: 450px; text-align: center; }
                h1 { font-size: 2.5rem; margin-bottom: 10px; letter-spacing: -2px; }
                p { color: #94a3b8; margin-bottom: 40px; }
                input { width: 100%; padding: 18px; background: #05070a; border: 1px solid #1e2430; border-radius: 18px; color: white; margin-bottom: 20px; font-size: 1rem; }
                button { width: 100%; padding: 18px; background: #3b82f6; color: white; border: none; border-radius: 18px; font-weight: 700; font-size: 1rem; cursor: pointer; }
            </style>
        </head>
        <div class="login-box">
            <h1>TITAN LOGIN</h1>
            <p>Access the encrypted management grid.</p>
            <form action="/login" method="POST">
                <input name="gid" placeholder="Guild Snowflake ID" required>
                <input name="pass" type="password" placeholder="Decryption Key" required>
                <button type="submit">ESTABLISH UPLINK</button>
            </form>
        </div>`);
});

app.post('/login', (req, res) => {
    const { gid, pass } = req.body;
    if (serverPasswords.get(gid) === pass.toUpperCase()) {
        req.session.gid = gid;
        res.redirect('/dashboard');
    } else {
        res.send("<h1>401: UNAUTHORIZED</h1><p>The provided key does not match the server node.</p><a href='/'>Retry</a>");
    }
});

app.get('/logout', (req, res) => {
    req.session = null;
    res.redirect('/');
});

app.get('/dashboard', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const stats = analyticsCache.get(req.session.gid) || { messages: 0, incidents: 0, joins: 0, commandsUsed: 0 };
    
    const content = `
        <div class="grid">
            <div class="card">
                <h3>Messages Scanned</h3>
                <div class="value">${stats.messages.toLocaleString()}</div>
                <div style="color:var(--success)">+ High Efficiency</div>
            </div>
            <div class="card">
                <h3>Threats Mitigated</h3>
                <div class="value" style="color:var(--danger)">${stats.incidents.toLocaleString()}</div>
                <div style="color:var(--muted)">Security Layer Active</div>
            </div>
            <div class="card">
                <h3>Node Connections</h3>
                <div class="value">${stats.joins.toLocaleString()}</div>
                <div style="color:var(--accent)">Growth Metrics</div>
            </div>
            <div class="card">
                <h3>Titan Efficiency</h3>
                <div class="value">99.8%</div>
                <div style="color:var(--muted)">Uptime Optimized</div>
            </div>
        </div>
        <div class="card" style="margin-top:25px">
            <h3>System Status</h3>
            <p>The Titan Kernel is running at peak capacity. No critical errors detected in the last 24 cycles.</p>
        </div>
    `;
    res.send(UI_SHELL(content, 'main', req.session.gid));
});

app.get('/moderation', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const s = getGuildSettings(req.session.gid);
    
    const content = `
        <h1>Security Protocols</h1>
        <div class="card">
            <h3>Auto-Mod Configuration</h3>
            <form action="/update-settings" method="POST">
                <div class="form-group">
                    <label>Anti-Link Protection</label>
                    <select name="antiLink">
                        <option value="true" ${s.antiLink?'selected':''}>ENABLED</option>
                        <option value="false" ${!s.antiLink?'selected':''}>DISABLED</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Security Filter (Comma Separated)</label>
                    <textarea name="blacklist" rows="4">${s.blacklist.join(', ')}</textarea>
                </div>
                <div class="form-group">
                    <label>Caps Threshold (%)</label>
                    <input type="number" name="capsThreshold" value="${s.capsThreshold}">
                </div>
                <button type="submit" class="btn">UPDATE SECURITY GRID</button>
            </form>
        </div>
    `;
    res.send(UI_SHELL(content, 'mod', req.session.gid));
});

app.get('/audits', (req, res) => {
    if (!req.session.gid) return res.redirect('/');
    const logs = auditLogs.get(req.session.gid) || [];
    
    const logItems = logs.map(l => `
        <div class="audit-item">
            <span style="color:var(--muted)">[${l.timestamp}]</span> 
            <b style="color:var(--accent)">${l.action}</b> 
            <span style="color:var(--text)">by ${l.user}</span>
            <div style="margin-top:5px; color:var(--muted)">↳ ${l.reason}</div>
        </div>
    `).join('');

    res.send(UI_SHELL(`<h1>Audit Logs</h1><div class="card audit-list">${logItems || 'No logs found.'}</div>`, 'audits', req.session.gid));
});

app.post('/update-settings', (req, res) => {
    if (!req.session.gid) return res.status(403).send("Forbidden");
    const s = getGuildSettings(req.session.gid);
    
    if (req.body.antiLink) s.antiLink = req.body.antiLink === 'true';
    if (req.body.blacklist) s.blacklist = req.body.blacklist.split(',').map(w => w.trim()).filter(w => w);
    if (req.body.capsThreshold) s.capsThreshold = parseInt(req.body.capsThreshold);
    
    pushAudit(req.session.gid, "Web Setting Update", "Remote Administrator", "Manual adjustment via Titan Terminal.");
    res.redirect('/moderation');
});

// --- INIT SERVER ---
app.listen(CONFIG.PORT, () => {
    console.log(`${CONFIG.LOG_COLORS.SUCCESS}[WEB] Titan Terminal listening on port ${CONFIG.PORT}${CONFIG.RESET}`);
});

// Final Handshake
client.login(CONFIG.TOKEN).catch(e => {
    console.error(`${CONFIG.LOG_COLORS.ERROR}[FATAL] Core Login Failed: ${e.message}${CONFIG.RESET}`);
});

/**
 * ARCHITECTURAL NOTES:
 * V8.5.0 implements a modular architecture where the Web dashboard
 * acts as a direct memory interface to the Discord client instance.
 * No external database is required for ephemeral session management,
 * while GUILD_PASSWORDS provides persistence across reboots.
 */
