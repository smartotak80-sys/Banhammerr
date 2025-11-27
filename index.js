// index.js (ФІНАЛЬНА ВЕРСІЯ: Миттєве Оновлення + Всі Виправлення)

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
} = require("discord.js");

// ------------------ ЗМІННІ КОНФІГУРАЦІЇ ------------------
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const APPLICATION_CHANNEL_ID = process.env.APPLICATION_CHANNEL_ID;
const RECRUIT_CHANNEL_ID = process.env.RECRUIT_CHANNEL_ID;

// --- КОНФІГУРАЦІЯ СТАТИСТИКИ ---
const STATS_CHANNELS = [
    { id: process.env.CHANNEL_BARRACUDA_ID, type: 'ROLE_COUNT', roleId: process.env.ROLE_BARRACUDA_ID, nameTemplate: '🦈 Barracuda: ' },
    { id: process.env.CHANNEL_AKADEMKA_ID, type: 'ROLE_COUNT', roleId: process.env.ROLE_AKADEMKA_ID, nameTemplate: '🎓 Academy: ' },
    { id: process.env.CHANNEL_ONLINE_ID, type: 'ONLINE_MEMBERS', nameTemplate: '👤 Online Members: ' },
    { id: process.env.CHANNEL_AFK_ID, type: 'ROLE_COUNT', roleId: process.env.ROLE_AFK_ID, nameTemplate: '☕ AFK (Role): ' },
];


// ------------------ КЛІЄНТ ТА ОБ'ЄДНАНІ INTENTS ------------------

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
    partials: [Partials.Channel, Partials.GuildMember],
    
    // АГРЕСИВНЕ КЕШУВАННЯ
    sweepers: {
        users: {
            interval: 3600,
            filter: (user) => user.bot,
        },
        guildMembers: {
            interval: 3600,
            filter: (member) => member.presence?.status === 'offline', 
        }
    }
});

// --- ФУНКЦІЇ СТАТИСТИКИ ---

function getChannelCount(guild, config) {
    switch (config.type) {
        case 'ROLE_COUNT':
            return guild.members.cache.filter(member => member.roles.cache.has(config.roleId)).size;
        case 'ONLINE_MEMBERS':
            // Перевіряємо присутність у кеші та статус
            return guild.members.cache.filter(member => member.presence?.status && member.presence.status !== 'offline').size;
        default:
            return 0;
    }
}

async function updateChannelStats(targetChannelId = null) {
    try {
        const guild = client.guilds.cache.get(GUILD_ID);
        if (!guild) return; 

        const channelsToUpdate = targetChannelId 
            ? STATS_CHANNELS.filter(c => c.id === targetChannelId)
            : STATS_CHANNELS;

        for (const config of channelsToUpdate) {
            const count = getChannelCount(guild, config); 
            const ch = await guild.channels.fetch(config.id).catch(() => null);

            if (ch && ch.type === 2) { 
                 const newName = `${config.nameTemplate}${count}`;
                 if (ch.name !== newName) {
                     await ch.setName(newName);
                     console.log(`[СТАТС] Оновлено канал ${config.nameTemplate.trim()}: ${newName}`);
                 } 
            }
        }
    } catch (error) {
        console.error('--- ПОМИЛКА СТАТИСТИКИ ---', error.message);
    }
}

function triggerRoleChannelUpdate() {
    STATS_CHANNELS.forEach(config => {
        if (config.type === 'ROLE_COUNT') {
            updateChannelStats(config.id);
        }
    });
}

function triggerOnlineMembersUpdate() {
    const onlineChannelConfig = STATS_CHANNELS.find(c => c.type === 'ONLINE_MEMBERS');
    if (onlineChannelConfig) {
        updateChannelStats(onlineChannelConfig.id);
    }
}


// ------------------ READY (ОБ'ЄДНАНО) ------------------

