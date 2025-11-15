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

// ------------------ КЛІЄНТ ------------------
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel]
});

// ------------------ ЗМІННІ ------------------
const APPLICATION_CHANNEL_ID = process.env.APPLICATION_CHANNEL_ID;
const RECRUIT_CHANNEL_ID = process.env.RECRUIT_CHANNEL_ID;

// ------------------ READY ------------------
client.once("ready", async () => {
    console.log(`✅ Увійшов як ${client.user.tag}`);

    const channel = await client.channels.fetch(APPLICATION_CHANNEL_ID);
    if (!channel) return console.log("❌ Не знайдено канал для кнопки заявки");

    const embed = new EmbedBuilder()
        .setTitle("📢 ВІДКРИТО ПОДАННЯ ЗАЯВОК")
        .setDescription(
            "Натисніть кнопку нижче, щоб подати заявку.\n\n" +
            "Після перевірки вам прийде відповідь у **DM**."
        )
        .setColor("#808080")
        .setFooter({ text: new Date().toLocaleString("uk-UA") });

    const button = new ButtonBuilder()
        .setCustomId("apply")
        .setLabel("Подати заявку")
        .setEmoji("✉️")
        .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(button);

    await channel.send({ embeds: [embed], components: [row] });
});

// ------------------ INTERACTIONS ------------------
client.on(Events.InteractionCreate, async (interaction) => {

    // ---------- НАТИСК КНОПКИ ----------
    if (interaction.isButton() && interaction.customId === "apply") {
        const modal = new ModalBuilder()
            .setCustomId("application_form")
            .setTitle("Заявка");

        const fields = [
            new TextInputBuilder()
                .setCustomId("discord")
                .setLabel("Ваш Discord (нік)")
                .setStyle(TextInputStyle.Short)
                .setRequired(true),

            new TextInputBuilder()
                .setCustomId("rlNameAge")
                .setLabel("Ваше імʼя та вік")
                .setStyle(TextInputStyle.Short)
                .setRequired(true),

            new TextInputBuilder()
                .setCustomId("online")
                .setLabel("Онлайн / Часовий пояс")
                .setStyle(TextInputStyle.Short)
                .setRequired(true),

            new TextInputBuilder()
                .setCustomId("families")
                .setLabel("Попередні сімʼї / де були")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true),

            new TextInputBuilder()
                .setCustomId("recoilVideo")
                .setLabel("Посилання на відео стрільби (YouTube)")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        ];

        modal.addComponents(
            fields.map(f => new ActionRowBuilder().addComponents(f))
        );

        return interaction.showModal(modal);
    }

    // ---------- ОТРИМАННЯ ЗАЯВКИ ----------
    if (interaction.isModalSubmit() && interaction.customId === "application_form") {

        const embed = new EmbedBuilder()
            .setTitle("📥 Нова заявка")
            .addFields(
                { name: "Discord", value: interaction.fields.getTextInputValue("discord") },
                { name: "Імʼя / Вік", value: interaction.fields.getTextInputValue("rlNameAge") },
                { name: "Онлайн", value: interaction.fields.getTextInputValue("online") },
                { name: "Сімʼї", value: interaction.fields.getTextInputValue("families") },
                { name: "Відео стрільби", value: interaction.fields.getTextInputValue("recoilVideo") }
            )
            .setColor("#808080")
            .setFooter({ text: `Від ${interaction.user.tag}` });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`accept_${interaction.user.id}`)
                .setLabel("Прийняти")
                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
                .setCustomId(`decline_${interaction.user.id}`)
                .setLabel("Відхилити")
                .setStyle(ButtonStyle.Danger)
        );

        const recruitChannel = await client.channels.fetch(RECRUIT_CHANNEL_ID);

        await recruitChannel.send({ embeds: [embed], components: [row] });

        return interaction.reply({ content: "✅ Заявка надіслана!", flags: 64 });
    }

    // ---------- ПРИЙНЯТИ ----------
    if (interaction.isButton() && interaction.customId.startsWith("accept_")) {
        const userId = interaction.customId.split("_")[1];

        const modal = new ModalBuilder()
            .setTitle("Повідомлення про прийняття")
            .setCustomId(`accept_form_${userId}`)
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId("response")
                        .setLabel("Повідомлення користувачу")
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                )
            );

        return interaction.showModal(modal);
    }

    // ---------- НАДСИЛАННЯ ПРИЙНЯТТЯ ----------
    if (interaction.isModalSubmit() && interaction.customId.startsWith("accept_form_")) {
        const userId = interaction.customId.split("_")[2];
        const user = await client.users.fetch(userId);

        await user.send(`✅ Ваша заявка **прийнята**!\n\n${interaction.fields.getTextInputValue("response")}`);

        return interaction.update({
            content: "Заявку прийнято!",
            components: [],
            embeds: interaction.message.embeds
        });
    }

    // ---------- ВІДХИЛИТИ ----------
    if (interaction.isButton() && interaction.customId.startsWith("decline_")) {
        const userId = interaction.customId.split("_")[1];

        const modal = new ModalBuilder()
            .setTitle("Причина відмови")
            .setCustomId(`decline_form_${userId}`)
            .addComponents(
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

    // ---------- НАДСИЛАННЯ ВІДМОВИ ----------
    if (interaction.isModalSubmit() && interaction.customId.startsWith("decline_form_")) {
        const userId = interaction.customId.split("_")[2];
        const user = await client.users.fetch(userId);

        await user.send(`❌ Ваша заявка **відхилена**.\nПричина: ${interaction.fields.getTextInputValue("reason")}`);

        return interaction.update({
            content: "Заявку відхилено!",
            components: [],
            embeds: interaction.message.embeds
        });
    }
});

// ------------------ LOGIN ------------------
client.login(process.env.DISCORD_TOKEN);
