import { NATIVE_MINT } from "@solana/spl-token";
import cron from "node-cron";
import redisClient from "../services/redis";
const EVERY_1_MIN = "*/5 * * * * *";
export const runSOLPriceUpdateSchedule = () => {
  try {
    cron
      .schedule(EVERY_1_MIN, () => {
        // Skip fetching when no BirdEye API key configured
        if (!process.env.BIRD_EVEY_API || process.env.BIRD_EVEY_API === "") return;
        updateSolPrice();
      })
      .start();
  } catch (error) {
    console.error(
      `Error running the Schedule Job for fetching the chat data: ${error}`
    );
  }
};

const BIRDEYE_API_KEY = process.env.BIRD_EVEY_API || "";
const REQUEST_HEADER = {
  accept: "application/json",
  "x-chain": "solana",
  "X-API-KEY": BIRDEYE_API_KEY,
};

const updateSolPrice = async () => {
  try {
    const solmint = NATIVE_MINT.toString();
    const key = `${solmint}_price`;
    const options = { method: "GET", headers: REQUEST_HEADER };
    const response = await fetch(
      `https://public-api.birdeye.so/defi/price?address=${solmint}`,
      options
    );
    const res = await response.json();
    if (!res.data || !res.data.value) {
      const now = Date.now();
      if (!(updateSolPrice as any)._lastWarn || now - (updateSolPrice as any)._lastWarn > 5 * 60 * 1000) {
        console.warn('⚠️  BirdEye API returned invalid data', res);
        (updateSolPrice as any)._lastWarn = now;
      }
      return;
    }
    const price = res.data.value;
    await redisClient.set(key, price);
  } catch (e: any) {
    const now = Date.now();
    if (!(updateSolPrice as any)._lastWarn || now - (updateSolPrice as any)._lastWarn > 5 * 60 * 1000) {
      console.warn('⚠️  BirdEye fetch failed:', e?.message ?? e);
      (updateSolPrice as any)._lastWarn = now;
    }
  }
};

// attach a mutable property to throttle warnings
(updateSolPrice as any)._lastWarn = (updateSolPrice as any)._lastWarn || 0;
