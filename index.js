// === COUNT FUNCTIONS — без fetch() ===

function countMembers(guild, roleId) {
    return guild.members.cache.filter(m => m.roles.cache.has(roleId)).size;
}

// Тільки зелений статус "online"
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
        const guild = client.guilds.cache.get(process.env.GUILD_ID);
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

// === ЗАПУСК ===

client.on("clientReady", () => {
    console.log(`✅ Бот запущено: ${client.user.tag}`);

    // кожні 10 секунд, без fetch(), 0% шанс на rate-limit
    setInterval(updateStats, 10 * 1000);
});
