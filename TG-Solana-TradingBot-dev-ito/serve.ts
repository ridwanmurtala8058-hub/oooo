require("dotenv").config();

// Output immediately to stderr to ensure visibility
process.stderr.write('[SERVE] Server starting - lazy loading modules...\n');

const startBotAsync = async () => {
  try {
    process.stderr.write('[SERVE] Importing main...\n');
    const startTradeBot = (await import("./src/main")).default;
    process.stderr.write('[SERVE] Main imported\n');
    
    process.stderr.write('[SERVE] Importing prisma...\n');
    const { connectDatabase } = await import("./src/services/prisma");
    process.stderr.write('[SERVE] Prisma imported\n');
    
    process.stderr.write('[SERVE] Importing redis...\n');
    const redisClient = (await import("./src/services/redis")).default;
    process.stderr.write('[SERVE] Redis imported\n');

    // Try to connect to database (non-blocking)
    process.stderr.write('[SERVE] Attempting database connection...\n');
    connectDatabase()
      .then(() => {
        process.stderr.write('[SERVE] ✅ PostgreSQL connected\n');
      })
      .catch(error => {
        process.stderr.write('[SERVE] ⚠️  Database unavailable\n');
      });

    // Try to connect to Redis with timeout (non-blocking)
    process.stderr.write('[SERVE] Attempting Redis connection...\n');
    Promise.race([
      redisClient.connect().catch(() => null),
      new Promise((resolve) => setTimeout(() => resolve(null), 2000))
    ])
      .then(() => {
        process.stderr.write('[SERVE] ✅ Redis available\n');
      })
      .catch(() => {
        process.stderr.write('[SERVE] ⚠️  Redis unavailable\n');
      });

    // Start the bot
    process.stderr.write('[SERVE] Starting Telegram bot...\n');
    process.stderr.write('\n🚀 Trading Bot Initialized\n');
    process.stderr.write('✅ Telegram Bot Ready - Listening for commands...\n\n');
    
    startTradeBot();

  } catch (error) {
    process.stderr.write(`[SERVE] ERROR: ${error}\n`);
    process.exit(1);
  }
};

// Start bot after a short delay
setTimeout(() => {
  startBotAsync().catch(err => {
    process.stderr.write(`[SERVE] Fatal error: ${err}\n`);
    process.exit(1);
  });
}, 50);
