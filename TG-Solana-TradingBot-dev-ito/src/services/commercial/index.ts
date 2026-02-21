/**
 * Commercial Services Module - Phase 1.0
 * Central export point for all commercial feature services
 *
 * Usage:
 * import { WithdrawalService, CashbackService, ... } from '@services/commercial';
 */

export { default as RewardsService } from '../rewards.service';
export { default as CashbackService } from '../cashback.service';
export { default as CommercialSettingsService } from '../commercial.settings.service';
export { default as WithdrawalService } from '../withdrawal.service';
export { default as PaymentProcessingService } from '../payment.processing.service';
export { default as AuditLoggingService } from '../audit.logging.service';
export { default as AnalyticsService } from '../analytics.service';

// Type exports
export type { RewardRecord } from '../rewards.service';
export type { CashbackEvent } from '../cashback.service';
export type { SubscriptionTier, UserSubscription } from '../commercial.settings.service';
export type { WithdrawalRequest } from '../withdrawal.service';
export type { Payment, Invoice } from '../payment.processing.service';
export type { AuditLog } from '../audit.logging.service';
export type { UserAnalytics, PortfolioSnapshot } from '../analytics.service';

/**
 * Commercial Services Initialization
 * 
 * Initialize all services on application startup
 */
export async function initializeCommercialServices(): Promise<void> {
  console.log('[CommercialServices] Initializing Phase 1.0 services...');
  
  // All services are stateless and use centralized prisma connection
  // No specific initialization required
  
  console.log('[CommercialServices] ✅ All services initialized and ready');
}

/**
 * Service Usage Examples
 */
export const COMMERCIAL_SERVICES_EXAMPLES = {
  /**
   * Record cashback on trade execution
   */
  recordTradesCashback: `
    import { CashbackService } from '@services/commercial';
    
    const result = await CashbackService.recordCashbackOnTrade(
      userId,
      tradeAmount,
      tradeFeeUSD,
      orderId,
      'User trade execution'
    );
  `,

  /**
   * Create withdrawal request
   */
  createWithdrawal: `
    import { WithdrawalService } from '@services/commercial';
    
    const withdrawal = await WithdrawalService.createWithdrawalRequest(
      userId,
      'referral',           // type
      100,                  // amount
      '9B5X4z...'          // destination
    );
  `,

  /**
   * Upgrade user subscription
   */
  upgradeSubscription: `
    import { CommercialSettingsService } from '@services/commercial';
    
    const result = await CommercialSettingsService.upgradeSubscription(
      userId,
      'elite',              // new tier
      'card'                // payment method
    );
  `,

  /**
   * Check feature access
   */
  checkFeatureAccess: `
    import { CommercialSettingsService } from '@services/commercial';
    
    const hasAPI = await CommercialSettingsService.hasFeatureAccess(
      userId,
      'api-access'
    );
  `,

  /**
   * Process monthly billing
   */
  monthlyBilling: `
    import { PaymentProcessingService } from '@services/commercial';
    
    // Run as cron job on 1st of month
    const result = await PaymentProcessingService.processMonthlyBilling();
  `,

  /**
   * Log commercial action
   */
  auditLog: `
    import { AuditLoggingService } from '@services/commercial';
    
    await AuditLoggingService.logWithdrawalAction(
      userId,
      'request',            // action
      withdrawalId,
      amount,
      'referral'
    );
  `,

  /**
   * Get user analytics
   */
  userAnalytics: `
    import { AnalyticsService } from '@services/commercial';
    
    const analytics = await AnalyticsService.getUserAnalytics(userId, 30);
    // Returns P&L, win rate, rewards, activity patterns
  `,
};

/**
 * Common Workflows
 */
