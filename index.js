// index.js (ФІНАЛЬНЕ ВИПРАВЛЕННЯ ДЛЯ МИТТЄВОГО ОНОВЛЕННЯ)

// ... (весь код перед client.once("ready",...) залишається без змін)

client.once("ready", async () => {
    console.log(`✅ Увійшов як ${client.user.tag}`);

    // --- 1. ІНІЦІАЛІЗАЦІЯ СТАТИСТИКИ ---
    const guild = await client.guilds.fetch(GUILD_ID).catch(err => {
        console.error('❌ КРИТИЧНА ПОМИЛКА: Не знайдено сервер. Статистика не працюватиме.', err.message);
        return null;
    });

    if (guild) {
        // Гарантуємо заповнення кешу
        await guild.members.fetch().catch(e => console.error("❌ Помилка: Не вдалося завантажити членів сервера. Перевірте GuildMembers Intent.", e.message));
        
        // !!! ЗМІНА ТУТ !!!: Викликаємо оновлення для Online Members одразу
        updateChannelStats(); 
    }
    
    // Регулярне оновлення Online Members
    setInterval(updateChannelStats, 10 * 60 * 1000); 

// ... (весь код після цього залишається без змін)
