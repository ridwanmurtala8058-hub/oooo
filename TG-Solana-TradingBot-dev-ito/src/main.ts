import TelegramBot from "node-telegram-bot-api";
import { PNL_IMG_GENERATOR_API, TELEGRAM_BOT_API_TOKEN } from "./config";
import { AlertBotID, BotMenu } from "./bot.opts";
import { WelcomeScreenHandler } from "./screens/welcome.screen";
import { callbackQueryHandler } from "./controllers/callback.handler";
import { messageHandler } from "./controllers/message.handler";
import { positionScreenHandler } from "./screens/position.screen";
import { UserService } from "./services/user.service";
import {
  alertBot,
  runAlertBotForChannel,
  runAlertBotSchedule,
} from "./cron/alert.bot.cron";
import {
  newReferralChannelHandler,
  removeReferralChannelHandler,
} from "./services/alert.bot.module";
import { runSOLPriceUpdateSchedule } from "./cron/sol.price.cron";
import { settingScreenHandler } from "./screens/settings.screen";
import {
  ReferralChannelService,
  ReferralPlatform,
} from "./services/referral.channel.service";
import { ReferrerListService } from "./services/referrer.list.service";
import { wait } from "./utils/wait";
import { runOpenmarketCronSchedule } from "./cron/remove.openmarket.cron";
// NOTE: runListener is lazy-loaded to avoid blocking startup on Solana RPC connection

const token = TELEGRAM_BOT_API_TOKEN;

if (!token) {
  throw new Error(
    "TELEGRAM_BOT API_KEY is not defined in the environment variables"
  );
}

export interface ReferralIdenticalType {
  referrer: string;
  chatId: string;
  messageId: string;
  channelName: string;
}

const startTradeBot = () => {
  process.stderr.write('[BOT] Creating Telegram bot instance...\n');
  const bot = new TelegramBot(token, { polling: true });
  
  process.stderr.write('[BOT] Setting up error handlers...\n');
  bot.on('polling_error', (err: any) => {
    process.stderr.write(`[BOT] Polling error: ${err?.message}\n`);
    // Handle Telegram 409 Conflict (another getUpdates request)
    const is409 = err?.response?.statusCode === 409 || err?.code === 409 || (err?.message && err.message.includes('409')) || (err?.message && err.message.includes('terminated by other getUpdates'));
    if (is409) {
      process.stderr.write('[BOT] Detected 409 Conflict (another getUpdates). Stopping polling and attempting backoff restart.\n');
      try {
        (bot as any).stopPolling();
      } catch (e) {}

      let retryInterval = 60 * 1000; // 1 minute
      const maxInterval = 30 * 60 * 1000; // 30 minutes

      const attemptRestart = () => {
        process.stderr.write(`[BOT] Attempting to restart polling in ${Math.round(retryInterval/1000)}s...\n`);
        setTimeout(() => {
          try {
            (bot as any).startPolling();
            process.stderr.write('[BOT] Polling restarted\n');
          } catch (e: any) {
            process.stderr.write(`[BOT] Restart failed: ${e?.message ?? e}\n`);
            retryInterval = Math.min(maxInterval, retryInterval * 2);
            attemptRestart();
          }
        }, retryInterval);
      };

      attemptRestart();
    }
  });

  (bot as any).on('error', (err: any) => {
    process.stderr.write(`[BOT] Bot error: ${err.message}\n`);
  });
  
  process.stderr.write('[BOT] Initializing bot...\n');
  bot.setMyCommands(BotMenu);

  // Background services - start asynchronously
  setTimeout(() => {
    try {
      runOpenmarketCronSchedule();
    } catch (e) {
      console.warn('OpenMarket cron issue:', e);
    }
  }, 300);

  setTimeout(() => {
    try {
      runSOLPriceUpdateSchedule();
    } catch (e) {
      console.warn('SOL price cron issue:', e);
    }
  }, 600);

  setTimeout(() => {
    try {
      // Lazy load Raydium listener - this creates web socket connections
      import("./raydium").then(({ runListener }) => {
        runListener().catch((e) => {
          console.warn('Raydium listener issue:', e);
        });
      }).catch((e) => {
        console.warn('Failed to load Raydium:', e);
      });
    } catch (e) {
      console.warn('Raydium issue:', e);
    }
  }, 1000);

  runAlertBotSchedule();

  // Bot event handlers
  bot.on('callback_query', async (callbackQuery: TelegramBot.CallbackQuery) => {
    callbackQueryHandler(bot, callbackQuery);
  });

  bot.on('message', async (msg: TelegramBot.Message) => {
    messageHandler(bot, msg);
  });

  // Bot commands
  bot.onText(/\/start/, async (msg: TelegramBot.Message) => {
    bot.deleteMessage(msg.chat.id, msg.message_id);
    await WelcomeScreenHandler(bot, msg);
    const referralcode = UserService.extractUniqueCode(msg.text ?? "");
    if (referralcode && referralcode !== "") {
      const chat = msg.chat;
      if (chat.username) {
        const data = await UserService.findLastOne({ username: chat.username });
        if (data && data.referral_code && data.referral_code !== "") return;
        await UserService.updateMany(
          { username: chat.username },
          {
            referral_code: referralcode,
            referral_date: new Date(),
          }
        );
      }
    }
  });

  bot.onText(/\/position/, async (msg: TelegramBot.Message) => {
    await positionScreenHandler(bot, msg);
  });

  bot.onText(/\/settings/, async (msg: TelegramBot.Message) => {
    await settingScreenHandler(bot, msg);
  });

  // Alert bot handlers
  if (alertBot) {
    const alertBotInstance = alertBot;
    
    alertBotInstance.onText(/\/start/, async (msg: TelegramBot.Message) => {
      const { from, chat, text, message_id } = msg;
      if (text && text.includes(`/start@${AlertBotID}`)) {
        try {
          await wait(3000);
          await alertBotInstance.deleteMessage(chat.id, message_id);
        } catch (e) {}
        
        if (!from || !text.includes(" ")) return;
        const referrerInfo = await ReferrerListService.findLastOne({
          referrer: from.username,
          chatId: chat.id.toString(),
        });
        if (!referrerInfo) return;
        
        const { referrer, chatId, channelName } = referrerInfo;
        const parts = text.split(" ");
        if (parts.length < 2 || parts[0] !== `/start@${AlertBotID}`) return;
        
        const botType = parts[1];
        const referralChannelService = new ReferralChannelService();
        
        if (botType === "tradebot") {
          await referralChannelService.addReferralChannel({
            creator: referrer,
            platform: ReferralPlatform.TradeBot,
            chat_id: chatId,
            channel_name: channelName,
          });
        } else if (botType === "bridgebot") {
          await referralChannelService.addReferralChannel({
            creator: referrer,
            platform: ReferralPlatform.BridgeBot,
            chat_id: chatId,
            channel_name: channelName,
          });
        }
      }
    });

    alertBotInstance.on('new_chat_members', async (msg: TelegramBot.Message) => {
      const data = await newReferralChannelHandler(msg);
      if (!data) return;
      try {
        await ReferrerListService.create(data);
      } catch (e) {}
    });

    alertBotInstance.on('left_chat_member', async (msg: TelegramBot.Message) => {
      await removeReferralChannelHandler(msg);
    });
  }

  process.stderr.write('✅ Telegram Bot Ready\n');
};

export default startTradeBot;
