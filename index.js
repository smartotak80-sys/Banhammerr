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
    partials: [Partials.GuildMember, Partials.User]
});

// === COUNT SYSTEM ===
function countMembers(guild, stat) {
    if (stat.role) {
        return guild.members.cache.filter(m => m.roles.cache.has(stat.role)).size;
    }
    return guild.members.cache.filter(m => m.presence?.status && m.presence.status !== "offline").size;
}

async function updateStats() {
    try {
        const guild = client.guilds.cache.get(GUILD_ID);
        if (!guild) return;

        await guild.members.fetch(); // важливо для Railway

        for (const stat of STATS) {
            const channel = guild.channels.cache.get(stat.id);
            if (!channel) continue;

            const amount = countMembers(guild, stat);
            const newName = `${stat.name}${amount}`;

            if (channel.name !== newName) {
                await channel.setName(newName).catch(() => {});
            }
        }
    } catch (err) {
        console.log("❌ Помилка оновлення статистики:", err);
    }
}

// === READY ===
client.once("ready", async () => {
    console.log(`✅ Бот запущено: ${client.user.tag}`);

    // Початкове оновлення
    await updateStats();

    // Оновлення кожні 60 сек
    setInterval(updateStats, 60000);

    // Заявка — не спамерить кнопкою
    const ch = await client.channels.fetch(APPLICATION_CHANNEL_ID).catch(() => null);
    if (ch) {
        const messages = await ch.messages.fetch({ limit: 10 }).catch(() => []);
        const alreadyExists = messages.find(m => m.author.id === client.user.id);

        if (!alreadyExists) {
            const btn = new ButtonBuilder()
                .setCustomId("apply")
                .setLabel("Подати заявку")
                .setStyle(ButtonStyle.Success)
                .setEmoji("✉️");

            const embed = new EmbedBuilder()
                .setTitle("📢 ВІДКРИТО ПОДАННЯ ЗАЯВОК")
                .setDescription("Щоб подати заявку — натисніть кнопку нижче. Відповідь прийде у DM протягом 2–5 днів.\n⚠️ Переконайтесь, що у вас відкриті особисті повідомлення!")
                .setColor("#808080");

            await ch.send({
                embeds: [embed],
                components: [new ActionRowBuilder().addComponents(btn)]
            });
        }
    }
});

// === LIVE EVENTS ===
client.on("presenceUpdate", updateStats);
client.on("guildMemberAdd", updateStats);
client.on("guildMemberRemove", updateStats);
client.on("guildMemberUpdate", updateStats);
client.on("voiceStateUpdate", updateStats);

// === BUTTON / MODAL ===
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;

    if (interaction.customId === "apply") {
        const modal = new ModalBuilder()
            .setCustomId("applyModal")
            .setTitle("Заявка");

        const input = new TextInputBuilder()
            .setCustomId("about")
            .setLabel("Розкажіть про себе")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === "applyModal") {
        const txt = interaction.fields.getTextInputValue("about");

        const recruit = await client.channels.fetch(RECRUIT_CHANNEL_ID).catch(() => null);
        if (recruit) {
            recruit.send(`📩 **Нова заявка:**\n${interaction.user}\n\n**Інформація:**\n${txt}`);
        }

        return interaction.reply({
            content: "✅ Заявку прийнято! Очікуйте відповідь у DM.",
            ephemeral: true
        });
    }
});

// === START ===
client.login(DISCORD_TOKEN);
