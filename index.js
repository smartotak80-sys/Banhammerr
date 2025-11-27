require("dotenv").config();
const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ButtonBuilder,
    ActionRowBuilder,
    ButtonStyle,
    Events,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require("discord.js");

// === ENV ===
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;

const APPLICATION_CHANNEL_ID = process.env.APPLICATION_CHANNEL_ID;
const RECRUIT_CHANNEL_ID = process.env.RECRUIT_CHANNEL_ID;

const STATS = [
    { id: process.env.CHANNEL_BARRACUDA_ID, role: process.env.ROLE_BARRACUDA_ID, name: "🦈 Barracuda: " },
    { id: process.env.CHANNEL_AKADEMKA_ID, role: process.env.ROLE_AKADEMKA_ID, name: "🎓 Academy: " },
    { id: process.env.CHANNEL_AFK_ID, role: process.env.ROLE_AFK_ID, name: "☕ AFK: " },
    { id: process.env.CHANNEL_ONLINE_ID, role: null, name: "👤 Online Members: " }
];

// === Client ===
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [Partials.GuildMemb]()
