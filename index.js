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
    PermissionsBitField
} = require("discord.js");

// ------------------ КЛІЄНТ ------------------
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [Partials.Channel]
});

// ------------------ ЗМІННІ ------------------
const APPLICATION_CHANNEL_ID = process.env.APPLICATION_CHANNEL_ID;
const RECRUIT_CHANNEL_ID = process.env.RECRUIT_CHANNEL_ID;

const CREATOR_CHANNEL_ID = process.env.CREATOR_CHANNEL_ID;
const CATEGORY_ID = process.env.VOICE_CATEGORY_ID;

// ------------------ КНОПКА ЗАЯВКИ ------------------
const applicationButton = new ButtonBuilder()
    .setCustomId("apply")
    .setLabel("Подати заявку")
    .setStyle(ButtonStyle.Success)
    .setEmoji("✉️");

// ------------------ ready ------------------
client.once("ready", async () => {
    console.log(`✅ Увійшов як ${client.user.tag}`);

    const channel = await client.channels.fetch(APPLICATION_CHANNEL_ID);
    if (!channel) return console.log("❌ Не знайдено канал для кнопки заявки");

    const embed = new EmbedBuilder()
        .setTitle("📢 ВІДКРИТО ПОДАННЯ ЗАЯВОК")
        .setDescription(
            "Ви можете подати заявку.\n\n" +
            "Після заповнення заявки ви отримаєте відповідь у **DM** протягом **2–5 днів**.\n" +
            "⚠️ Переконайтесь, що приймаєте повідомлення у Discord!"
        )
        .setColor("#808080")
        .setFooter({ text: new Date().toLocaleString("uk-UA") });

    const row = new ActionRowBuilder().addComponents(applicationButton);
    await channel.send({ embeds: [embed], components: [row] });
});

// ------------------ INTERACTIONS ------------------
client.on(Events.InteractionCreate, async (interaction) => {

    // ---------- КНОПКА ПОДАТИ ЗАЯВКУ ----------
    if (interaction.isButton() && interaction.customId === "apply") {
        const modal = new ModalBuilder()
            .setCustomId('application_form')
            .setTitle('Заявка на вступ');

        const discord = new TextInputBuilder()
            .setCustomId('discord')
            .setLabel('Ваш Discord')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const rlNameAge = new TextInputBuilder()
            .setCustomId('rlNameAge')
            .setLabel('RL Ім’я / Вік')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const online = new TextInputBuilder()
            .setCustomId('online')
            .setLabel('Онлайн / Часовий пояс')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const families = new TextInputBuilder()
            .setCustomId('families')
            .setLabel('Де були раніше (сімʼї)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        const recoilVideo = new TextInputBuilder()
            .setCustomId('recoilVideo')
            .setLabel('Відео відкату стрільби (YouTube)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(discord),
            new ActionRowBuilder().addComponents(rlNameAge),
            new ActionRowBuilder().addComponents(online),
            new ActionRowBuilder().addComponents(families),
            new ActionRowBuilder().addComponents(recoilVideo)
        );

        return interaction.showModal(modal);
    }

    // ---------- МОДАЛ ЗАЯВКИ ----------
    if (interaction.isModalSubmit() && interaction.customId === 'application_form') {

        const embed = new EmbedBuilder()
            .setTitle('📥 Нова заявка')
            .addFields(
                { name: 'Discord', value: interaction.fields.getTextInputValue('discord') },
                { name: 'RL Ім’я / Вік', value: interaction.fields.getTextInputValue('rlNameAge') },
                { name: 'Онлайн / Часовий пояс', value: interaction.fields.getTextInputValue('online') },
                { name: 'Сімʼї', value: interaction.fields.getTextInputValue('families') },
                { name: 'Відео стрільби', value: interaction.fields.getTextInputValue('recoilVideo') }
            )
            .setColor("#808080")
            .setFooter({ text: `Від ${interaction.user.tag}` });

        const recruitChannel = await client.channels.fetch(RECRUIT_CHANNEL_ID);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`accept_${interaction.user.id}`).setLabel("Прийняти").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`decline_${interaction.user.id}`).setLabel("Відмовити").setStyle(ButtonStyle.Danger)
        );

        await recruitChannel.send({ embeds: [embed], components: [row] });
        return interaction.reply({ content: "✅ Заявку надіслано!", ephemeral: true });
    }

    // ---------- ПРИЙНЯТИ ----------
    if (interaction.isButton() && interaction.customId.startsWith("accept_")) {
        const userId = interaction.customId.split("_")[1];

        const modal = new ModalBuilder()
            .setCustomId(`accept_form_${userId}`)
            .setTitle("Повідомлення про прийняття");

        modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("response")
                .setLabel("Відповідь користувачу")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
        ));

        return interaction.showModal(modal);
    }

    // ---------- НАДІСЛАТИ ВІДПОВІДЬ ПРО ПРИЙНЯТТЯ ----------
    if (interaction.isModalSubmit() && interaction.customId.startsWith("accept_form_")) {
        const userId = interaction.customId.split("_")[2];
        const user = await client.users.fetch(userId);
        const text = interaction.fields.getTextInputValue("response");

        await user.send(`✅ Ваша заявка була **прийнята**.\nВаше повідомлення: ${text}`);

        return interaction.update({ content: "Відповідь надіслана!", components: [], embeds: interaction.message.embeds });
    }

    // ---------- ВІДХИЛИТИ ----------
    if (interaction.isButton() && interaction.customId.startsWith("decline_")) {
        const userId = interaction.customId.split("_")[1];

        const modal = new ModalBuilder()
            .setCustomId(`decline_form_${userId}`)
            .setTitle("Причина відмови");

        modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("reason")
                .setLabel("Причина")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
        ));

        return interaction.showModal(modal);
    }

    // ---------- НАДІСЛАТИ ВІДМОВУ ----------
    if (interaction.isModalSubmit() && interaction.customId.startsWith("decline_form_")) {
        const userId = interaction.customId.split("_")[2];
        const user = await client.users.fetch(userId);
        const reason = interaction.fields.getTextInputValue("reason");

        await user.send(`❌ Ваша заявка була **відхилена**.\nПричина: ${reason}`);

        return interaction.update({ content: "Заявку відхилено!", components: [], embeds: interaction.message.embeds });
    }

});