export const COMMERCIAL_WORKFLOWS = {
  /**
   * Full subscription upgrade workflow
   */
  upgradeUserSubscription: async (
    userId: number,
    newTier: string
  ) => {
    const { CommercialSettingsService, AuditLoggingService } = require('./commercial');

    // 1. Get current tier
    const currentTier = await CommercialSettingsService.getUserTier(userId);

    // 2. Validate upgrade
    const newTierDetails = CommercialSettingsService.getTierDetails(newTier);
    if (!newTierDetails) {
      throw new Error(`Invalid tier: ${newTier}`);
    }

    // 3. Perform upgrade
    const result = await CommercialSettingsService.upgradeSubscription(userId, newTier);
    if (!result.success) {
      throw new Error(result.error);
    }

    // 4. Audit log
    await AuditLoggingService.logSubscriptionAction(
      userId,
      'upgrade',
      currentTier,
      newTier,
      newTierDetails.monthlyPriceUSD
    );

    // 5. Send notification (implement separately)
    // await sendUpgradeEmail(userId, newTier);

    return result;
  },

  /**
   * Full withdrawal workflow
   */
  completeWithdrawal: async (
    userId: number,
    amount: number,
    destinationWallet: string
  ) => {
    const { WithdrawalService, AuditLoggingService } = require('./commercial');

    // 1. Create withdrawal request
    const withdrawal = await WithdrawalService.createWithdrawalRequest(
      userId,
      'referral',
      amount,
      destinationWallet
    );

    if (!withdrawal.success) {
      throw new Error(withdrawal.error);
    }

    // 2. Audit log
    await AuditLoggingService.logWithdrawalAction(
      userId,
      'request',
      withdrawal.withdrawal!.id,
      amount,
      'referral'
    );

    // 3. Admin review (manual process)
    // await AdminService.reviewWithdrawal(withdrawal.withdrawal!.id);

    // 4. Execute payment (when approved)
    // const paymentResult = await WithdrawalService.sendOnchainWithdrawal(
    //  withdrawal.withdrawal!.id,
    //   userId,
    //   amount / SOL_PRICE
    // );

    return withdrawal;
  },

  /**
   * Trade execution with rewards
   */
  executeTradeWithRewards: async (
    userId: number,
    tradeAmount: number,
    platformFee: number
  ) => {
    const { CashbackService, AuditLoggingService } = require('./commercial');

    // 1. Execute trade (implemented elsewhere)
    // const tradeResult = await tradeService.executeTrade(...);

    // 2. Record cashback
    const cashbackResult = await CashbackService.recordCashbackOnTrade(
      userId,
      tradeAmount,
      platformFee,
      `order_${Date.now()}`,
      'Trade execution fee sharing'
    );

    if (cashbackResult.success) {
      // 3. Audit log (optional - CashbackService logs internally)
      await AuditLoggingService.logRewardAction(
        userId,
        'earned',
        'cashback',
        cashbackResult.cashbackAmount || 0,
        'trade_execution'
      );
    }

    return cashbackResult;
  },

  /**
   * Get user's commercial profile
   */
  getUserCommercialProfile: async (userId: number) => {
    const {
      CommercialSettingsService,
      RewardsService,
      AnalyticsService,
    } = require('./commercial');

    // 1. Get subscription
    const tier = await CommercialSettingsService.getUserTier(userId);
    const tierDetails = CommercialSettingsService.getTierDetails(tier);

    // 2. Get rewards
    const rewards = await RewardsService.getUserRewardBalances(userId);

    // 3. Get analytics
    const analytics = await AnalyticsService.getUserAnalytics(userId, 30);

    // 4. Get rewards summary
    const rewardsSummary = await AnalyticsService.getRewardsSummary(userId);

    return {
      subscription: {
        tier,
        ...tierDetails,
      },
      rewards,
      analytics,
      rewardsSummary,
    };
  },
};

/**
 * Required Database Migrations
 *
 * Run these Prisma migrations:
 * npx prisma migrate dev --name add_commercial_features
 *
 * Required tables:
 * - Subscription
 * - Withdrawal
 * - RewardsLedger
 * - Payment
 * - Invoice
 * - AuditLog
 *
 * User table extensions:
 * - tier
 * - referral_balance_usd
 * - cashback_balance_usd
 */

/**
 * Required Cron Jobs
 *
 * Daily:
 * - Check for suspicious activity
 * - Archive old audit logs
 *
 * Monthly:
 * - Process monthly billing
 * - Distribute staking rewards
 * - Clean up expired rewards
 * - Generate compliance reports
 */

export default {
  RewardsService: require('./rewards.service').default,
  CashbackService: require('./cashback.service').default,
  CommercialSettingsService: require('./commercial.settings.service').default,
  WithdrawalService: require('./withdrawal.service').default,
  PaymentProcessingService: require('./payment.processing.service').default,
  AuditLoggingService: require('./audit.logging.service').default,
  AnalyticsService: require('./analytics.service').default,
};
