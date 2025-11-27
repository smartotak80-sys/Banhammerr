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
            "⚠️ Переконайтесь, що відкриті DM!"
        )
        .setColor("#808080")
        .setFooter({ text: new Date().toLocaleString("uk-UA") });

    // Цей блок надсилає повідомлення лише один раз, якщо ви його не видаляли
    // Якщо повідомлення вже існує, варто замінити цей блок на логіку перевірки
    // або вручну видалити старе повідомлення в каналі Discord.
    // await channel.send({
    //     embeds: [embed],
    //     components: [new ActionRowBuilder().addComponents(applicationButton)]
    // });
});

// ------------------ INTERACTIONS ------------------
client.on(Events.InteractionCreate, async (interaction) => {

    // ---------- КНОПКА ПОДАТИ ЗАЯВКУ ----------
    if (interaction.isButton() && interaction.customId === "apply") {

        const modal = new ModalBuilder()
            .setCustomId("application_form")
            .setTitle("Заявка на вступ");

        const fields = [
            new TextInputBuilder().setCustomId("rlNameAge").setLabel("RL Ім’я / Вік").setStyle(TextInputStyle.Short).setRequired(true),
            new TextInputBuilder().setCustomId("online").setLabel("Онлайн / Часовий пояс").setStyle(TextInputStyle.Short).setRequired(true),
            new TextInputBuilder().setCustomId("families").setLabel("Де були раніше (сімʼї)").setStyle(TextInputStyle.Paragraph).setRequired(true),
            new TextInputBuilder().setCustomId("recoilVideo").setLabel("Відео відкату стрільби (YouTube)").setStyle(TextInputStyle.Short).setRequired(true)
        ];

        modal.addComponents(
            ...fields.map(f => new ActionRowBuilder().addComponents(f))
        );

        return interaction.showModal(modal);
    }

    // ---------- МОДАЛ ЗАЯВКИ (ВИПРАВЛЕНО) ----------
    if (interaction.isModalSubmit() && interaction.customId === "application_form") {

        const embed = new EmbedBuilder()
            .setTitle("📥 Нова заявка")
            .addFields(
                // ВИПРАВЛЕННЯ: Використовуємо згадку користувача замість неіснуючого поля "discord"
                { name: "Discord", value: interaction.user.toString() }, 
                { name: "RL Ім’я / Вік", value: interaction.fields.getTextInputValue("rlNameAge") },
                { name: "Онлайн / Часовий пояс", value: interaction.fields.getTextInputValue("online") },
                { name: "Сімʼї", value: interaction.fields.getTextInputValue("families") },
                { name: "Відео стрільби", value: interaction.fields.getTextInputValue("recoilVideo") },
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

    // ---------- ВІДПОВІДЬ ПРО ПРИЙНЯТТЯ ----------
    if (interaction.isModalSubmit() && interaction.customId.startsWith("accept_form_")) {
        const userId = interaction.customId.split("_")[2];
        const user = await client.users.fetch(userId);

        const text = interaction.fields.getTextInputValue("response");

        await user.send(`✅ Ваша заявка була **прийнята**.\nВаше повідомлення: ${text}`);

        // Оновлюємо оригінальне повідомлення, щоб показати, що заявка опрацьована
        return interaction.update({ content: "Відповідь надіслана!", components: [], embeds: interaction.message.embeds });
    }

    // ---------- ВІДХИЛИТИ ----------
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

    // ---------- НАДІСЛАТИ ВІДМОВУ ----------
    if (interaction.isModalSubmit() && interaction.customId.startsWith("decline_form_")) {
        const userId = interaction.customId.split("_")[2];
        const user = await client.users.fetch(userId);

        const reason = interaction.fields.getTextInputValue("reason");

        await user.send(`❌ Ваша заявка була **відхилена**.\nПричина: ${reason}`);

        // Оновлюємо оригінальне повідомлення, щоб показати, що заявка опрацьована
        return interaction.update({
            content: "Заявку відхилено!",
            components: [],
            embeds: interaction.message.embeds
        });
    }
});

// ------------------ LOGIN ------------------
client.login(process.env.TOKEN);