client.once("ready", async () => {
    console.log(`✅ Увійшов як ${client.user.tag}`);

    // --- 1. ІНІЦІАЛІЗАЦІЯ СТАТИСТИКИ ---
    const guild = await client.guilds.fetch(GUILD_ID).catch(err => {
        console.error('❌ КРИТИЧНА ПОМИЛКА: Не знайдено сервер. Статистика не працюватиме.', err.message);
        return null;
    });

    if (guild) {
        await guild.members.fetch().catch(e => console.error("❌ Помилка: Не вдалося завантажити членів сервера. Перевірте GuildMembers Intent.", e.message));
        
        // !!! МИТТЄВЕ ОНОВЛЕННЯ ПРИ СТАРТІ !!!
        updateChannelStats(); 
    }
    
    // Регулярне оновлення кожні 10 хвилин
    setInterval(updateChannelStats, 10 * 60 * 1000); 

    // --- 2. ІНІЦІАЛІЗАЦІЯ ЗАЯВОК ---
    const channel = await client.channels.fetch(APPLICATION_CHANNEL_ID).catch(() => null);
    if (!channel) return console.error("❌ Не знайдено канал для кнопки заявки (APPLICATION_CHANNEL_ID). Модуль заявок не працює.");

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
        await channel.send({
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(applicationButton)]
        });
    } catch (e) {
        console.error("❌ Не вдалося надіслати повідомлення заявки. Перевірте права бота.", e.message);
    }
});


// ------------------ ОБРОБКА ПОДІЙ (ІНТЕРАКЦІЇ ТА СТАТУСИ) ------------------

// Оновлення Online Members
client.on('presenceUpdate', (oldPresence, newPresence) => {
    const oldStatus = oldPresence?.status || 'offline'; 
    const newStatus = newPresence?.status || 'offline';
    // Тригер спрацює миттєво при зміні статусу
    if (oldStatus !== newStatus) { 
        triggerOnlineMembersUpdate();
    }
});

// Оновлення ролей
client.on('guildMemberUpdate', (oldMember, newMember) => {
    if (oldMember.partial) oldMember.fetch().catch(() => {}); 
    if (newMember.partial) newMember.fetch().catch(() => {});
    
    if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
        triggerRoleChannelUpdate();
    }
});

client.on('guildMemberAdd', () => triggerRoleChannelUpdate()); 
client.on('guildMemberRemove', () => triggerRoleChannelUpdate());


client.on(Events.InteractionCreate, async (interaction) => {
    // --- ЛОГІКА ЗАЯВОК (ІНТЕРАКЦІЇ) ---
    // ... (Логіка заявок залишається без змін)
    if (interaction.isButton() && interaction.customId === "apply") {
        const modal = new ModalBuilder().setCustomId("application_form").setTitle("Заявка на вступ");
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
                { name: "Відео стрільби", value: interaction.fields.getTextInputValue("recoilVideo") },
            )
            .setColor("#808080")
            .setFooter({ text: `Від: ${interaction.user.tag} | ID: ${interaction.user.id}` });

        try {
            const recruitChannel = await client.channels.fetch(RECRUIT_CHANNEL_ID);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`accept_${interaction.user.id}`).setLabel("Прийняти").setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`decline_${interaction.user.id}`).setLabel("Відмовити").setStyle(ButtonStyle.Danger)
            );
            await recruitChannel.send({ embeds: [embed], components: [row] });
        } catch (e) {
            console.error("❌ Не вдалося надіслати заявку в канал рекрутингу.", e.message);
            return interaction.reply({ content: "⚠️ Виникла внутрішня помилка при надсиланні заявки. Спробуйте пізніше.", ephemeral: true });
        }
        return interaction.reply({ content: "✅ Заявку надіслано! Очікуйте відповіді.", ephemeral: true });
    }

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
        const user = await client.users.fetch(userId);
        const text = interaction.fields.getTextInputValue("response");
        
        let dmSent = true;
        try {
            await user.send(`✅ Ваша заявка була **прийнята**.\nВаше повідомлення: ${text}`);
        } catch (error) { dmSent = false; }
        const contentMessage = dmSent ? "Відповідь надіслана!" : `⚠️ Відповідь НЕ надіслана. Користувач ${user.tag} заблокував приватні повідомлення.`;
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
        const user = await client.users.fetch(userId);
        const reason = interaction.fields.getTextInputValue("reason");

        let dmSent = true;
        try {
            await user.send(`❌ Ваша заявка була **відхилена**.\nПричина: ${reason}`);
        } catch (error) { dmSent = false; }
        
        const contentMessage = dmSent ? "Заявку відхилено!" : `⚠️ Заявку відхилено, але відповідь НЕ надіслана. Користувач ${user.tag} заблокував приватні повідомлення.`;
        return interaction.editReply({ content: contentMessage, components: [], embeds: interaction.message.embeds });
    }
});


// ------------------ LOGIN ------------------
client.login(DISCORD_TOKEN);