// ------------------ ПРИВАТНІ КАНАЛИ ------------------
client.on("voiceStateUpdate", async (oldState, newState) => {
    const guild = newState.guild;

    // Якщо зайшов у канал-тригер
    if (newState.channelId === CREATOR_CHANNEL_ID && oldState.channelId !== CREATOR_CHANNEL_ID) {

        const existing = guild.channels.cache
            .filter(c => c.parentId === CATEGORY_ID && c.name.startsWith("Приват"))
            .map(c => c.name);

        let max = 0;
        existing.forEach(name => {
            const match = name.match(/Приват (\d+)/);
            if (match) max = Math.max(max, Number(match[1]));
        });

        const number = max + 1;

        const privateChannel = await guild.channels.create({
            name: `Приват ${number}`,
            type: 2,
            parent: CATEGORY_ID,
            permissionOverwrites: [
                {
                    id: newState.member.id,
                    allow: [
                        PermissionsBitField.Flags.Connect,
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.Speak
                    ]
                },
                {
                    id: guild.roles.everyone.id,
                    deny: [
                        PermissionsBitField.Flags.Connect,
                        PermissionsBitField.Flags.ViewChannel
                    ]
                }
            ]
        });

        await newState.setChannel(privateChannel);
        console.log(`✔ Створено: ${privateChannel.name}`);
    }

    // Видалення порожніх приваток
    if (oldState.channel) {
        const ch = oldState.channel;

        if (
            ch.parentId === CATEGORY_ID &&
            ch.members.size === 0 &&
            ch.name.startsWith("Приват")
        ) {
            if (ch.deletable) {
                await ch.delete().catch(() => {});
                console.log(`🗑 Видалено: ${ch.name}`);
            }
        }
    }
});

// ------------------ LOGIN ------------------
client.login(process.env.DISCORD_TOKEN);

// ------------------ Оголошення ------------------
require("dotenv").config();
const {
    Client,
    GatewayIntentBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    AttachmentBuilder,
    EmbedBuilder,
    Events
} = require("discord.js");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ==== НАЛАШТУЙ ====
// ID каналу, де має стояти кнопка
const ANNOUNCE_CHANNEL_ID = "ВСТАВ_ТУТ_ID_КАНАЛУ";

client.once("ready", async () => {
    console.log(`Бот запущений як ${client.user.tag}`);

    const channel = await client.channels.fetch(ANNOUNCE_CHANNEL_ID);
    if (!channel) return console.log("❌ Канал не знайдено!");

    // Створюємо кнопку-банер
    const bannerButton = new ButtonBuilder()
        .setCustomId("create_announce")
        .setStyle(ButtonStyle.Primary)
        .setLabel("📢 Створити оголошення")
        .setEmoji("📝");

    const row = new ActionRowBuilder().addComponents(bannerButton);

    // Чистимо канал і ставимо кнопку
    await channel.bulkDelete(50).catch(() => {});
    await channel.send({
        content: "Натисни банер нижче, щоб створити оголошення:",
        components: [row]
    });

    console.log("Кнопку встановлено у каналі!");
});

// ====== Натискання кнопки ======
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === "create_announce") {
        const modal = new ModalBuilder()
            .setCustomId("announce_modal")
            .setTitle("Створення оголошення");

        const textInput = new TextInputBuilder()
            .setCustomId("announce_text")
            .setLabel("Введи текст оголошення")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(textInput)
        );

        await interaction.showModal(modal);
    }
});

// ====== Обробка модального вікна ======
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isModalSubmit()) return;

    if (interaction.customId === "announce_modal") {
        const text = interaction.fields.getTextInputValue("announce_text");

        await interaction.reply("Надішли фото або напиши `без фото`.");

        const filter = (m) => m.author.id === interaction.user.id;
        const msg = await interaction.channel.awaitMessages({
            filter,
            max: 1,
            time: 60000
        });

        const message = msg.first();
        let attachment = null;

        if (message.attachments.size > 0) {
            const file = message.attachments.first();
            attachment = new AttachmentBuilder(file.url, { name: "photo.png" });
        }

        const embed = new EmbedBuilder()
            .setTitle("📢 Оголошення")
            .setDescription(text)
            .setColor("#00AAFF")
            .setFooter({ text: `Автор: ${interaction.user.username}` })
            .setTimestamp();

        if (attachment) embed.setImage("attachment://photo.png");

        if (attachment) {
            await interaction.followUp({
                embeds: [embed],
                files: [attachment]
            });
        } else {
        
