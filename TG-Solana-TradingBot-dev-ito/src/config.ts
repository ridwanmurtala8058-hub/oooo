import { Commitment, Connection, PublicKey } from "@solana/web3.js";
import 'dotenv/config';

// PostgreSQL Configuration (via .env file)
// DATABASE_URL is used by Prisma automatically from .env
export const DATABASE_USERNAME = "growtrade_user";
export const DATABASE_HOST = process.env.DATABASE_HOST || "localhost";
export const DATABASE_PORT = parseInt(process.env.DATABASE_PORT || "5432");
export const DATABASE_NAME = process.env.DATABASE_NAME || "growtrade_db";

export const TELEGRAM_BOT_API_TOKEN = process.env.TELEGRAM_BOT_API_TOKEN;
export const ALERT_BOT_TOKEN_SECRET = process.env.ALERT_BOT_API_TOKEN;
export const REDIS_URI = process.env.REDIS_URI || "redis://localhost:6379";

// Solana RPC Configuration - Now from .env
export const MAINNET_RPC = process.env.MAINNET_RPC || "https://api.mainnet-beta.solana.com";
export const RPC_WEBSOCKET_ENDPOINT = process.env.RPC_WEBSOCKET_ENDPOINT || "wss://api.mainnet-beta.solana.com";
export const PRIVATE_RPC_ENDPOINT = process.env.PRIVATE_RPC_ENDPOINT || "https://api.mainnet-beta.solana.com";

export const COMMITMENT_LEVEL = 'finalized' as Commitment;
export const connection = new Connection(MAINNET_RPC, COMMITMENT_LEVEL);
export const private_connection = new Connection(PRIVATE_RPC_ENDPOINT, COMMITMENT_LEVEL);

// ============ PHASE 0: SECURITY - MOVED TO .env ============

// Fee Wallet - MUST be configured in .env
// NO LONGER HARDCODED - This is now environment-specific
export const FEE_WALLET_ADDRESS = process.env.FEE_WALLET_ADDRESS;
if (!FEE_WALLET_ADDRESS) {
  console.warn('⚠️ WARNING: FEE_WALLET_ADDRESS not configured in .env - fees cannot be collected');
}

// Fee Percentages (as decimals: 0.01 = 1%)
export const FEE_PERCENT_BUY = parseFloat(process.env.FEE_PERCENT_BUY || "0.01");
export const FEE_PERCENT_SELL = parseFloat(process.env.FEE_PERCENT_SELL || "0.01");
export const FEE_PERCENT_BURN = parseFloat(process.env.FEE_PERCENT_BURN || "0.0075");

// Gas/Jito Fee Presets (in SOL)
export const GAS_FEE_DEFAULT = parseFloat(process.env.GAS_FEE_DEFAULT || "0.005");
export const GAS_FEE_NORMAL = parseFloat(process.env.GAS_FEE_NORMAL || "0.001");
export const GAS_FEE_TURBO = parseFloat(process.env.GAS_FEE_TURBO || "0.025");
export const GAS_FEE_ULTRA = parseFloat(process.env.GAS_FEE_ULTRA || "0.05");

export const JITO_TIP_LAMPORTS = parseInt(process.env.JITO_TIP_LAMPORTS || "1500000");

// MEV Protection Settings
export const MEV_PROTECT_ENABLED = process.env.MEV_PROTECT_ENABLED === "true";
export const USE_JITO_BUNDLE = process.env.USE_JITO_BUNDLE === "true";

// Wallet Encryption Key (AES-256-GCM)
export const WALLET_MASTER_KEY = process.env.WALLET_MASTER_KEY;
if (!WALLET_MASTER_KEY && process.env.NODE_ENV === 'production') {
  throw new Error('CRITICAL: WALLET_MASTER_KEY must be set in .env for production');
}

// Security SAP (Security Access PIN) Settings
export const REQUIRE_SAP_FOR_WITHDRAW = process.env.REQUIRE_SAP_FOR_WITHDRAW !== "false";
export const REQUIRE_SAP_FOR_KEY_EXPORT = process.env.REQUIRE_SAP_FOR_KEY_EXPORT !== "false";
export const REQUIRE_SAP_FOR_WALLET_DELETE = process.env.REQUIRE_SAP_FOR_WALLET_DELETE !== "false";
export const SAP_TIMEOUT_MINUTES = parseInt(process.env.SAP_TIMEOUT_MINUTES || "5");

// Trading Limits
export const MAX_SLIPPAGE_BPS = parseInt(process.env.MAX_SLIPPAGE_BPS || "5000"); // 50%
export const MAX_SINGLE_TRADE_SOL = parseFloat(process.env.MAX_SINGLE_TRADE_SOL || "100");
export const WARN_LARGE_TRADE_SOL = parseFloat(process.env.WARN_LARGE_TRADE_SOL || "10");

// BirdEye API
export const BIRDEYE_API_URL = "https://public-api.birdeye.so";
export const BIRDEYE_API_KEY = process.env.BIRD_EVEY_API || "";
export const JITO_UUID = process.env.JITO_UUID || "";
export const REQUEST_HEADER = {
  'accept': 'application/json',
  'x-chain': 'solana',
  'X-API-KEY': BIRDEYE_API_KEY,
};

export const REFERRAL_ACCOUNT = "DgzkEQqczAZCrUeq52cMbfKgx3mSHUon7wtiVuivs7Q7";

export const MIN = 60;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;
export const WK = 7 * DAY;

export const JUPITER_PROJECT = new PublicKey(
  "45ruCyfdRkWpRNGEqWzjCiXRHkZs8WXCLQ67Pnpye7Hp",
);

export const MAX_CHECK_JITO = 20

export const MAX_WALLET = 5;
export const BOT_NAME = 'Coin Hunter Trading Bot';
export const GrowTradeVersion = '| v6.0 (Phase 0)';

export const GROWSOL_API_ENDPOINT = process.env.GROWSOL_API_ENDPOINT || "http://127.0.0.1:5001";
export const PNL_IMG_GENERATOR_API = process.env.PNL_IMG_GENERATOR_API || "http://127.0.0.1:3001";

export const PNL_SHOW_THRESHOLD_USD = 0.00000005;
export const RAYDIUM_PASS_TIME = 5 * 60 * 60 * 1000;
export const RAYDIUM_AMM_URL = 'https://api.raydium.io/v2/main/pairs'
export const RAYDIUM_CLMM_URL = 'https://api.raydium.io/v2/ammV3/ammPools'