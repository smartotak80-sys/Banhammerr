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
const GUILD_ID = process.env.GUILD_ID || '1056337110560411728';

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
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages // потрібні для відправки заявки
    ],
    partials: [Partials.GuildMember, Partials.User, Partials.Channel]
});

// === Rate-limit / debounce state ===
let lastFullFetchAt = 0; // коли востаннє був повний fetch
let lastUpdateAt = 0; // коли востаннє оновлювалися канали
let pendingUpdate = false;
let rateLimitedUntil = 0; // timestamp після якого можна пробувати знову

const MIN_FULL_FETCH_INTERVAL = 5 * 60 * 1000; // 5 хв між повними fetch (без крайньої потреби)
const MIN_UPDATE_INTERVAL = 10 * 1000; // мінімум 10с між тригерами оновлення
const REGULAR_INTERVAL = 60 * 1000; // регулярний інтервал оновлення каналів

// === Функції підрахунку ===
function countForStat(guild, stat) {
    if (stat.role) {
        return guild.members.cache.filter(m => m.roles.cache.has(stat.role)).size;
    } else {
        // Онлайн — рахуємо по кешу presence (без додаткових fetch)
        return guild.members.cache.filter(m => m.presence?.status && m.presence.status !== "offline").size;
    }
}

// Оновлення назв каналів
async function performChannelRename(guild) {
    for (const stat of STATS) {
        try {
            const ch = guild.channels.cache.get(stat.id) || await guild.channels.fetch(stat.id).catch(() => null);
            if (!ch) continue;

            const cnt = countForStat(guild, stat);
            const newName = `${stat.name}${cnt}`;

            if (ch.name !== newName) {
                await ch.setName(newName).catch(err => {
                    console.warn(`⚠️ Не вдалося змінити ім'я каналу ${stat.name.trim()}:`, err?.message || err);
                });
            }
        } catch (err) {
            console.warn("⚠️ Помилка при оновленні одного з каналів:", err?.message || err);
        }
    }
}

// Основна функція оновлення з урахуванням rate limits і fetch-логіки
async function updateStats({ forceFullFetch = false } = {}) {
    const now = Date.now();

    // Якщо зараз rate-limited — відкласти
    if (now < rateLimitedUntil) {
        if (!pendingUpdate) {
            pendingUpdate = true;
            const wait = Math.ceil((rateLimitedUntil - now) / 1000);
            console.log(`⏳ Встановлено rate limit. Відкладено оновлення на ${wait}s.`);
            setTimeout(() => { pendingUpdate = false; updateStats(); }, rateLimitedUntil - now + 500);
        }
        return;
    }

    // Throttle частих викликів
    if (!forceFullFetch && now - lastUpdateAt < MIN_UPDATE_INTERVAL) {
        // запланувати оновлення після мін інтервалу
        if (!pendingUpdate) {
            pendingUpdate = true;
            setTimeout(() => { pendingUpdate = false; updateStats(); }, MIN_UPDATE_INTERVAL - (now - lastUpdateAt));
        }
        return;
    }

    try {
        const guild = client.guilds.cache.get(GUILD_ID) || await client.guilds.fetch(GUILD_ID).catch(() => null);
        if (!guild) return console.warn("❌ Сервер не знайдено (перевір GUILD_ID).");

        // Повний fetch членів робимо тільки якщо треба (при старті або коли force або минуло довго)
        const needFullFetch = forceFullFetch || (Date.now() - lastFullFetchAt) > MIN_FULL_FETCH_INTERVAL;
        if (needFullFetch) {
            try {
                // НЕ запитуємо withPresences (це викликає opcode 8). Просто fetch members.
                await guild.members.fetch();
                lastFullFetchAt = Date.now();
                // невелика пауза після fetch, щоб кеш оновився
                await new Promise(r => setTimeout(r, 500));
            } catch (err) {
                // Якщо це GatewayRateLimitError — використовуємо retry_after з помилки
                const data = err?.data;
                if (data && typeof data.retry_after === "number") {
                    const retryMs = Math.ceil(data.retry_after * 1000) + 500;
                    rateLimitedUntil = Date.now() + retryMs;
                    console.warn(`❌ Gateway rate limit при fetch members. Retry after ${Math.ceil(retryMs/1000)}s.`);
                    // запланувати повтор після retry
                    setTimeout(() => updateStats({ forceFullFetch: true }), retryMs + 200);
                    return;
                } else {
                    console.warn("⚠️ Помилка під час guild.members.fetch():", err?.message || err);
                }
            }
        }

        // Робимо перейменування каналів за кешом
        await performChannelRename(guild);
        lastUpdateAt = Date.now();
    } catch (err) {
        console.error("❌ Невідома помилка updateStats():", err?.message || err);
    }
}

