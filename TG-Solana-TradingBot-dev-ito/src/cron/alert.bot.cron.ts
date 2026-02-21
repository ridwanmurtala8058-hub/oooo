import TelegramBot from "node-telegram-bot-api";
import {
  alertbotModule,
  sendAlertForOurChannel,
} from "../services/alert.bot.module";
import cron from "node-cron";
import { ALERT_BOT_TOKEN_SECRET } from "../config";

const alertBotToken = ALERT_BOT_TOKEN_SECRET;
let alertBot: TelegramBot | null = null;

if (!alertBotToken) {
  console.warn("⚠️ ALERT_BOT_TOKEN_SECRET not configured - alert bot disabled");
} else {
  alertBot = new TelegramBot(alertBotToken, { polling: true });
}

export { alertBot };

const EVERY_1_MIN = "*/1 * * * *";
export const runAlertBotSchedule = () => {
  if (!alertBot) {
    console.warn("⚠️ Alert bot not configured - skipping alert bot schedule");
    return;
  }
  try {
    cron
      .schedule(EVERY_1_MIN, () => {
        if (alertBot) {
          alertbotModule(alertBot);
        }
      })
      .start();
  } catch (error) {
    console.error(
      `Error running the Schedule Job for fetching the chat data: ${error}`
    );
  }
};

const EVERY_10_MIN = "0 * * * *";
export const runAlertBotForChannel = () => {
  if (!alertBot) {
    console.warn("⚠️ Alert bot not configured - skipping alert bot for channel");
    return;
  }
  try {
    cron
      .schedule(EVERY_10_MIN, () => {
        if (alertBot) {
          sendAlertForOurChannel(alertBot);
        }
      })
      .start();
  } catch (error) {
    console.error(
      `Error running the Schedule Job for fetching the chat data: ${error}`
    );
  }
};
