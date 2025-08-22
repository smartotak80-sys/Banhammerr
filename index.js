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

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel]
});

// Кнопка подати заявку
const applicationButton = new ButtonBuilder()
    .setCustomId("apply")
    .setLabel("Подати заявку")
    .setStyle(ButtonStyle.Success)
    .setEmoji("✉️"); // маленький конверт

client.once("ready", async () => {
    console.log(`✅ Увійшов як ${client.user.tag}`);
    
    const channel = await client.channels.fetch(process.env.APPLICATION_CHANNEL_ID);
    if (!channel) return console.log("❌ Не вдалось знайти канал");

    const embed = new EmbedBuilder()
        .setTitle("📢 ВІДКРИТО ПОДАННЯ ЗАЯВОК")
        .setDescription(
            "Ви можете подати заявку.\n\n" +
            "Після заповнення заявки та її розгляду ви отримаєте повідомлення в **особисті повідомлення** від Бота з результатами протягом **2–5 днів**.\n" +
            "⚠️ Відповідь може не надійти, якщо у вас закритий доступ до повідомлень у Discord."
        )
        .setColor("#808080")
        .setFooter({ text: new Date().toLocaleString("uk-UA") });

    const row = new ActionRowBuilder().addComponents(applicationButton);
    await channel.send({ embeds: [embed], components: [row] });
});

client.on(Events.InteractionCreate, async (interaction) => {
    // ---------- КНОПКА ПОДАННЯ ЗАЯВКИ ----------
    if (interaction.isButton() && interaction.customId === "apply") {
        const modal = new ModalBuilder()
            .setCustomId('application_form')
            .setTitle('Заявка на вступ');

        const discord = new TextInputBuilder()
            .setCustomId('discord')
            .setLabel('Основний Discord')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const rlNameAge = new TextInputBuilder()
            .setCustomId('rlNameAge')
            .setLabel('RL Ім’я / RL Вік')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const online = new TextInputBuilder()
            .setCustomId('online')
            .setLabel('Щоденний онлайн / Часовий пояс')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const families = new TextInputBuilder()
            .setCustomId('families')
            .setLabel('У яких сім’ях були')
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

        await interaction.showModal(modal);
        return;
    }

    // ---------- МОДАЛ ПОДАННЯ ЗАЯВКИ ----------
    if (interaction.isModalSubmit() && interaction.customId === 'application_form') {
        const embed = new EmbedBuilder()
            .setTitle('📥 Нова заявка')
            .addFields(
                { name: 'Основний Discord', value: interaction.fields.getTextInputValue('discord') },
                { name: 'RL Ім’я / RL Вік', value: interaction.fields.getTextInputValue('rlNameAge') },
                { name: 'Щоденний онлайн / Часовий пояс', value: interaction.fields.getTextInputValue('online') },
                { name: 'У яких сім’ях були', value: interaction.fields.getTextInputValue('families') },
                { name: 'Відео відкату стрільби', value: interaction.fields.getTextInputValue('recoilVideo') }
            )
            .setColor("#808080")
            .setFooter({ text: `Від ${interaction.user.tag}` });

        const recruitChannel = await client.channels.fetch(process.env.RECRUIT_CHANNEL_ID);

        const decisionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId(`accept_${interaction.user.id}`).setLabel('Прийняти').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`decline_${interaction.user.id}`).setLabel('Відмовити').setStyle(ButtonStyle.Danger)
            );

        await recruitChannel.send({ embeds: [embed], components: [decisionRow] });
        await interaction.reply({ content: '✅ Ваша заявка успішно відправлена!', ephemeral: true });
        return;
    }

    // ---------- ПРИЙНЯТИ ЗАЯВКУ З ВІДПОВІДДЮ ----------
    if (interaction.isButton() && interaction.customId.startsWith('accept_')) {
        const userId = interaction.customId.split('_')[1];

        const modal = new ModalBuilder()
            .setCustomId(`accept_reason_${userId}`)
            .setTitle('Відповідь на заявку');

        const responseInput = new TextInputBuilder()
            .setCustomId('response')
            .setLabel('Напишіть відповідь користувачу')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(responseInput));
        await interaction.showModal(modal);
        return;
    }

    // ---------- ОТРИМАННЯ ВІДПОВІДІ ПРИЙНЯТОЇ ЗАЯВКИ ----------
    if (interaction.isModalSubmit() && interaction.customId.startsWith('accept_reason_')) {
        const userId = interaction.customId.split('_')[2];
        const user = await client.users.fetch(userId);

        const response = interaction.fields.getTextInputValue('response');
        await user.send(`✅ Ваша заявка була **прийнята**.\nВідповідь: ${response}`);
        await interaction.update({ content: 'Відповідь користувачу надіслана!', components: [], embeds: interaction.message.embeds });
        return;
    }

    // ---------- ВІДМОВА З ПРИЧИНОЮ ----------
    if (interaction.isButton() && interaction.customId.startsWith('decline_')) {
        const userId = interaction.customId.split('_')[1];

        const modal = new ModalBuilder()
            .setCustomId(`decline_reason_${userId}`)
            .setTitle('Причина відмови');

        const reasonInput = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Напишіть причину відмови')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
        await interaction.showModal(modal);
        return;
    }

    // ---------- ОТРИМАННЯ ПРИЧИНИ ВІДМОВИ ----------
    if (interaction.isModalSubmit() && interaction.customId.startsWith('decline_reason_')) {
        const userId = interaction.customId.split('_')[2];
        const user = await client.users.fetch(userId);

        const reason = interaction.fields.getTextInputValue('reason');
        await user.send(`❌ Ваша заявка була **відхилена**.\nПричина: ${reason}`);
        await interaction.update({ content: 'Заявка відхилена з причиною!', components: [], embeds: interaction.message.embeds });
        return;
    }
});

client.login(process.env.DISCORD_TOKEN);
