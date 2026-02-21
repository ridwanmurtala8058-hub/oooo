import { NATIVE_MINT } from "@solana/spl-token";
import cron from "node-cron";
import redisClient from "../services/redis";
import { OpenMarketSchema } from "../models";
const EVERY_1_MIN = "*/1 * * * *";
export const runOpenmarketCronSchedule = () => {
  try {
    cron
      .schedule(EVERY_1_MIN, () => {
        removeOldDatas();
      })
      .start();
  } catch (error) {
    console.error(
      `Error running the Schedule Job for fetching the chat data: ${error}`
    );
  }
};

const removeOldDatas = async () => {
  try {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    try {
      const result = await Promise.race([
        OpenMarketSchema.deleteMany({
          createdAt: { $lt: threeHoursAgo },
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('MongoDB timeout')), 5000)
        )
      ]);
      // Silently succeed or fail - this is optional cleanup
    } catch (error) {
      // Silently fail - MongoDB might be unavailable
    }
  } catch (e) {
    console.log("🚀 ~ SOL price cron job ~ Failed", e);
  }
};
