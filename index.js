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
    TextInputStyle,
    ChannelType
} = require("discord.js");

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = '1056337110560411728';

const APPLICATION_CHANNEL_ID = process.env.APPLICATION_CHANNEL_ID;
const RECRUIT_CHANNEL_ID = process.env.RECRUIT_CHANNEL_ID;

const STATS_CHANNELS = [
    { id: process.env.CHANNEL_BARRACUDA_ID, type: 'ROLE_COUNT', roleId: process.env.ROLE_BARRACUDA_ID, nameTemplate: '🦈 Barracuda: ' },
    { id: process.env.CHANNEL_AKADEMKA_ID, type: 'ROLE_COUNT', roleId: process.env.ROLE_AKADEMKA_ID, nameTemplate: '🎓 Academy: ' },
    { id: process.env.CHANNEL_AFK_ID, type: 'ROLE_COUNT', roleId: process.env.ROLE_AFK_ID, nameTemplate: '☕ AFK: ' },
    { id: process.env.CHANNEL_ONLINE_ID, type: 'ONLINE_MEMBERS', nameTemplate: '👤 Online Members: ' }
];

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [Partials.Channel, Partials.GuildMember]
});

function getChannelCount(guild, config) {
    switch (config.type) {
        case 'ROLE_COUNT':
            return guild.members.cache.filter(member => member.roles.cache.has(config.roleId)).size;
        case 'ONLINE_MEMBERS':
            return guild.members.cache.filter(
                member => member.presence?.status && member.presence.status !== 'offline'
            ).size;
        default:
            return 0;
    }
}

async function updateChannelStats(targetChannelId = null) {
    try {
        const guild = client.guilds.cache.get(GUILD_ID);
        if (!guild) return;

        await guild.members.fetch({ force: true, cache: true, withPresences: true }).catch(() => {});

        const channelsToUpdate = targetChannelId
            ? STATS_CHANNELS.filter(c => c.id === targetChannelId)
            : STATS_CHANNELS;

        for (const config of channelsToUpdate) {
            const count = getChannelCount(guild, config);
            const ch = await guild.channels.fetch(config.id).catch(() => null);
            if (ch) {
                const newName = `${config.nameTemplate}${count}`;
                if (ch.name !== newName) {
                    await ch.setName(newName);
                    console.log(`[СТАТС] Оновлено канал ${config.nameTemplate.trim()}: ${newName}`);
                }
            }
        }
    } catch (error) {
        console.error('--- ПОМИЛКА СТАТИСТИКИ ---', error);
    }
}

function triggerFullStatUpdate() {
    updateChannelStats();
}

client.once("ready", async () => {
    console.log(`✅ Увійшов як ${client.user.tag}`);

    await updateChannelStats();
    setInterval(updateChannelStats, 60 * 1000);

    const channel = await client.channels.fetch(APPLICATION_CHANNEL_ID).catch(() => null);
    if (channel) {
        const applicationButton = new ButtonBuilder()
            .setCustomId("apply")
            .setLabel("Подати заявку")
            .setStyle(ButtonStyle.Success)
            .setEmoji("✉️");

        const embed = new EmbedBuilder()
            .setTitle("📢 ВІДКРИТО ПОДАННЯ ЗАЯВОК")
            .setDescription("Ви можете подати заявку.\n\nПісля заповнення заявки ви отримаєте відповідь у **DM** протягом **2–5 днів**.\n⚠️ Переконайтесь, що відкриті DM!")
            .setColor("#808080")
            .setFooter({ text: new Date().toLocaleString("uk-UA") });

        try {
            await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(applicationButton)] });
        } catch (e) {
            console.error("❌ Не вдалося надіслати повідомлення заявки.", e.message);
        }
    } else {
        console.error("❌ Не знайдено канал для заявки (APPLICATION_CHANNEL_ID).");
    }
});

client.on("presenceUpdate", (oldPresence, newPresence) => {
    if (newPresence.guild.id === GUILD_ID) {
        triggerFullStatUpdate();
    }
});

client.on("guildMemberUpdate", (oldMember, newMember) => {
    if (newMember.guild.id === GUILD_ID && oldMember.roles.cache.size !== newMember.roles.cache.size) {
        triggerFullStatUpdate();
    }
});

client.on("guildMemberAdd", member => {
    if (member.guild.id === GUILD_ID) triggerFullStatUpdate();
});
client.on("guildMemberRemove", member => {
    if (member.guild.id === GUILD_ID) triggerFullStatUpdate();
});

// — ОНОВЛЕННЯ ПРИ ГОЛОСОВИХ — (якщо потрібно)
client.on("voiceStateUpdate", (oldState, newState) => {
    if (newState.guild.id === GUILD_ID) {
        triggerFullStatUpdate();
    }
});

client.on(Events.InteractionCreate, async (interaction) => {
    // — тут твій існуючий код для модалів / заявок / рішень — без змін —
    // …
});

client.login(DISCORD_TOKEN);
