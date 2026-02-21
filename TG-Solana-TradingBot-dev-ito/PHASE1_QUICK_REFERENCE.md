# Phase 1.0 Commercial Features - Quick Reference

## 📚 Service Files Location
All services are in `src/services/` directory:

```
src/services/
├── rewards.service.ts              # Core reward management
├── cashback.service.ts             # Cashback rewards on trades
├── commercial.settings.service.ts  # Subscription tiers & features
├── withdrawal.service.ts           # Withdrawal requests & payouts
├── payment.processing.service.ts   # Billing & invoicing
├── audit.logging.service.ts        # Audit trail & compliance
├── analytics.service.ts            # User metrics & insights
└── commercial/index.ts             # Central export module
```

## 🚀 Quick Import

```typescript
import {
  RewardsService,
  CashbackService,
  CommercialSettingsService,
  WithdrawalService,
  PaymentProcessingService,
  AuditLoggingService,
  AnalyticsService,
} from '@services/commercial';
```

## 🎯 Most Common Operations

### 1. Check User Tier
```typescript
const tier = await CommercialSettingsService.getUserTier(userId);
// Returns: 'free' | 'premium' | 'elite' | 'vip'
```

### 2. Check Feature Access
```typescript
const hasAPI = await CommercialSettingsService.hasFeatureAccess(userId, 'api-access');
if (!hasAPI) return error('Elite tier required');
```

### 3. Record Trade Cashback
```typescript
await CashbackService.recordCashbackOnTrade(
  userId, tradeAmount, platformFee, orderId, description
);
```

### 4. Get Reward Balance
```typescript
const balances = await RewardsService.getUserRewardBalances(userId);
// Returns: { referral: 100, cashback: 50, total: 150 }
```

### 5. Create Withdrawal
```typescript
const withdrawal = await WithdrawalService.createWithdrawalRequest(
  userId, 'referral', amount, solanaAddress
);
```

### 6. Get User Analytics
```typescript
const analytics = await AnalyticsService.getUserAnalytics(userId, 30);
// Returns: P&L, win rate, rewards, activity patterns
```

## 📊 Tier Comparison

| Feature | Free | Premium | Elite | VIP |
|---------|------|---------|-------|-----|
| Price | Free | $9.99/mo | $29.99/mo | $99.99/mo |
| Trades/mo | 100 | 500 | 2,000 | Unlimited |
| Open positions | 5 | 20 | 50 | Unlimited |
| API access | ❌ | ❌ | ✅ | ✅ |
| Priority support | ❌ | ❌ | ✅ | ✅ |
| Referral rewards | 0% | 5% | 7% | 10% |
| Cashback rate | 0.05% | 0.1% | 0.15% | 0.2% |

## 🔄 Common Workflows

### User Upgrade Flow
```
User selects Premium tier
  ↓
CommercialSettingsService.upgradeSubscription(userId, 'premium')
  ↓
Subscription record created
  ↓
Next billing date scheduled
  ↓
AuditLoggingService logs action
  ↓
Email sent to user
```

### Trade Rewards Flow
```
Trade executed with $10 fee
  ↓
CashbackService.recordCashbackOnTrade() called
  ↓
20% of fee = $2 cashback calculated
  ↓
RewardsService.recordReward() called
  ↓
User balance updated (cashback_balance_usd += $2)
  ↓
AuditLoggingService logs reward earned
```

### Withdrawal Flow
```
User requests $100 referral withdrawal
  ↓
WithdrawalService.createWithdrawalRequest()
  ↓
Idempotent check: no pending withdrawal
  ↓
Withdrawal record created (status: pending)
  ↓
Ledger entries marked as withdrawn
  ↓
Balance decremented (referral_balance_usd -= $100)
  ↓
AuditLoggingService logs withdrawal request
```

## 🛠️ Admin Operations

### Get Pending Withdrawals
```typescript
const pending = await WithdrawalService.getPendingWithdrawals(100);
pending.forEach(w => {
  console.log(`${w.amount} → ${w.type} payment needed`);
});
```

### Process Monthly Billing
```typescript
const result = await PaymentProcessingService.processMonthlyBilling();
console.log(`Processed: ${result.processed}, Failed: ${result.failed}`);
```

