# Phase 1.0 Commercial Features - Implementation Guide

## Overview

Phase 1.0 Commercial Features introduces a complete monetization and user engagement system for the Solana Trading Bot. This includes:

- **Subscription Tiers**: Free, Premium, Elite, VIP with feature access controls
- **Referral Rewards**: 5-10% cashback on referred user trades
- **Cashback System**: 0.05-0.2% rewards on platform fee sharing
- **Withdrawal Management**: Request, approve, and pay out rewards on-chain
- **Payment Processing**: Billing, invoicing, and payment handling
- **Audit Logging**: Full compliance tracking for all commercial operations
- **Analytics Dashboard**: User performance tracking and tier-based insights

## Services Architecture

### Core Services

#### 1. **RewardsService** (`src/services/rewards.service.ts`)
Manages all reward types with expiration handling and balance tracking.

**Key Methods:**
- `recordReward()` - Add reward to ledger and update balance
- `getUserRewardBalances()` - Get referral + cashback totals
- `getRewardHistory()` - Paginated reward history with filtering
- `cleanupExpiredRewards()` - Periodic reward expiration
- `getRewardAnalytics()` - Monthly breakdown of earnings

**Expiration Policy:**
- Referral: 1 year
- Cashback: 2 years
- Staking: 3 years

---

#### 2. **CashbackService** (`src/services/cashback.service.ts`)
Calculates and records cashback rewards on trades and promotional activities.

**Key Methods:**
- `recordCashbackOnTrade()` - Award user 20% of platform fee as cashback
- `recordBonusCashback()` - Admin-triggered campaign rewards
- `recordStakingCashback()` - Periodic loyalty bonuses
- `getCashbackBalance()` - Current available cashback
- `getCashbackHistory()` - Paginated transaction history

**Cashback Rates by Tier:**
- Free: 0.05%
- Premium: 0.1%
- Elite: 0.15%
- VIP: 0.2%

---

#### 3. **CommercialSettingsService** (`src/services/commercial.settings.service.ts`)
Manages subscription tiers, feature access, and user tier management.

**Subscription Tiers:**

| Tier     | Price    | Trade Limit | Positions | API | Priority Support |
|----------|----------|-------------|-----------|-----|------------------|
| Free     | $0       | 100/mo      | 5         | ❌   | ❌               |
| Premium  | $9.99    | 500/mo      | 20        | ❌   | ❌               |
| Elite    | $29.99   | 2000/mo     | 50        | ✅   | ✅               |
| VIP      | $99.99   | Unlimited   | Unlimited | ✅   | ✅ (24/7)        |

**Key Methods:**
- `getTierDetails()` - Get tier configuration
- `getUserTier()` - Get user's current tier
- `hasFeatureAccess()` - Check feature eligibility
- `checkTradeLimit()` - Validate monthly trade limit
- `upgradeSubscription()` - Tier upgrade with billing setup
- `cancelSubscription()` - Downgrade to free with reason logging
- `getReferralRewardsRate()` - Get tier-specific referral rate

---

#### 4. **WithdrawalService** (`src/services/withdrawal.service.ts`)
Manages withdrawal requests, pending approvals, and on-chain payment execution.

