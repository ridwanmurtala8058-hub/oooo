/**
 * CashbackService - Phase 1.0 Commercial Features
 * Manages cashback rewards on user trades, platform fee sharing
 */

import prisma from './prisma';
import RewardsService from './rewards.service';

export interface CashbackEvent {
  orderId: string;
  amount: number; // in USD
  rate: number; // percentage
  description: string;
}

export class CashbackService {
  // Configurable cashback rates (stored in DB or config)
  static readonly DEFAULT_CASHBACK_RATE = 0.1; // 0.1% of trade value

  /**
   * Record cashback on a trade execution
   * Called after successful trade completion
   */
  static async recordCashbackOnTrade(
    userId: number,
    tradeAmount: number, // in USD
    tradeFeeUSD: number, // actual platform fee charged
    orderId: string,
    description: string = 'Trade execution fee sharing'
  ): Promise<{ success: boolean; cashbackAmount?: number; error?: string }> {
    try {
      // Calculate cashback (e.g., user gets 20% of the fee they paid)
      const cashbackAmount = tradeFeeUSD * 0.2; // 20% of fee

      if (cashbackAmount <= 0) {
        console.log(
          `[CashbackService] Trade ${orderId}: No cashback (fee too small, $${tradeFeeUSD.toFixed(4)})`
        );
        return { success: true, cashbackAmount: 0 };
      }

      // Record via RewardsService
      const result = await RewardsService.recordReward(
        userId,
        'cashback',
        cashbackAmount,
        {
          orderId,
          tradeAmount,
          tradeFeeUSD,
          description,
          sourceType: 'trade_execution'
        }
      );

      if (result.success) {
        console.log(
          `[CashbackService] Recorded cashback: User ${userId}, Order ${orderId}, ` +
          `Amount: $${cashbackAmount.toFixed(4)}`
        );
      }

      return {
        success: result.success,
        cashbackAmount: result.success ? cashbackAmount : undefined,
        error: result.error
      };
    } catch (error) {
      console.error('[CashbackService] Error recording cashback:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Record bonus cashback for special events/promotions
   * Admin-triggered for promotional campaigns
   */
  static async recordBonusCashback(
    userId: number,
    amount: number,
    campaignId: string,
    description: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (amount <= 0) {
        return { success: false, error: 'Bonus amount must be positive' };
      }

      const result = await RewardsService.recordReward(
        userId,
        'cashback',
        amount,
        {
          campaignId,
          description,
          sourceType: 'promotion'
        }
      );

      if (result.success) {
        console.log(
          `[CashbackService] Recorded bonus cashback: User ${userId}, Campaign ${campaignId}, ` +
          `Amount: $${amount.toFixed(2)}`
        );
      }

      return { success: result.success, error: result.error };
    } catch (error) {
      console.error('[CashbackService] Error recording bonus cashback:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Record staking/loyalty cashback reward
   * Periodic bonus for holding positions
   */
  static async recordStakingCashback(
    userId: number,
    amount: number,
    periodStart: Date,
    periodEnd: Date
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await RewardsService.recordReward(
        userId,
        'cashback',
        amount,
        {
          period: `${periodStart.toISOString().split('T')[0]} to ${periodEnd.toISOString().split('T')[0]}`,
          description: 'Staking/Loyalty reward',
          sourceType: 'staking'
        }
      );

      if (result.success) {
        console.log(
          `[CashbackService] Recorded staking cashback: User ${userId}, ` +
          `Period: ${periodStart.toDateString()} to ${periodEnd.toDateString()}, ` +
          `Amount: $${amount.toFixed(2)}`
        );
      }

      return { success: result.success, error: result.error };
    } catch (error) {
      console.error('[CashbackService] Error recording staking cashback:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get cashback balance for user
   */
  static async getCashbackBalance(userId: number): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { cashback_balance_usd: true }
    });

    return user?.cashback_balance_usd ?? 0;
  }

  /**
   * Get cashback history for user
   */
  static async getCashbackHistory(
    userId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<{
    rewards: Array<{
      id: number;
      amount: number;
      date: Date;
      description: string;
      status: string;
    }>;
    total: number;
  }> {
    const [rewards, total] = await prisma.$transaction([
      prisma.rewardsLedger.findMany({
        where: {
          user_id: userId,
          reward_type: 'cashback'
        },
        orderBy: { recorded_at: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          amount_usd: true,
          recorded_at: true,
          description: true,
          status: true
        }
      }),
      prisma.rewardsLedger.count({
        where: {
          user_id: userId,
          reward_type: 'cashback'
        }
      })
    ]);

    return {
      rewards: rewards.map((r: any) => ({
        id: r.id,
        amount: r.amount_usd,
        date: r.recorded_at,
        description: r.description,
        status: r.status
      })),
      total
    };
  }

  /**
   * Calculate cashback tier bonus
   * Premium users get higher cashback
   */
  static getCashbackRate(userTier: string): number {
    const tierRates: { [key: string]: number } = {
      free: 0.05,      // 0.05% cashback
      premium: 0.1,    // 0.1% cashback
      elite: 0.15,     // 0.15% cashback
      vip: 0.2         // 0.2% cashback
    };

    return tierRates[userTier] ?? this.DEFAULT_CASHBACK_RATE;
  }

  /**
   * Process batch cashback distribution (cron job)
   * Awards staking/loyalty cashback to active users
   */
  static async processPeriodicalCashbackDistribution(period: string): Promise<{
    success: boolean;
    processed: number;
    error?: string;
  }> {
    try {
      console.log(`[CashbackService] Starting ${period} cashback distribution...`);

      // This is a placeholder for a complex calculation
      // Real implementation would:
      // 1. Group users by tier
      // 2. Calculate eligible cashback per user
      // 3. Batch record rewards
      // 4. Emit notifications

      // Example: Award $5 to all active users
      const users = await prisma.user.findMany({
        where: {
          id: { gt: 0 } // all users (placeholder)
        },
        select: { id: true, tier: true },
        take: 1000
      });

      let processed = 0;
      for (const user of users) {
        // Skip if user has no recent trades (implement actual activity check)
        const baseCashback = 5.0; // $5 per period
        const tierMultiplier = this.getCashbackRate(user.tier) / this.DEFAULT_CASHBACK_RATE;
        const amount = baseCashback * tierMultiplier;

        const result = await this.recordStakingCashback(
          user.id,
          amount,
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          new Date()
        );

        if (result.success) {
          processed++;
        }
      }

      console.log(`[CashbackService] ${period} distribution complete. Processed ${processed} users.`);
      return { success: true, processed };
    } catch (error) {
      console.error(`[CashbackService] Error processing ${period} cashback distribution:`, error);
      return { success: false, processed: 0, error: String(error) };
    }
  }
}

export default CashbackService;