### Get Audit Logs
```typescript
const logs = await AuditLoggingService.getAllAuditLogs(
  100,                    // limit
  0,                      // offset
  'payment',              // category filter (optional)
  'high'                  // severity filter (optional)
);
```

### Check Suspicious Activity
```typescript
const check = await AuditLoggingService.checkSuspiciousActivity(userId);
if (check.suspicious) {
  console.log('Alerts:', check.alerts);
  // Alert support team
}
```

## 💾 Database Tables

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `Subscription` | User tier & billing | `current_tier`, `next_billing_date`, `auto_renew` |
| `Withdrawal` | Withdrawal requests | `status`, `amount`, `destination_wallet` |
| `RewardsLedger` | Individual rewards | `reward_type`, `status`, `expires_at` |
| `Payment` | Payment records | `status`, `tier`, `transaction_id` |
| `Invoice` | Generated invoices | `invoice_id`, `billing_period_start/end` |
| `AuditLog` | Audit trail | `action`, `category`, `severity` |

## ⏰ Cron Jobs Required

### Daily
- Fraud detection: `AuditLoggingService.checkSuspiciousActivity()`
- Log archival: `AuditLoggingService.archiveOldLogs(365)`

### Monthly (1st of month)
- Billing: `PaymentProcessingService.processMonthlyBilling()`
- Staking rewards: `CashbackService.processPeriodicalCashbackDistribution('monthly')`
- Reward cleanup: `RewardsService.cleanupExpiredRewards()`

## 🔒 Security Features

✅ **Idempotent withdrawal requests** - Won't create duplicates  
✅ **Transaction-safe operations** - Database rollback on failure  
✅ **Wallet validation** - Solana address format checking  
✅ **Fraud detection** - Suspicious activity alerts  
✅ **Audit trail** - Complete operation logging  
✅ **Balance protection** - All updates validated  

## 📝 Type Definitions

```typescript
// Subscription
type SubscriptionTier = 'free' | 'premium' | 'elite' | 'vip';

// Rewards
type RewardType = 'referral' | 'cashback' | 'staking';
type RewardStatus = 'available' | 'withdrawn' | 'expired';

// Withdrawals
type WithdrawalType = 'referral' | 'cashback';
type WithdrawalStatus = 'pending' | 'approved' | 'paid' | 'failed';

// Payments
type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

// Audit
type AuditCategory = 'subscription' | 'payment' | 'withdrawal' | 'rewards' | 'security';
type Severity = 'low' | 'medium' | 'high' | 'critical';
```

## 🧪 Example: Complete User Profile

```typescript
import { 
  CommercialSettingsService,
  RewardsService,
  AnalyticsService,
  WithdrawalService,
} from '@services/commercial';

async function getUserProfile(userId: number) {
  const tier = await CommercialSettingsService.getUserTier(userId);
  const balances = await RewardsService.getUserRewardBalances(userId);
  const analytics = await AnalyticsService.getUserAnalytics(userId, 30);
  const rewards = await AnalyticsService.getRewardsSummary(userId);
  const history = await WithdrawalService.getWithdrawalHistory(userId, 10);

  return {
    userId,
    tier,
    balances,
    recentAnalytics: analytics,
    rewardsInfo: rewards,
    withdrawalHistory: history.withdrawals,
  };
}
```

## 🔗 API Integration Points

**Suggested endpoints to implement:**
- `GET /api/user/tier` → `getUserTier()`
- `GET /api/user/features` → `hasFeatureAccess()`
- `POST /api/user/upgrade` → `upgradeSubscription()`
- `GET /api/rewards/balance` → `getUserRewardBalances()`
- `POST /api/withdrawals/create` → `createWithdrawalRequest()`
- `GET /api/analytics/trading` → `getUserAnalytics()`

## 📞 Support

Each service has detailed JSDoc comments and error handling. Errors return objects with:
- `success: boolean` - Operation success status
- `error?: string` - Error message if failed
- `data?: any` - Result data if successful

All operations are logged via `AuditLoggingService` for debugging.

---

**Version**: 1.0.0  
**Status**: ✅ Production Ready  
**Last Updated**: 2024
