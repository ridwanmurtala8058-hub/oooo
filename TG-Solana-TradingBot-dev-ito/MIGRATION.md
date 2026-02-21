# MongoDB to PostgreSQL Migration Guide

## Overview
This project has been migrated from MongoDB to PostgreSQL with Prisma ORM for better type safety, scalability, and performance.

## Key Changes

### 1. **Database**
- **Before**: MongoDB (NoSQL)
- **After**: PostgreSQL (SQL)
- **ORM**: Prisma Client

### 2. **Credentials**
- **Username**: `growtrade_user`
- **Password**: `K8$mP@qxL2vR9nQ#wT6jH4fY5gB1cD3eE` (strong, secure password)
- **Database**: `growtrade_db`
- **Host**: `localhost` (or your database host)
- **Port**: `5432` (default PostgreSQL port)

### 3. **Connection String**
```
postgresql://growtrade_user:K8$mP@qxL2vR9nQ#wT6jH4fY5gB1cD3eE@localhost:5432/growtrade_db?schema=public
```

## Setup Instructions

### Step 1: Install PostgreSQL

**On macOS:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**On Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo service postgresql start
```

**On Windows:**
- Download from https://www.postgresql.org/download/windows/
- Run installer and follow prompts

### Step 2: Create Database and User

```bash
# Connect to PostgreSQL as default user
psql -U postgres

# In psql prompt, run:
CREATE USER growtrade_user WITH PASSWORD 'K8$mP@qxL2vR9nQ#wT6jH4fY5gB1cD3eE';
CREATE DATABASE growtrade_db OWNER growtrade_user;
ALTER USER growtrade_user CREATEDB;

# Exit psql
\q
```

### Step 3: Set Up Environment

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Update `.env` with your database credentials (already pre-configured)

### Step 4: Install Dependencies

```bash
npm install
```

### Step 5: Set Up Prisma

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations (creates all tables)
npm run prisma:migrate
```

### Step 6: Run Application

```bash
npm run serve    # Development mode with nodemon
# or
npm start        # Production mode
```

## Service Files Migration

The following service files have been updated to use Prisma:

| Original File | New File | Status |
|---|---|---|
| `user.service.ts` | `user.service.new.ts` | ✅ Ready |
| `trade.service.ts` | `trade.service.new.ts` | ✅ Ready |
| `position.service.ts` | `position.service.new.ts` | ✅ Ready |
| `msglog.service.ts` | `msglog.service.new.ts` | ✅ Ready |
| `openmarket.service.ts` | `openmarket.service.new.ts` | ✅ Ready |
| `token.service.ts` | `token.service.prisma.ts` | ✅ Ready |
| `referral*.service.ts` | `referral.prisma.ts` | ✅ Ready |

## Updating Service Imports

Replace imports in your controllers and other services:

**Before (MongoDB):**
```typescript
import { UserSchema } from "../models/index";
```

**After (Prisma):**
```typescript
import { UserService } from "../services/user.service.new";
```

## Database Models

All models are defined in `prisma/schema.prisma`:
- **User** - User accounts and wallets
- **Trade** - Trade history
- **Position** - Position tracking
- **MsgLog** - Message logs
- **Token** - Token/pool data
- **OpenMarket** - Market data
- **ReferralChannel** - Referral channels
- **ReferralHistory** - Referral history
- **ReferrerList** - Referrer lists

## Common Issues

### Issue: Connection refused
**Solution**: Ensure PostgreSQL is running
```bash
# macOS
brew services list

# Ubuntu
sudo service postgresql status

# Windows (in Services)
Check PostgreSQL service is running
```

### Issue: Password authentication failed
**Solution**: Verify credentials in `.env` match created user
```bash
psql -U growtrade_user -d growtrade_db
```

### Issue: Database does not exist
**Solution**: Run migrations
```bash
npm run prisma:migrate
```

## Performance Notes

PostgreSQL is more efficient for:
- Complex queries with joins
- Large datasets
- Concurrent transactions
- Type safety with Prisma

## Data Migration from MongoDB (if needed)

If you have existing MongoDB data:
1. Export MongoDB data to JSON
2. Write migration script to import into PostgreSQL tables
3. Use Prisma to insert data

Example:
```typescript
import prisma from "./services/prisma";

async function migrateData(jsonData: any[]) {
  for (const item of jsonData) {
    await prisma.user.create({ data: item });
  }
}
```

## Next Steps

1. Replace all old service file imports with new Prisma-based ones
2. Update controllers that use the services
3. Test all database operations thoroughly
4. Remove old MongoDB model files (keep backup)
5. Delete `src/services/mongodb.ts`

## Support

For issues with:
- **Prisma**: https://www.prisma.io/docs/
- **PostgreSQL**: https://www.postgresql.org/docs/
- **Prisma Studio** (GUI): `npx prisma studio`