// === READY (під v14 і v15) ===
async function onClientReady() {
    console.log(`✅ Бот запущено: ${client.user.tag}`);

    // Початковий повний fetch (force)
    await updateStats({ forceFullFetch: true });

    // Регулярне оновлення
    setInterval(() => updateStats(), REGULAR_INTERVAL);

    // Надіслати кнопку заявки один раз (щоб не спамити)
    if (APPLICATION_CHANNEL_ID) {
        const ch = await client.channels.fetch(APPLICATION_CHANNEL_ID).catch(() => null);
        if (ch) {
            const messages = await ch.messages.fetch({ limit: 10 }).catch(() => []);
            const already = messages.find(m => m.author?.id === client.user.id && m.components?.length);
            if (!already) {
                const btn = new ButtonBuilder()
                    .setCustomId("apply")
                    .setLabel("Подати заявку")
                    .setStyle(ButtonStyle.Success)
                    .setEmoji("✉️");

                const embed = new EmbedBuilder()
                    .setTitle("📢 ВІДКРИТО ПОДАННЯ ЗАЯВОК")
                    .setDescription("Щоб подати заявку — натисніть кнопку нижче. Відповідь прийде у DM протягом 2–5 днів.\n⚠️ Переконайтесь, що у вас відкриті особисті повідомлення!")
                    .setColor("#808080");

                await ch.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)] }).catch(() => {});
            }
        }
    }
}

// Підписка на обидві події — сумісність v14 & v15
client.once("ready", onClientReady);
client.once("clientReady", onClientReady);

// === Події, що тригерять оновлення (не форсують full fetch) ===
client.on("presenceUpdate", () => updateStats());
client.on("voiceStateUpdate", () => updateStats());
client.on("guildMemberAdd", () => updateStats());
client.on("guildMemberRemove", () => updateStats());
client.on("guildMemberUpdate", (oldM, newM) => {
    if (oldM?.roles?.cache?.size !== newM?.roles?.cache?.size) updateStats();
});

