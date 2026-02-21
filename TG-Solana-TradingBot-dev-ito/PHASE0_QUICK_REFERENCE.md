# Phase 0 Quick Reference Guide

## 🔐 Security Services Overview

### 1. EncryptionService (Base Layer)
**File:** `/src/services/encryption.service.ts`

```typescript
import { EncryptionService } from './services/encryption.service';

// Encrypt wallet private key
const encrypted = EncryptionService.encrypt(plaintextKey, WALLET_MASTER_KEY);

// Decrypt for signing
const plaintext = EncryptionService.decrypt(encrypted, WALLET_MASTER_KEY);

// Hash & verify PIN
const { hash, salt } = EncryptionService.hashPIN("1234");
const isValid = EncryptionService.verifyPIN("1234", hash, salt);
```

**Methods:**
- `encrypt(plaintext: string, keyBase64: string): string` → AES-256-GCM
- `decrypt(encryptedBase64: string, keyBase64: string): string` → Reverse
- `hashPIN(pin: string): { hash, salt }` → PBKDF2-SHA256
- `verifyPIN(pin: string, hash: string, salt: string): boolean` → Timing-safe

---

### 2. SAPService (Session Management)
**File:** `/src/services/sap.service.ts`

```typescript
import { SAPService } from './services/sap.service';

// Setup PIN for user
const sap = SAPService.setupSAP("1234"); // Returns { hash, salt }

// Verify PIN and create session
const result = await SAPService.verifyAndCreateSession(
  userId, 
  "1234", 
  user.pin_hash, 
  user.pin_salt
);
if (result.success) {
  // Proceed with sensitive operation
}

// Check if user has valid session
const isVerified = await SAPService.isVerified(userId);

// Get remaining time (in seconds)
const remaining = await SAPService.getSessionTimeRemaining(userId);
```

**Key Features:**
- Sessions expire after `SAP_TIMEOUT_MINUTES` (default: 5)
- Check operation security requirements
- Generate Telegram prompt messages

---

### 3. UserEncryptionService (High-Level)
**File:** `/src/services/user.encryption.service.ts`

```typescript
import { UserEncryptionService } from './services/user.encryption.service';

// Store encrypted key for new user
const encrypted = UserEncryptionService.encryptAndStore(plaintextKey);
await prisma.user.update({ 
  where: { id: userId }, 
  data: { encrypted_private_key: encrypted } 
});

// Get keypair for signing (auto-decrypts)
const keypair = await UserEncryptionService.getKeypairForSigning(userId);
const signature = keypair.sign(transaction);
// keypair cleared from memory after operation

// Migrate plaintext key to encrypted
const success = await UserEncryptionService.migrateUserKey(userId);

// Batch migrate all users
const result = await UserEncryptionService.migrateAllUsers();
console.log(`Migrated ${result.migrated}/${result.total} users`);

// Setup SAP for user
const setupOk = await UserEncryptionService.setupSAP(userId, "1234");

// Verify SAP
const verified = await UserEncryptionService.verifyAndRegisterSAP(userId, "1234");
if (verified.success) {
  // SAP session created - operation allowed
}
```

---

### 4. SAPHandler (Telegram UI)
**File:** `/src/screens/sap.screen.ts`

```typescript
import SAPHandler from './screens/sap.screen';

const sapHandler = new SAPHandler(bot);

// User initiates SAP setup
await sapHandler.startSAPSetup(chatId, userId);
// Bot sends: "Choose a 4-6 digit PIN..."

// User enters PIN
await sapHandler.handlePINInput(chatId, userId, "1234");

// Request SAP for protected operation
const needsSAP = await sapHandler.requestSAPForOperation(
  chatId, 
  userId, 
  "withdraw" // or "export", "delete_wallet"
);
if (!needsSAP) {
  // Waiting for user to enter PIN
  return;
}

// Get session info
const info = await sapHandler.getSAPSessionInfo(userId);
if (info) {
  console.log(`SAP valid for ${info.remaining} more seconds`);
}
```

---

## 📋 Configuration

### Environment Variables
File: `/.env`

```env
# CRITICAL (Generate with: openssl rand -base64 32)
WALLET_MASTER_KEY=""

# Fee collection
FEE_WALLET_ADDRESS=""
FEE_PERCENT_BUY="0.01"
FEE_PERCENT_SELL="0.0075"
FEE_PERCENT_BURN="0.001"

# SAP Settings
REQUIRE_SAP_FOR_WITHDRAW="true"
REQUIRE_SAP_FOR_KEY_EXPORT="true"
REQUIRE_SAP_FOR_WALLET_DELETE="true"
SAP_TIMEOUT_MINUTES="5"

# Gas presets
GAS_FEE_DEFAULT="0.005"
GAS_FEE_NORMAL="0.001"
GAS_FEE_TURBO="0.025"
GAS_FEE_ULTRA="0.05"
```

### Database Fields
File: `/prisma/schema.prisma`

