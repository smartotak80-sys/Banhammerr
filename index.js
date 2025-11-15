client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // лог для дебагу
    console.log(`[Interaction] type=${interaction.type} user=${interaction.user?.tag} id=${interaction.id}`);

    // ---------- НАТИСК КНОПКИ ----------
    if (interaction.isButton() && interaction.customId === "apply") {
      // showModal має виконатись якомога швидше — без await перед ним
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

      modal.addComponents(fields.map(f => new ActionRowBuilder().addComponents(f)));

      // викликаємо негайно
      await interaction.showModal(modal);
      return;
    }

    // ---------- ОТРИМАННЯ ЗАЯВКИ ----------
    if (interaction.isModalSubmit() && interaction.customId === "application_form") {
      // тут можна виконувати асинхронні операції (всі вони після showModal, тому без таймаутів)
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
        new ButtonBuilder().setCustomId(`accept_${interaction.user.id}`).setLabel("Прийняти").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`decline_${interaction.user.id}`).setLabel("Відхилити").setStyle(ButtonStyle.Danger)
      );

      // Важливо: fetch каналу може тривати — ми тут вже після showModal, це безпечно
      const recruitChannel = await client.channels.fetch(RECRUIT_CHANNEL_ID);
      await recruitChannel.send({ embeds: [embed], components: [row] });

      // Відповідаємо користувачу — використовуючи flags:64
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

      await interaction.showModal(modal);
      return;
    }

    // ---------- НАДСИЛАННЯ ПРИЙНЯТТЯ ----------
    if (interaction.isModalSubmit() && interaction.customId.startsWith("accept_form_")) {
      const userId = interaction.customId.split("_")[2];
      const user = await client.users.fetch(userId).catch(e => null);
      const message = interaction.fields.getTextInputValue("response");

      if (user) {
        await user.send(`✅ Ваша заявка **прийнята**!\n\n${message}`).catch(() => {});
      }

      // оновлюємо повідомлення в каналі (якщо modal був відкритий з нього)
      if (interaction.message) {
        await interaction.update({ content: "Заявку прийнято!", components: [], embeds: interaction.message.embeds }).catch(() => {});
      } else {
        // якщо interaction.message немає — просто підтверджуємо модально
        await interaction.reply({ content: "Відповідь надіслана!", flags: 64 }).catch(() => {});
      }
      return;
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

      await interaction.showModal(modal);
      return;
    }

    // ---------- НАДСИЛАННЯ ВІДМОВИ ----------
    if (interaction.isModalSubmit() && interaction.customId.startsWith("decline_form_")) {
      const userId = interaction.customId.split("_")[2];
      const user = await client.users.fetch(userId).catch(e => null);
      const reason = interaction.fields.getTextInputValue("reason");

      if (user) {
        await user.send(`❌ Ваша заявка **відхилена**.\nПричина: ${reason}`).catch(() => {});
      }

      if (interaction.message) {
        await interaction.update({ content: "Заявку відхилено!", components: [], embeds: interaction.message.embeds }).catch(() => {});
      } else {
        await interaction.reply({ content: "Заявку відхилено!", flags: 64 }).catch(() => {});
      }
      return;
    }

  } catch (err) {
    console.error("Error in InteractionCreate:", err);
    // якщо interaction ще не відповідав — надішлемо приховане повідомлення з помилкою
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "❌ Сталася помилка. Спробуйте ще раз.", flags: 64 });
      }
    } catch (e) {
      // нічого не робимо — interaction вже міг таймаутитись
    }
  }
});