// === Interaction (заявки) ===
client.on(Events.InteractionCreate, async (interaction) => {
    try {
        if (interaction.isButton() && interaction.customId === "apply") {
            const modal = new ModalBuilder().setCustomId("application_form").setTitle("Заявка");
            const fields = [
                new TextInputBuilder().setCustomId("rlNameAge").setLabel("RL Ім’я / Вік").setStyle(TextInputStyle.Short).setRequired(true),
                new TextInputBuilder().setCustomId("online").setLabel("Онлайн / Часовий пояс").setStyle(TextInputStyle.Short).setRequired(true),
                new TextInputBuilder().setCustomId("families").setLabel("Де були раніше (сімʼї)").setStyle(TextInputStyle.Paragraph).setRequired(true),
                new TextInputBuilder().setCustomId("recoilVideo").setLabel("Відео відкату стрільби (YouTube)").setStyle(TextInputStyle.Short).setRequired(true)
            ];
            modal.addComponents(...fields.map(f => new ActionRowBuilder().addComponents(f)));
            return interaction.showModal(modal);
        }

        if (interaction.isModalSubmit() && interaction.customId === "application_form") {
            const embed = new EmbedBuilder()
                .setTitle("📥 Нова заявка")
                .addFields(
                    { name: "RL Ім’я / Вік", value: interaction.fields.getTextInputValue("rlNameAge") },
                    { name: "Онлайн / Часовий пояс", value: interaction.fields.getTextInputValue("online") },
                    { name: "Сімʼї", value: interaction.fields.getTextInputValue("families") },
                    { name: "Відео стрільби", value: interaction.fields.getTextInputValue("recoilVideo") }
                )
                .setColor("#808080")
                .setFooter({ text: `Від: ${interaction.user.tag} | ID: ${interaction.user.id}` });

            const recruitChannel = await client.channels.fetch(RECRUIT_CHANNEL_ID).catch(() => null);
            if (recruitChannel) {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`accept_${interaction.user.id}`).setLabel("Прийняти").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`decline_${interaction.user.id}`).setLabel("Відмовити").setStyle(ButtonStyle.Danger)
                );
                await recruitChannel.send({ embeds: [embed], components: [row] }).catch(err => {
                    console.warn("⚠️ Не вдалося надіслати заявку в канал рекрутингу:", err?.message || err);
                });
            }

            return interaction.reply({ content: "✅ Заявку надіслано! Очікуйте відповіді.", ephemeral: true });
        }

        // Обробка accept_/decline_ кнопок і відповідей (як у тебе було)
        if (interaction.isButton() && interaction.customId.startsWith("accept_")) {
            const userId = interaction.customId.split("_")[1];
            const modal = new ModalBuilder().setCustomId(`accept_form_${userId}`).setTitle("Повідомлення про прийняття");
            modal.addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId("response").setLabel("Відповідь користувачу").setStyle(TextInputStyle.Paragraph).setRequired(true)
            ));
            return interaction.showModal(modal);
        }

        if (interaction.isModalSubmit() && interaction.customId.startsWith("accept_form_")) {
            await interaction.deferUpdate();
            const userId = interaction.customId.split("_")[2];
            const text = interaction.fields.getTextInputValue("response");
            let dmSent = true;
            try { await client.users.fetch(userId).then(u => u.send(`✅ Ваша заявка була **прийнята**.\n${text}`)); }
            catch (e) { dmSent = false; }
            const contentMessage = dmSent ? "Відповідь надіслана!" : `⚠️ Відповідь НЕ надіслана.`;
            return interaction.editReply({ content: contentMessage, components: [], embeds: interaction.message.embeds });
        }

        if (interaction.isButton() && interaction.customId.startsWith("decline_")) {
            const userId = interaction.customId.split("_")[1];
            const modal = new ModalBuilder().setCustomId(`decline_form_${userId}`).setTitle("Причина відмови");
            modal.addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId("reason").setLabel("Причина").setStyle(TextInputStyle.Paragraph).setRequired(true)
            ));
            return interaction.showModal(modal);
        }

        if (interaction.isModalSubmit() && interaction.customId.startsWith("decline_form_")) {
            await interaction.deferUpdate();
            const userId = interaction.customId.split("_")[2];
            const reason = interaction.fields.getTextInputValue("reason");
            let dmSent = true;
            try { await client.users.fetch(userId).then(u => u.send(`❌ Ваша заявка була **відхилена**.\nПричина: ${reason}`)); }
            catch (e) { dmSent = false; }
            const contentMessage = dmSent ? "Заявку відхилено!" : `⚠️ Заявку відхилено, але відповідь НЕ надіслана.`;
            return interaction.editReply({ content: contentMessage, components: [], embeds: interaction.message.embeds });
        }

    } catch (err) {
        console.error("❌ Помилка Interaction handler:", err?.message || err);
    }
});

// === LOGIN ===
client.login(DISCORD_TOKEN).catch(err => {
    console.error("❌ Не вдалося залогінитись:", err?.message || err);
});