```prisma
model User {
  // Encryption fields (Phase 0.2)
  private_key           String @unique  // DEPRECATED: plaintext (for migration)
  encrypted_private_key String?         // AES-256-GCM encrypted
  
  // PIN fields (Phase 0.3)
  pin_hash     String?     // PBKDF2 hashed PIN
  pin_salt     String?     // Random salt
  pin_attempts Int = 0     // Brute force counter
  pin_locked_until DateTime? // Lockout timestamp
}
```

---

## 🔄 Common Workflows

### Create New User with Encrypted Key
```typescript
import { UserEncryptionService } from './services/user.encryption.service';

const plaintextKey = Keypair.generate().secretKey;
const encrypted = UserEncryptionService.encryptAndStore(
  JSON.stringify(Array.from(plaintextKey))
);

await prisma.user.create({
  data: {
    chat_id: "123456",
    username: "user123",
    encrypted_private_key: encrypted, // Encrypted!
    wallet_address: keypair.publicKey.toString(),
    // ... other fields
  }
});
```

### Sign Transaction (Decrypt → Sign → Clear)
```typescript
const keypair = await UserEncryptionService.getKeypairForSigning(userId);
const signature = keypair.sign(transaction);
// keypair automatically cleared from memory
```

### Protect Withdraw Operation with SAP
```typescript
const chatId = msg.chat.id;
const userId = user.id;

// Step 1: Request SAP
const needsSAP = await sapHandler.requestSAPForOperation(
  chatId, 
  userId, 
  "withdraw"
);
if (!needsSAP) {
  // User needs to enter PIN first
  return;
}

// Step 2: Check SAP was verified
const isVerified = await SAPService.isVerified(userId);
if (!isVerified) {
  await bot.sendMessage(chatId, "❌ SAP not verified");
  return;
}

// Step 3: Proceed with withdraw
const signature = await signWithdrawTx(userId);
// ... send transaction
```

---

## 🧪 Testing

### Test Encryption Roundtrip
```bash
node -e "
const { EncryptionService } = require('./dist/services/encryption.service');
const key = 'OvH3...abcd'; // 32-byte base64
const plaintext = 'secret_data';
const encrypted = EncryptionService.encrypt(plaintext, key);
const decrypted = EncryptionService.decrypt(encrypted, key);
console.log('✅ Match:', plaintext === decrypted);
"
```

### Test PIN Hashing
```bash
node -e "
const { EncryptionService } = require('./dist/services/encryption.service');
const { hash, salt } = EncryptionService.hashPIN('1234');
const valid = EncryptionService.verifyPIN('1234', hash, salt);
const invalid = EncryptionService.verifyPIN('5678', hash, salt);
console.log('✅ Valid PIN:', valid, '| Invalid PIN:', invalid);
"
```

### Migrate Keys
```bash
npx ts-node scripts/migrate-keys.ts
# Output:
# 🔒 Starting Key Migration (Phase 0.2)...
# ✅ User 1: plaintext → encrypted
# ✅ User 2: plaintext → encrypted
# ...
# 📊 Migration Summary:
#    Total Users: 42
#    ✅ Migrated: 42
#    ❌ Failed: 0
```

---

## 🚨 Common Issues

### Issue: "WALLET_MASTER_KEY is not configured"
**Solution:** Set `WALLET_MASTER_KEY` in .env
```env
WALLET_MASTER_KEY="OvH3kL9pM2bQ4rX5vY6wZ7aB8cD9eF0g"
```

### Issue: "Type 'User' does not have property 'encrypted_private_key'"
**Solution:** Regenerate Prisma client
```bash
npx prisma generate
```

### Issue: "Failed to decrypt private key"
**Cause:** WALLET_MASTER_KEY doesn't match the key used to encrypt
**Solution:** Use the correct WALLET_MASTER_KEY from your vault

### Issue: "User locked out of SAP after 3 failures"
**Behavior:** Automatic (by design)
**Resolution:** Wait 5 minutes or admin override via /resetpin

---

## 📚 Related Documentation

- [SECURITY.md](/SECURITY.md) - Full security architecture
- [PHASE0_COMPLETION.md](/PHASE0_COMPLETION.md) - Phase 0 completion report
- [README.md](/README.md) - Deployment guide
- [.env.example](/.env.example) - Configuration template

---

## ✅ Checklist

Before going to production:

- [ ] Generate WALLET_MASTER_KEY: `openssl rand -base64 32`
- [ ] Set WALLET_MASTER_KEY in .env and vault
- [ ] Set FEE_WALLET_ADDRESS to your fee collection wallet
- [ ] Run database migrations: `npx prisma migrate dev`
- [ ] Migrate existing keys: `npx ts-node scripts/migrate-keys.ts`
- [ ] Test SAP: `/setuppin` → verify database updates
- [ ] Verify compilation: `npm run build` ✅
- [ ] Test withdraw: Verify PIN required
- [ ] Go live! 🚀

---

**Version:** Phase 0.3 Complete  
**Last Updated:** 2024  
**Status:** Production Ready ✅