**Withdrawal Workflow:**
1. User requests withdrawal (idempotent - won't create duplicates)
2. Admin reviews and approves in batch
3. System sends on-chain transfer to Solana wallet
4. Withdrawal marked as paid with transaction signature
5. Ledger entries updated and removed from available balance

**Key Methods:**
- `createWithdrawalRequest()` - Initiate withdrawal (idempotent)
- `markWithdrawalPaid()` - Confirm on-chain payment
- `markWithdrawalFailed()` - Revert and restore balance
- `getWithdrawalHistory()` - User's withdrawal records
- `getPendingWithdrawals()` - Admin batch processing
- `isValidSolanaAddress()` - Validate destination wallet

**Features:**
- Idempotent request creation (prevents duplicates)
- Transaction management with rollback on failure
- Batch withdrawal processing for efficiency
- Comprehensive error handling

---

#### 5. **PaymentProcessingService** (`src/services/payment.processing.service.ts`)
Handles monthly billing, invoicing, payment retries, and Stripe integration.

**Billing Cycle:**
- Monthly recurring charge on subscription date
- 3-day retry on failed payment
- Auto-downgrade to free after failed retries
- Invoice generation with PDF support

**Key Methods:**
- `processMonthlyBilling()` - Monthly batch billing (cron job)
- `processPayment()` - Single payment processing
- `handlePaymentFailure()` - Retry logic and escalation
- `generateInvoice()` - Create invoice record
- `getPaymentHistory()` - User's payment records
- `processRefund()` - Handle refunds with audit logging
- `handleStripewebhook()` - Webhook event processing

**Stripe Integration:**
```typescript
// Webhook events handled:
- payment_intent.succeeded
- customer.subscription.updated
- invoice.payment_failed
```

---

#### 6. **AuditLoggingService** (`src/services/audit.logging.service.ts`)
Comprehensive audit trail for compliance and fraud detection.

**Logged Events:**
- Subscription changes (upgrade/downgrade/cancel)
- Payment transactions and refunds
- Withdrawal requests and payments
- Reward earnings
- Referral activity
- Security events (login failures, suspicious activity)

**Key Methods:**
- `logSubscriptionAction()` - Track tier changes
- `logPaymentAction()` - Payment status changes
- `logWithdrawalAction()` - Withdrawal lifecycle
- `logRewardAction()` - Reward events
- `logReferralAction()` - Referral tracking
- `logSecurityEvent()` - Failed attempts and suspicious behavior
- `getUserAuditLogs()` - User-specific audit history
- `getAllAuditLogs()` - Admin compliance view
- `generateAuditReport()` - Monthly compliance report
- `checkSuspiciousActivity()` - Fraud detection

**Suspicious Activity Alerts:**
- 5+ failed logins in 24 hours
- Multiple withdrawal requests in one day
- Multiple subscription changes in 24 hours
- Large refund requests

---

#### 7. **AnalyticsService** (`src/services/analytics.service.ts`)
User performance metrics, portfolio snapshots, and tier-based insights.

**Key Methods:**
- `getUserAnalytics()` - 30-day trading metrics
  - Win rate, total P&L, ROI, average trade size
  - Rewards earned (referral, cashback)
  - Activity patterns (most active trading hour)
  
- `getPortfolioSnapshot()` - Current holdings
  - Total assets, open positions, P&L
  
- `getPortfolioHistory()` - Historical tracking
  
- `getTopTokens()` - Best/worst performers
  
- `getTradeDistribution()` - Trading patterns
  - By hour of day, day of week
  
- `getRewardsSummary()` - Reward totals and next withdrawal date
  
- `getUserComparison()` - Benchmarking against platform average
  - Win rate percentile ranking

---

## Database Schema Extensions (Prisma)

### New Tables Required:

```prisma
model Subscription {
  id                    Int       @id @default(autoincrement())
  user_id              Int       @unique
  current_tier         String    // 'free' | 'premium' | 'elite' | 'vip'
  subscribed_at        DateTime
  next_billing_date    DateTime?
  last_billing_date    DateTime?
  auto_renew           Boolean   @default(true)
  payment_method       String    // 'card' | 'crypto'
  payment_retry_count  Int       @default(0)
  cancelled_at         DateTime?
  cancellation_reason  String?
  
  user User @relation(fields: [user_id], references: [id])
  @@index([auto_renew])
  @@index([next_billing_date])
}

model Withdrawal {
  id                  Int       @id @default(autoincrement())
  user_id            Int
  withdrawal_type    String    // 'referral' | 'cashback'
  amount_usd         Float
  destination_wallet String    // Solana address
  status             String    // 'pending' | 'approved' | 'paid' | 'failed'
  payment_method     String    // 'onchain'
  transaction_signature String?
  requested_at       DateTime  @default(now())
  approved_at        DateTime?
  paid_at            DateTime?
  error_reason       String?
  
  user User @relation(fields: [user_id], references: [id])
  @@index([status])
  @@index([user_id])
}

model RewardsLedger {
  id              Int       @id @default(autoincrement())
  user_id        Int
  reward_type    String    // 'referral' | 'cashback' | 'staking'
  amount_usd     Float
  status         String    // 'available' | 'withdrawn' | 'expired'
  description    String
  metadata       Json?
  recorded_at    DateTime  @default(now())
  expires_at     DateTime?
  withdrawn_by_id Int?
  withdrawn_at   DateTime?
  
  user User @relation(fields: [user_id], references: [id])
  @@index([user_id])
  @@index([status])
  @@index([expires_at])
}

model Payment {
  id              Int       @id @default(autoincrement())
  user_id        Int
  amount         Float
  currency       String    // 'usd'
  tier           String
  status         String    // 'pending' | 'completed' | 'failed' | 'refunded'
  invoice_id     String?
  transaction_id String?
  processed_at   DateTime?
  refunded_at    DateTime?
  refund_reason  String?
  
  user User @relation(fields: [user_id], references: [id])
  @@index([status])
  @@index([user_id])
}

model Invoice {
  id                    Int       @id @default(autoincrement())
  user_id              Int
  invoice_id           String    @unique
  amount               Float
  currency             String
  tier                 String
  billing_period_start DateTime
  billing_period_end   DateTime
  status               String    // 'draft' | 'sent' | 'paid' | 'overdue'
  issued_at            DateTime
  due_date             DateTime
  paid_at              DateTime?
  
  user User @relation(fields: [user_id], references: [id])
  @@index([user_id])
  @@index([status])
}

model AuditLog {
  id               Int       @id @default(autoincrement())
  user_id         Int?
  action          String    // 'subscription_upgrade', 'payment_success', etc
  category        String    // 'subscription', 'payment', 'withdrawal', 'rewards', 'security'
  details         Json
  ip_address      String?
  user_agent      String?
  severity        String    // 'low' | 'medium' | 'high' | 'critical'
  timestamp       DateTime  @default(now())
  
  @@index([user_id])
  @@index([action])
  @@index([category])
  @@index([timestamp])
}
```

### User Model Extensions:

```prisma
model User {
  // ... existing fields ...
  
  // Tier and subscription
  tier                    String           @default("free")
  referral_balance_usd   Float           @default(0)
  cashback_balance_usd   Float           @default(0)
  
  // Relations
  subscription            Subscription?
  withdrawals            Withdrawal[]
  rewards                RewardsLedger[]
  payments               Payment[]
  invoices               Invoice[]
  auditLogs              AuditLog[]
}
```

---

## Integration Examples

### 1. Recording Trade Cashback

```typescript
// In trade completion handler
import CashbackService from '@services/cashback.service';

const tradeResult = await executeTradeOnchain(...);
if (tradeResult.success) {
  await CashbackService.recordCashbackOnTrade(
    userId,
    tradeAmount,    // $1000
    platformFee,    // $5
    orderId,
    'Trade execution on Pump.Fun'
  );
}
```

### 2. Processing Subscription Upgrade

```typescript
import CommercialSettingsService from '@services/commercial.settings.service';

const result = await CommercialSettingsService.upgradeSubscription(
  userId,
  'premium',
  'card'
);

if (result.success) {
  // User now has access to premium features
  // First billing charge will be scheduled
}
```

### 3. Handling Withdrawal Request

```typescript
import WithdrawalService from '@services/withdrawal.service';

const withdrawal = await WithdrawalService.createWithdrawalRequest(
  userId,
  'referral',           // type
  100,                  // amount USD
  '9B5X4z...'           // solana address
);

if (withdrawal.success) {
  // Admin will see this in pending list
  // await WithdrawalService.getPendingWithdrawals()
}
```

### 4. Checking Feature Access

```typescript
import CommercialSettingsService from '@services/commercial.settings.service';

const hasAPI = await CommercialSettingsService.hasFeatureAccess(
  userId,
  'api-access'
);

if (!hasAPI) {
  return error('API access requires Elite tier or higher');
}
```

### 5. Getting User Analytics

```typescript
import AnalyticsService from '@services/analytics.service';

const analytics = await AnalyticsService.getUserAnalytics(userId, 30);
// Returns: win rate, ROI, rewards earned, activity patterns
```

---

## Cron Jobs Required

### Daily Jobs

```typescript
// 1. Check for suspicious activity
import AuditLoggingService from '@services/audit.logging.service';
const suspicious = await AuditLoggingService.checkSuspiciousActivity(userId);
if (suspicious.suspicious) {
  // Alert support team
}

// 2. Archive old logs
await AuditLoggingService.archiveOldLogs(365);
```

### Monthly Jobs

```typescript
// 1. Process billing
import PaymentProcessingService from '@services/payment.processing.service';
await PaymentProcessingService.processMonthlyBilling();

// 2. Distribute staking rewards
import CashbackService from '@services/cashback.service';
await CashbackService.processPeriodicalCashbackDistribution('monthly');

// 3. Clean up expired rewards
import RewardsService from '@services/rewards.service';
await RewardsService.cleanupExpiredRewards();
```

---

## API Endpoints (Suggested)

### User Management
- `GET /api/user/tier` - Get user's current tier and features
- `POST /api/user/upgrade-tier` - Upgrade subscription
- `POST /api/user/downgrade-tier` - Downgrade subscription
- `POST /api/user/cancel-subscription` - Cancel subscription

### Rewards
- `GET /api/rewards/balance` - Get reward balances
- `GET /api/rewards/history` - Get reward history
- `POST /api/rewards/withdraw` - Request withdrawal

### Withdrawals
- `GET /api/withdrawals/status/:id` - Get withdrawal status
- `GET /api/withdrawals/history` - User's withdrawal history
- `POST /api/withdrawals/create` - Create withdrawal request

### Billing
- `GET /api/billing/invoices` - Get invoices
- `GET /api/billing/invoice/:id/pdf` - Download invoice
- `GET /api/billing/subscription` - Get subscription details

### Analytics
- `GET /api/analytics/trading` - Trading metrics
- `GET /api/analytics/portfolio` - Portfolio snapshot
- `GET /api/analytics/rewards-summary` - Rewards breakdown

### Admin
- `GET /api/admin/withdrawals/pending` - Pending withdrawal queue
- `POST /api/admin/withdrawals/:id/pay` - Execute withdrawal
- `GET /api/admin/audit-logs` - Compliance reports
- `GET /api/admin/suspicious-users` - Fraud detection alerts

---

## Security Considerations

1. **Wallet Validation**: All withdrawal addresses are validated before processing
2. **Transaction Limits**: Monthly trade limits enforced per tier
3. **Audit Trail**: All commercial operations fully logged
4. **Idempotent Operations**: Withdrawal requests won't create duplicates
5. **Error Recovery**: Failed payments auto-retry with status tracking
6. **Fraud Detection**: Suspicious activity monitoring with alerts

---

## Phase 2 Considerations

- Stripe/Crypto payment gateway full integration
- On-chain withdrawal automation
- Referral link tracking and analytics
- Custom tier creation for enterprise
- Subscription pause/resume functionality
- Family plan/organization accounts

---

## Testing Checklist

- [ ] Subscription tier upgrade/downgrade
- [ ] Monthly billing cycle
- [ ] Payment failure and retry
- [ ] Cashback calculation on trades
- [ ] Referral reward assignment
- [ ] Withdrawal request and approval flow
- [ ] Feature access control per tier
- [ ] Trade limit enforcement
- [ ] Reward expiration cleanup
- [ ] Audit log completeness
- [ ] Suspicious activity detection
- [ ] Concurrent withdrawal handling

---

**Status**: ✅ Phase 1.0 Complete
**Version**: 1.0.0
**Last Updated**: 2024
