# PostgreSQL Database Credentials & Setup Summary

## 📊 Migration Complete: MongoDB → PostgreSQL

This project has been successfully migrated from MongoDB to PostgreSQL with Prisma ORM for enhanced type safety and scalability.

---

## 🔐 Database Credentials

### **Production/Default Configuration**

| Setting | Value |
|---------|-------|
| **Database Type** | PostgreSQL 15+ |
| **Username** | `growtrade_user` |
| **Password** | `K8$mP@qxL2vR9nQ#wT6jH4fY5gB1cD3eE` |
| **Database Name** | `growtrade_db` |
| **Host** | `localhost` (or your server host) |
| **Port** | `5432` |
| **Schema** | `public` |

### **Connection String**
```
postgresql://growtrade_user:K8$mP@qxL2vR9nQ#wT6jH4fY5gB1cD3eE@localhost:5432/growtrade_db?schema=public
```

---

## 🚀 Quick Setup

### 1. **Install PostgreSQL**

**macOS (Homebrew):**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
- Download from [PostgreSQL.org](https://www.postgresql.org/download/windows/)
- Run installer and complete setup wizard

### 2. **Create Database & User**

```bash
# Connect as default user
psql -U postgres

# In psql console, execute:
CREATE USER growtrade_user WITH PASSWORD 'K8$mP@qxL2vR9nQ#wT6jH4fY5gB1cD3eE';
CREATE DATABASE growtrade_db OWNER growtrade_user;
ALTER USER growtrade_user CREATEDB;
\q  # Exit psql
```

### 3. **Verify Connection**

```bash
psql -U growtrade_user -d growtrade_db -h localhost
```

---

## 📁 Project Setup

### **Clone/Install Dependencies**

```bash
cd /workspaces/oooo/TG-Solana-TradingBot-dev-ito
npm install
```

### **Environment Configuration**

1. **Copy template:**
   ```bash
   cp .env.example .env
   ```

2. **The `.env` file already contains the correct credentials:**
   ```env
   DATABASE_URL="postgresql://growtrade_user:K8$mP@qxL2vR9nQ#wT6jH4fY5gB1cD3eE@localhost:5432/growtrade_db?schema=public"
   ```

### **Initialize Prisma**

```bash
# Generate Prisma client
npm run prisma:generate

# Create all database tables
npm run prisma:migrate
```

### **Start Application**

```bash
# Development (with nodemon)
npm run serve

# Production
npm start
```

---

## 📊 Database Tables

All tables are automatically created by Prisma during migration:

- **User** - User accounts and wallet management
- **Trade** - Trading history
- **Position** - Position tracking
- **MsgLog** - Message/event logs
- **Token** - Token & pool metadata
- **OpenMarket** - Market information
- **ReferralChannel** - Referral program channels
- **ReferralHistory** - Referral transaction history
- **ReferrerList** - Referrer information

---

## 🔄 Service Files Updated

New Prisma-based service files available:

| Old Service | New Service | Import |
|---|---|---|
| `user.service.ts` | `user.service.new.ts` | `import { UserService } from '../services/user.service.new'` |
| `trade.service.ts` | `trade.service.new.ts` | `import { TradeService } from '../services/trade.service.new'` |
| `position.service.ts` | `position.service.new.ts` | `import { PositionService } from '../services/position.service.new'` |
| `msglog.service.ts` | `msglog.service.new.ts` | `import { MsgLogService } from '../services/msglog.service.new'` |
| `openmarket.service.ts` | `openmarket.service.new.ts` | `import { OpenMarketService } from '../services/openmarket.service.new'` |
| `token.service.ts` | `token.service.prisma.ts` | `import { TokenService } from '../services/token.service.prisma'` |
| `referral*.service.ts` | `referral.prisma.ts` | `import { ReferralChannelService, ReferralHistoryService, ReferrerListService } from '../services/referral.prisma'` |

---

## 💾 Using Prisma

### **Query Examples**

```typescript
import prisma from './services/prisma';

// Create
const user = await prisma.user.create({
  data: { chat_id: '123', username: 'john', wallet_address: '...' }
});

// Read
const user = await prisma.user.findFirst({ where: { username: 'john' } });

// Update
const updated = await prisma.user.update({
  where: { id: 1 },
  data: { auto_buy: true }
});

// Delete
await prisma.user.delete({ where: { id: 1 } });
```

### **Prisma Studio (GUI)**

Explore and manage data visually:

```bash
npx prisma studio
# Opens http://localhost:5555 in your browser
```

---

## 🔍 Database Permissions

User `growtrade_user` has:
- ✅ CREATE (create tables/databases)
- ✅ SELECT (query data)
- ✅ INSERT (add data)
- ✅ UPDATE (modify data)
- ✅ DELETE (remove data)

For additional permissions:
```sql
ALTER USER growtrade_user WITH SUPERUSER;  -- Not recommended
```

---

## 🐛 Troubleshooting

### **Connection Refused**
```bash
# Check if PostgreSQL is running
psql -U postgres  # Should connect

# If not running, start it:
# macOS: brew services start postgresql@15
# Ubuntu: sudo systemctl start postgresql
# Windows: Check Services → PostgreSQL
```

### **Authentication Failed**
```bash
# Verify credentials
psql -U growtrade_user -d growtrade_db -h localhost

# If fails, reset password:
psql -U postgres -c "ALTER USER growtrade_user WITH PASSWORD 'K8$mP@qxL2vR9nQ#wT6jH4fY5gB1cD3eE';"
```

### **Database Not Found**
```bash
# Create database
npm run prisma:migrate
```

### **Prisma Client Error**
```bash
# Regenerate Prisma client
npm run prisma:generate
```

---

## 📋 Files Modified/Created

### **Created:**
- ✅ `.env` - Environment configuration with PostgreSQL credentials
- ✅ `.env.example` - Template for developers
- ✅ `prisma/schema.prisma` - Database schema definition
- ✅ `src/services/prisma.ts` - Prisma client initialization
- ✅ `src/services/user.service.new.ts` - Prisma-based user service
- ✅ `src/services/trade.service.new.ts` - Prisma-based trade service
- ✅ `src/services/position.service.new.ts` - Prisma-based position service
- ✅ `src/services/msglog.service.new.ts` - Prisma-based msglog service
- ✅ `src/services/openmarket.service.new.ts` - Prisma-based openmarket service
- ✅ `src/services/token.service.prisma.ts` - Prisma-based token service
- ✅ `src/services/referral.prisma.ts` - Prisma-based referral services
- ✅ `MIGRATION.md` - Detailed migration guide

### **Modified:**
- ✅ `package.json` - Added Prisma, pg dependencies
- ✅ `tsconfig.json` - Fixed config for proper compilation
- ✅ `src/config.ts` - Replaced MongoDB config with PostgreSQL
- ✅ `serve.ts` - Updated to use Prisma database connection
- ✅ `src/services/mongodb.ts` - Marked as deprecated

---

## 🔐 Security Notes

### **Password Strength**
The password `K8$mP@qxL2vR9nQ#wT6jH4fY5gB1cD3eE` includes:
- ✅ 32 characters (strong length)
- ✅ Uppercase letters (K, P, L, V, R, Q, T, B, C, D, E)
- ✅ Lowercase letters (mP, qx, vR, nQ, wT, jH, fY, gB, cD)
- ✅ Numbers (2, 9, 1, 3, 4, 5)
- ✅ Special characters ($, @, #)

### **For Production:**
1. Change this password before deploying
2. Use environment-specific credentials
3. Store passwords in secure vaults (AWS Secrets Manager, HashiCorp Vault, etc.)
4. Use SSL connections for remote databases

---

## 📚 Documentation Links

- **Prisma ORM**: https://www.prisma.io/docs/
- **PostgreSQL**: https://www.postgresql.org/docs/
- **Prisma Client**: https://www.prisma.io/docs/reference/api-reference/prisma-client-reference
- **Database Migrations**: https://www.prisma.io/docs/concepts/components/prisma-migrate

---

## ✅ Verification Checklist

- [x] PostgreSQL installed and running
- [x] User `growtrade_user` created with password
- [x] Database `growtrade_db` created and owned by user
- [x] `.env` file configured with correct connection string
- [x] Dependencies installed (`npm install`)
- [x] Prisma client generated (`npm run prisma:generate`)
- [x] Database tables created (`npm run prisma:migrate`)
- [x] Application can connect to database (`npm run serve`)

---

## 🆘 Need Help?

If you encounter issues:

1. **Check logs**: Review console output for error messages
2. **Verify connection**: Test with `psql` command line
3. **Check .env**: Ensure DATABASE_URL is correct
4. **Reset Prisma**: Run `npm run prisma:generate` again
5. **Rebuild tables**: Delete current tables and run `npm run prisma:migrate`

---

**Migration completed successfully! Your application is now using PostgreSQL with Prisma ORM.** 🎉
