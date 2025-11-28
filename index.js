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

// === Client ===
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages
    ],
    partials: [Partials.GuildMember, Partials.User, Partials.Channel]
});

// ======================================================
// === COUNT FUNCTIONS — без fetch() ====================
// ======================================================

function countMembers(guild, roleId) {
    return guild.members.cache.filter(m => m.roles.cache.has(roleId)).size;
}

function countOnline(guild) {
    return guild.members.cache.filter(
        m => m.presence?.status === "online"
    ).size;
}

async function safeSetName(channel, name) {
    if (!channel) return;
    if (channel.name === name) return;
    await channel.setName(name).catch(() => {});
}

async function updateStats() {
    try {
        const guild = client.guilds.cache.get(GUILD_ID);
        if (!guild) return;

        const afk = countMembers(guild, process.env.ROLE_AFK_ID);
        const akademka = countMembers(guild, process.env.ROLE_AKADEMKA_ID);
        const barracuda = countMembers(guild, process.env.ROLE_BARRACUDA_ID);
        const online = countOnline(guild);

        await safeSetName(
            guild.channels.cache.get(process.env.CHANNEL_AFK_ID),
            `☕ AFK: ${afk}`
        );

        await safeSetName(
            guild.channels.cache.get(process.env.CHANNEL_AKADEMKA_ID),
            `📚 Академія: ${akademka}`
        );

        await safeSetName(
            guild.channels.cache.get(process.env.CHANNEL_BARRACUDA_ID),
            `🦈 Barracuda: ${barracuda}`
        );

        await safeSetName(
            guild.channels.cache.get(process.env.CHANNEL_ONLINE_ID),
            `🟢 Online: ${online}`
        );

        console.log(
            `[OK] AFK=${afk} | Академія=${akademka} | Barracuda=${barracuda} | Online=${online}`
        );
    } catch (err) {
        console.log("❌ Помилка updateStats:", err.message);
    }
}

// ======================================================
// === READY ============================================
// ======================================================

client.once("clientReady", async () => {
    console.log(`✅ Бот запущено: ${client.user.tag}`);

    // Статистика кожні 10 секунд
    setInterval(updateStats, 10 * 1000);

    // Надсилаємо кнопку заявок (1 раз)
    if (APPLICATION_CHANNEL_ID) {
        const ch = await client.channels.fetch(APPLICATION_CHANNEL_ID).catch(() => null);
        if (ch) {
            const messages = await ch.messages.fetch({ limit: 10 }).catch(() => []);
            const already = messages.find(
                m => m.author?.id === client.user.id && m.components?.length
            );

            if (!already) {
                const btn = new ButtonBuilder()
                    .setCustomId("apply")
                    .setLabel("Подати заявку")
                    .setStyle(ButtonStyle.Success)
                    .setEmoji("✉️");

                const embed = new EmbedBuilder()
                    .setTitle("📢 ВІДКРИТО ПОДАННЯ ЗАЯВОК")
                    .setDescription(
                        "Щоб подати заявку — натисніть кнопку нижче.\n⚠️ Переконайтесь, що DM відкриті!"
                    )
                    .setColor("#808080");

                await ch.send({
                    embeds: [embed],
                    components: [new ActionRowBuilder().addComponents(btn)]
                });
            }
        }
    }
});

// ======================================================
// === InteractionCreate — заявки ========================
// ======================================================

client.on(Events.InteractionCreate, async (interaction) => {
    try {
        // --- Почати заявку ---
        if (interaction.isButton() && interaction.customId === "apply") {
            const modal = new ModalBuilder()
                .setCustomId("application_form")
                .setTitle("Заявка");

            const fields = [
                new TextInputBuilder()
                    .setCustomId("rlNameAge")
                    .setLabel("RL Ім’я / Вік")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true),

                new TextInputBuilder()
                    .setCustomId("online")
                    .setLabel("Онлайн / Часовий пояс")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true),

                new TextInputBuilder()
                    .setCustomId("families")
                    .setLabel("Де були раніше (сімʼї)")
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true),

                new TextInputBuilder()
                    .setCustomId("recoilVideo")
                    .setLabel("Відео відкату стрільби (YouTube)")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ];

            modal.addComponents(...fields.map(f => new ActionRowBuilder().addComponents(f)));

            return interaction.showModal(modal);
        }

        // --- Прийняти заявку ---
        if (interaction.isButton() && interaction.customId.startsWith("accept_")) {
            const userId = interaction.customId.split("_")[1];

            const modal = new ModalBuilder()
                .setCustomId(`accept_form_${userId}`)
                .setTitle("Повідомлення про прийняття");

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId("response")
                        .setLabel("Відповідь користувачу")
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                )
            );

            return interaction.showModal(modal);
        }

        // --- Відхилити ---
        if (interaction.isButton() && interaction.customId.startsWith("decline_")) {
            const userId = interaction.customId.split("_")[1];

            const modal = new ModalBuilder()
                .setCustomId(`decline_form_${userId}`)
                .setTitle("Причина відмови");

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId("reason")
                        .setLabel("Причина")
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                )
            );

            return interaction.showModal(modal);
        }

    } catch (err) {
        console.error("❌ Interaction помилка:", err.message);
    }
});

// ======================================================
// === LOGIN ===========================================
// ======================================================

client.login(DISCORD_TOKEN).catch(err => {
    console.error("❌ Login error:", err.message);
});
