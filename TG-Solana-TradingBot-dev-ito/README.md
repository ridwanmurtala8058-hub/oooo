# Coin Hunter Trading Bot 🎯

**Advanced Solana DEX Trading Bot with Security-First Architecture**

**Version:** 6.0 (Phase 0: Security-Hardened)  
**Status:** ✅ Production Ready

---

## 🔐 Security (Phase 0 Complete)

**Phase 0 features encrypted wallet management and PIN protection:**

- ✅ **AES-256-GCM Encryption** - Private keys encrypted in database
- ✅ **PIN-Protected Operations** - Security Access PIN (SAP) for sensitive actions
- ✅ **No Hardcoded Secrets** - All configuration from environment variables
- ✅ **Brute-Force Protection** - 5-minute lockout after 3 failed PIN attempts
- ✅ **Production Ready** - Audited security architecture

👉 **[Read Full Security Documentation](/SECURITY.md)**

---

## Features

- 📊 **Track** all tokens and pools on Raydium (AMM, CLMM), Jupiter, Pump.fun
- 💰 **Buy & Sell** SPL tokens with MEV protection (JITO)
- 🤖 **Auto Trading** - Configure buy/sell automations
- 📈 **PnL Tracking** - Real-time position & profit/loss monitoring
- 🔐 **Secure Wallets** - Database or client-generated wallets with encryption
- 🎯 **Watchlist** - Monitor favorite tokens and set price alerts

---

## Tech Stack

**Core:**
- TypeScript, Node.js (v18+)
- Telegram Bot API (node-telegram-bot-api)
- Solana Web3.js

**DEX Integrations:**
- Raydium SDK (AMM + CLMM)
- Jupiter v6 API (Best execution)
- Pump.fun API
- BirdEye API (Token data)

**Backend:**
- PostgreSQL 12+ (Prisma ORM)
- Redis (Sessions, caching)
- JITO (MEV protection)

**Security:**
- Node.js crypto (AES-256-GCM, PBKDF2)
- Environment-based configuration

---

## Prerequisites

Before you begin, ensure you have:

- **Node.js** v18+ installed
- **PostgreSQL** 12+ running locally or remote
- **Redis** instance for caching/sessions
- **Telegram Bot Token** from BotFather
- **Solana RPC Endpoint** (public or private)
- **API Keys**: BirdEye API, Jito API (optional for MEV)

---

## Quick Start

### 1. Clone & Install

```bash
git clone <repo>
cd TG-Solana-TradingBot-dev-ito
npm install
```

### 2. Database Setup

```bash
# Create PostgreSQL database
createdb growtrade_db

# Run Prisma migrations
npx prisma migrate dev
```

### 3. Environment Configuration

Copy `.env.example` to `.env` and update:

```bash
cp .env.example .env
```

**Critical Phase 0 Settings:**

```env
# ⚠️ CRITICAL - Database encryption key
WALLET_MASTER_KEY="<generate with: openssl rand -base64 32>"

# Telegram
TELEGRAM_BOT_API_TOKEN="your_bot_token"

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/growtrade_db"

# Solana RPC
MAINNET_RPC="https://api.mainnet-beta.solana.com"

# Fee Configuration
FEE_WALLET_ADDRESS="your_fee_collection_wallet"
FEE_PERCENT_BUY="0.01"

# Security Settings
REQUIRE_SAP_FOR_WITHDRAW="true"
SAP_TIMEOUT_MINUTES="5"
```

👉 **[See full .env.example for all options](./.env.example)**

### 4. Generate Master Key (Phase 0.2)

```bash
# Generate a random 32-byte base64 key for wallet encryption
node -e "const crypto = require('crypto'); console.log(crypto.randomBytes(32).toString('base64'))"
```

Copy the output to `.env` as `WALLET_MASTER_KEY`.

### 5. Start the Bot

```bash
# Development with watch
npm run dev

# Production
npm run build
npm start
```

---

## Key Commands

### User Commands
```
/start              - Initialize wallet
/buy                - Buy tokens
/sell               - Sell tokens
/positions          - View open positions
/pnl                - Check profit/loss
/withdraw           - Withdraw SOL (requires SAP)
/setuppin           - Enable PIN protection
/exportkey          - Export private key (requires SAP)
```

### Security Commands
```
/setuppin           - Create Security PIN
/changepin          - Update PIN
/disablesap         - Disable PIN protection
/securityinfo       - View security settings
```

### Admin Commands
```
/migrate_keys       - Encrypt plaintext keys (one-time)
```

---

## Wallet Security Model

### New Users (Phase 0.2+)
- Bot generates new wallet
- Private key encrypted with `WALLET_MASTER_KEY` (AES-256-GCM)
- Stored encrypted in PostgreSQL
- Never sent to user or logged

### Protected Operations (Phase 0.3)
With PIN Setup (`/setuppin`):
- Withdraw: Requires PIN
- Export Key: Requires PIN
- Delete Wallet: Requires PIN

### Migration for Existing Users
If upgrading from plaintext keys:

```bash
npx ts-node scripts/migrate-keys.ts
```

---

## Deployment Guide

### Production Checklist

- [ ] PostgreSQL with encrypted connections
- [ ] Redis with password authentication
- [ ] Generate and secure `WALLET_MASTER_KEY`
- [ ] Set `REQUIRE_SAP_FOR_WITHDRAW=true` in production
- [ ] Enable HTTPS for all connections
- [ ] Set up monitoring/alerting for failed PINs
- [ ] Regular database backups with encryption at rest

### Environment Variables

**Never commit `.env` file.** Always use secrets management:

- AWS Secrets Manager
- Azure Keyvault
- HashiCorp Vault
- Docker Secrets

See [SECURITY.md](/SECURITY.md) for production best practices.
