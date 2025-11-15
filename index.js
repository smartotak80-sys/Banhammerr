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
    PermissionsBitField,
    AttachmentBuilder
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
const ANNOUNCE_CHANNEL_ID = process.env.ANNOUNCE_CHANNEL_ID;

// ------------------ READY ------------------
client.once("ready", async () => {
    console.log(`✅ Увійшов як ${client.user.tag}`);

    // ---------- Кнопка заявок ----------
    try {
        const channel = await client.channels.fetch(APPLICATION_CHANNEL_ID);
        const embed = new EmbedBuilder()
            .setTitle("📢 ВІДКРИТО ПОДАННЯ ЗАЯВОК")
            .setDescription("Подай заявку та отримай відповідь у DM протягом 2–5 днів.")
            .setColor("#808080");

        const button = new ButtonBuilder()
            .setCustomId("apply")
            .setLabel("Подати заявку")
            .setStyle(ButtonStyle.Success)
            .setEmoji("✉️");

        await channel.send({
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(button)]
        });
    } catch {}

    // ---------- Кнопка оголошення ----------
    try {
        const aChannel = await client.channels.fetch(ANNOUNCE_CHANNEL_ID);

        const btn = new ButtonBuilder()
            .setCustomId("create_announce")
            .setStyle(ButtonStyle.Primary)
            .setLabel("📢 Створити оголошення")
            .setEmoji("📝");

        await aChannel.bulkDelete(50).catch(() => {});
        await aChannel.send({
            content: "Натисни кнопку, щоб створити оголошення:",
            components: [new ActionRowBuilder().addComponents(btn)]
        });
    } catch {}
});

// ------------------ ІНТЕРАКЦІЇ ------------------
client.on(Events.InteractionCreate, async (interaction) => {

    // ---------- КНОПКА: Подати заявку ----------
    if (interaction.isButton() && interaction.customId === "apply") {
        const modal = new ModalBuilder()
            .setCustomId("application_form")
            .setTitle("Заявка на вступ");

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("discord")
                    .setLabel("Ваш Discord")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("rlNameAge")
                    .setLabel("Ім’я / Вік")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("online")
                    .setLabel("Онлайн / Часовий пояс")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("families")
                    .setLabel("Попередні сімʼї")
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("recoilVideo")
                    .setLabel("Відео відкату стрільби")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            )
        );

        return interaction.showModal(modal);
    }

    // ---------- МОДАЛ ЗАЯВКИ ----------
    if (interaction.isModalSubmit() && interaction.customId === "application_form") {

        const embed = new EmbedBuilder()
            .setTitle("📥 Нова заявка")
            .addFields(
                { name: "Discord", value: interaction.fields.getTextInputValue("discord") },
                { name: "Ім’я / Вік", value: interaction.fields.getTextInputValue("rlNameAge") },
                { name: "Онлайн", value: interaction.fields.getTextInputValue("online") },
                { name: "Сімʼї", value: interaction.fields.getTextInputValue("families") },
                { name: "Відео", value: interaction.fields.getTextInputValue("recoilVideo") }
            )
            .setColor("#808080");

        const rec = await client.channels.fetch(RECRUIT_CHANNEL_ID);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`accept_${interaction.user.id}`).setLabel("Прийняти").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`decline_${interaction.user.id}`).setLabel("Відмовити").setStyle(ButtonStyle.Danger)
        );

        await rec.send({ embeds: [embed], components: [row] });

        return interaction.reply({ content: "✅ Заявку відправлено!", ephemeral: true });
    }

    // ---------- ПРИЙНЯТИ ----------
    if (interaction.isButton() && interaction.customId.startsWith("accept_")) {
        const userId = interaction.customId.split("_")[1];

        const modal = new ModalBuilder()
            .setCustomId(`accept_form_${userId}`)
            .setTitle("Відповідь про прийняття");

        modal.addComponents(
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

    if (interaction.isModalSubmit() && interaction.customId.startsWith("accept_form_")) {
        const userId = interaction.customId.split("_")[2];
        const text = interaction.fields.getTextInputValue("response");

        const user = await client.users.fetch(userId);
        await user.send(`✅ Ваша заявка прийнята!\n${text}`);

        return interaction.update({ content: "Відповідь надіслана!", components: [] });
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

    if (interaction.isModalSubmit() && interaction.customId.startsWith("decline_form_")) {
        const userId = interaction.customId.split("_")[2];
        const reason = interaction.fields.getTextInputValue("reason");

        const user = await client.users.fetch(userId);
        await user.send(`❌ Заявку відхилено.\nПричина: ${reason}`);

        return interaction.update({ content: "Заявку відхилено!", components: [] });
    }
// ------------------ ПРИВАТНІ КАНАЛИ ------------------
client.on("voiceStateUpdate", async (oldState, newState) => {
    const guild = newState.guild;

    // Створення приватки
    if (newState.channelId === CREATOR_CHANNEL_ID && oldState.channelId !== CREATOR_CHANNEL_ID) {

        const existing = guild.channels.cache
            .filter(c => c.parentId === CATEGORY_ID && c.name.startsWith("Приват"))
            .map(c => c.name);

        let max = 0;
        existing.forEach(name => {
            const m = name.match(/Приват (\d+)/);
            if (m) max = Math.max(max, Number(m[1]));
        });

        const number = max + 1;

        const privateChannel = await guild.channels.create({
            name: `Приват ${number}`,
            type: 2,
            parent: CATEGORY_ID,
            permissionOverwrites: [
                {
                    id: newState.member.id,
                    allow: ["Connect", "Speak", "ViewChannel"]
                },
                {
                    id: guild.roles.everyone.id,
                    deny: ["Connect", "ViewChannel"]
                }
            ]
        });

        await newState.setChannel(privateChannel);
    }

    // Видалення порожньої приватки
    if (oldState.channel && 
        oldState.channel.parentId === CATEGORY_ID &&
        oldState.channel.members.size === 0 &&
        oldState.channel.name.startsWith("Приват")
    ) {
        if (oldState.channel.deletable) {
            await oldState.channel.delete().catch(() => {});
        }
    }
});

// ------------------ LOGIN ------------------
client.login(process.env.DISCORD_TOKEN);

