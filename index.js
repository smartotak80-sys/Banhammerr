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
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.GuildMember, Partials.User, Partials.Channel]
});

// ======================================================
// === COUNT FUNCTIONS ==================================
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
        console.log("❌ Помилка updateStats:", err);
    }
}

// ======================================================
// === READY ============================================
// ======================================================

client.once(Events.ClientReady, async () => {
    console.log(`✅ Бот запущено: ${client.user.tag}`);

    // Оновлення кожні 10 сек
    setInterval(updateStats, 10000);

    // Надсилаємо кнопку заявок
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
                    .setDescription("Натисніть кнопку, щоб подати заявку.\n⚠️ DM мають бути відкриті!")
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
// === Interaction: Buttons + Modals =====================
// ======================================================

client.on(Events.InteractionCreate, async (interaction) => {
    try {
        // --- Натиснули кнопку "Подати заявку" ---
        if (interaction.isButton() && interaction.customId === "apply") {
            const modal = new ModalBuilder()
                .setCustomId("application_form")
                .setTitle("Заявка");

            const fields = [
                new TextInputBuilder()
                    .setCustomId("rlNameAge")
                    .setLabel("RL Ім’я / Вік")
                    .setStyle(TextInputStyle.Short),

                new TextInputBuilder()
                    .setCustomId("online")
                    .setLabel("Онлайн / Часовий пояс")
                    .setStyle(TextInputStyle.Short),

                new TextInputBuilder()
                    .setCustomId("families")
                    .setLabel("Де були раніше (сімʼї)")
                    .setStyle(TextInputStyle.Paragraph),

                new TextInputBuilder()
                    .setCustomId("recoilVideo")
                    .setLabel("Відео відкату стрільби (YouTube)")
                    .setStyle(TextInputStyle.Short)
            ];

            modal.addComponents(...fields.map(f => new ActionRowBuilder().addComponents(f)));

            return interaction.showModal(modal);
        }

        // === Обробка заповненої заявки ===
        if (interaction.isModalSubmit() && interaction.customId === "application_form") {
            const rlNameAge = interaction.fields.getTextInputValue("rlNameAge");
            const online = interaction.fields.getTextInputValue("online");
            const families = interaction.fields.getTextInputValue("families");
            const video = interaction.fields.getTextInputValue("recoilVideo");

            const recruitChannel = await client.channels.fetch(RECRUIT_CHANNEL_ID).catch(() => null);

            if (recruitChannel) {
                const embed = new EmbedBuilder()
                    .setTitle("🟦 Нова заявка")
                    .setColor("#808080")
                    .addFields(
                        { name: "Ім’я / Вік", value: rlNameAge },
                        { name: "Онлайн / Пояс", value: online },
                        { name: "Де був", value: families },
                        { name: "Відео", value: video },
                        { name: "Користувач", value: `<@${interaction.user.id}>` }
                    );

                const accept = new ButtonBuilder()
                    .setCustomId(`accept_${interaction.user.id}`)
                    .setLabel("Прийняти")
                    .setStyle(ButtonStyle.Success);

                const decline = new ButtonBuilder()
                    .setCustomId(`decline_${interaction.user.id}`)
                    .setLabel("Відхилити")
                    .setStyle(ButtonStyle.Danger);

                await recruitChannel.send({
                    embeds: [embed],
                    components: [new ActionRowBuilder().addComponents(accept, decline)]
                });
            }

            return interaction.reply({ content: "✔️ Заявка відправлена!", ephemeral: true });
        }

    } catch (err) {
        console.error("❌ Interaction помилка:", err);
    }
});

// ======================================================
// === LOGIN ===========================================
// ======================================================

client.login(DISCORD_TOKEN).catch(err => {
    console.error("❌ Login error:", err.message);
});
