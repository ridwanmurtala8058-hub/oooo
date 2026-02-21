/**
 * FeeService - Phase 1.0 Commercial Features
 * Calculates and applies platform fee split to trades
 * 
 * Model C: Platform 1.0% fee
 * - Referral share: 20% of fee (0.2%)
 * - Trader cashback: 5% of fee (0.05%)
 * - Platform keeps: 75% of fee (0.75%)
 * 
 * Configurable via environment:
 * PLATFORM_FEE_PERCENT (default 1.0)
 * REFERRAL_SHARE_PERCENT (default 20)
 * CASHBACK_SHARE_PERCENT (default 5)
 * MIN_TRADE_VOLUME_USD (default 10)
 * MAX_DAILY_CASHBACK_USD (default 50)
 */

import prisma from './prisma';
import { RewardsService } from './rewards.service';

interface FeeConfig {
  platformFeePercent: number;
  referralSharePercent: number;
  cashbackSharePercent: number;
  minTradeVolume: number;
  maxDailyCashback: number;
}

export class FeeService {
  /**
   * Load fee configuration from environment or defaults
   */
  static loadConfig(): FeeConfig {
    return {
      platformFeePercent: parseFloat(process.env.PLATFORM_FEE_PERCENT || '1.0'),
      referralSharePercent: parseFloat(process.env.REFERRAL_SHARE_PERCENT || '20'),
      cashbackSharePercent: parseFloat(process.env.CASHBACK_SHARE_PERCENT || '5'),
      minTradeVolume: parseFloat(process.env.MIN_TRADE_VOLUME_USD || '10'),
      maxDailyCashback: parseFloat(process.env.MAX_DAILY_CASHBACK_USD || '50')
    };
  }

  /**
   * Calculate fee split for a trade
   * Returns exact amounts in USD
   * 
   * Formula:
   * fee_total = volume * platform_fee_percent / 100
   * referral_reward = fee_total * referral_share_percent / 100
   * cashback = fee_total * cashback_share_percent / 100
   * platform_net = fee_total - referral_reward - cashback
   */
  static calculateFees(volumeUSD: number, config: FeeConfig): {
    feeTotal: number;
    referralReward: number;
    cashback: number;
    platformNet: number;
  } {
    const feeTotal = volumeUSD * (config.platformFeePercent / 100);
    const referralReward = feeTotal * (config.referralSharePercent / 100);
    const cashback = feeTotal * (config.cashbackSharePercent / 100);
    const platformNet = feeTotal - referralReward - cashback;

    return {
      feeTotal: Math.round(feeTotal * 10000) / 10000, // 4 decimals
      referralReward: Math.round(referralReward * 10000) / 10000,
      cashback: Math.round(cashback * 10000) / 10000,
      platformNet: Math.round(platformNet * 10000) / 10000
    };
  }

  /**
   * Apply trade fees ONCE per trade (idempotent)
   * 
   * Called after a successful swap (buy/sell)
   * Creates reward ledger entries and updates user balances in a single transaction
   * 
   * Idempotency:
   * - If trade.transaction_signature is set, fees already applied - skip
   * - Otherwise, update trade to mark fees_applied atomically
   * 
   * Anti-abuse:
   * - Cashback only if volume >= minTradeVolume
   * - Referral only if user has referrer AND account age > 5 min
   * - Daily cashback cap enforced
   */
  static async applyTradeFees(
    tradeId: number,
    userId: number,
    walletAddress: string,
    volumeUSD: number,
    transactionSignature: string,
    skipCashback: boolean = false
  ): Promise<{
    success: boolean;
    feeApplied: boolean;
    fees: { feeTotal: number; referralReward: number; cashback: number; platformNet: number } | null;
    error?: string;
  }> {
    try {
      const config = this.loadConfig();
      
      // Fetch trade to check idempotency
      const trade = await prisma.trade.findUnique({
        where: { id: tradeId },
        select: {
          transaction_signature: true,
          fee_status: true,
          volume_usd: true
        }
      });

      if (!trade) {
        return {
          success: false,
          feeApplied: false,
          fees: null,
          error: `Trade ${tradeId} not found`
        };
      }

      // Already applied - idempotent return
      if (trade.transaction_signature && trade.fee_status === 'applied') {
        console.log(`[FeeService] Fees already applied for trade ${tradeId}. Skipping.`);
        return {
          success: true,
          feeApplied: false,
          fees: null
        };
      }

      // Anti-abuse: Min trade volume
      if (volumeUSD < config.minTradeVolume) {
        console.log(`[FeeService] Trade ${tradeId} volume $${volumeUSD} below minimum $${config.minTradeVolume}. No fees.`);
        return {
          success: true,
          feeApplied: false,
          fees: null
        };
      }

      // Calculate fees
      const fees = this.calculateFees(volumeUSD, config);

      // Fetch user and check referral eligibility
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          referred_by_user_id: true,
          createdAt: true,
          username: true
        }
      });

      if (!user) {
        return {
          success: false,
          feeApplied: false,
          fees: null,
          error: `User ${userId} not found`
        };
      }

      // Check daily cashback cap
      let applicableCashback = fees.cashback;
      if (!skipCashback && fees.cashback > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dailyCashback = await prisma.rewardsLedger.aggregate({
          where: {
            user_id: userId,
            reward_type: 'cashback',
            created_at: { gte: today }
          },
          _sum: { amount_usd: true }
        });

        const dailyTotal = (dailyCashback._sum.amount_usd || 0) + fees.cashback;
        if (dailyTotal > config.maxDailyCashback) {
          applicableCashback = Math.max(0, config.maxDailyCashback - (dailyCashback._sum.amount_usd || 0));
          console.log(
            `[FeeService] Daily cashback cap: ${dailyTotal.toFixed(2)} > $${config.maxDailyCashback}. ` +
            `Applied: $${applicableCashback.toFixed(2)}`
          );
        }
      } else if (skipCashback) {
        applicableCashback = 0;
      }

      // Determine if referral is eligible
      let applicableReferralReward = 0;
      let referrerId: number | null = null;

      if (user.referred_by_user_id) {
        const timeSinceCreation = Date.now() - user.createdAt.getTime();
        const minAgeMS = 5 * 60 * 1000;

        if (timeSinceCreation >= minAgeMS) {
          applicableReferralReward = fees.referralReward;
          referrerId = user.referred_by_user_id;
        } else {
          console.log(`[FeeService] User ${userId} account age ${(timeSinceCreation / 1000).toFixed(0)}s < 5min. No referral reward.`);
        }
      }

      // Apply all changes in a single transaction
      const result = await prisma.$transaction(async (tx) => {
        // 1. Update Trade record with fee details
        const updatedTrade = await tx.trade.update({
          where: { id: tradeId },
          data: {
            transaction_signature: transactionSignature,
            volume_usd: volumeUSD,
            fee_total_usd: fees.feeTotal,
            referral_reward_usd: applicableReferralReward,
            cashback_usd: applicableCashback,
            platform_net_usd: fees.feeTotal - applicableReferralReward - applicableCashback,
            fee_status: 'applied',
            fee_applied_at: new Date()
          }
        });

        // 2. Create reward ledger entries
        const ledgerEntries = [];

        // Cashback entry
        if (applicableCashback > 0) {
          ledgerEntries.push(
            tx.rewardsLedger.create({
              data: {
                user_id: userId,
                trade_id: tradeId,
                reward_type: 'cashback',
                amount_usd: applicableCashback,
                status: 'available'
              }
            })
          );
        }

        // Referral entry (for referrer)
        if (applicableReferralReward > 0 && referrerId) {
          ledgerEntries.push(
            tx.rewardsLedger.create({
              data: {
                user_id: referrerId,
                trade_id: tradeId,
                reward_type: 'referral',
                amount_usd: applicableReferralReward,
                status: 'available'
              }
            })
          );
        }

        // Execute all ledger creates
        await Promise.all(ledgerEntries);

        // 3. Update user balances atomically
        const updateData: any = {};
        if (applicableCashback > 0) {
          updateData.cashback_balance_usd = { increment: applicableCashback };
        }
        if (applicableReferralReward > 0 && referrerId) {
          // Update referrer's balance
          await tx.user.update({
            where: { id: referrerId },
            data: { referral_balance_usd: { increment: applicableReferralReward } }
          });
        }

        // Update trader's cashback balance
        if (updateData.cashback_balance_usd) {
          await tx.user.update({
            where: { id: userId },
            data: updateData
          });
        }

        return updatedTrade;
      });

      console.log(
        `[FeeService] Applied fees to trade ${tradeId}: ` +
        `Fee: $${fees.feeTotal.toFixed(2)}, ` +
        `Referral: $${applicableReferralReward.toFixed(2)}, ` +
        `Cashback: $${applicableCashback.toFixed(2)}`
      );

      return {
        success: true,
        feeApplied: true,
        fees: {
          feeTotal: fees.feeTotal,
          referralReward: applicableReferralReward,
          cashback: applicableCashback,
          platformNet: fees.feeTotal - applicableReferralReward - applicableCashback
        }
      };
    } catch (error) {
      console.error(`[FeeService] Error applying fees to trade ${tradeId}:`, error);
      return {
        success: false,
        feeApplied: false,
        fees: null,
        error: String(error)
      };
    }
  }

  /**
   * Get fee statistics for a user
   */
  static async getUserFeeStats(userId: number): Promise<{
    totalFeesGenerated: number;
    referralEarnings: number;
    cashbackEarnings: number;
    tradesCount: number;
  }> {
    const stats = await prisma.$transaction([
      // Total fees charged on user's trades
      prisma.trade.aggregate({
        where: { user: { id: userId } },
        _sum: { fee_total_usd: true }
      }),
      // User's referral earnings
      prisma.rewardsLedger.aggregate({
        where: { user_id: userId, reward_type: 'referral' },
        _sum: { amount_usd: true }
      }),
      // User's cashback earnings
      prisma.rewardsLedger.aggregate({
        where: { user_id: userId, reward_type: 'cashback' },
        _sum: { amount_usd: true }
      }),
      // Count trades
      prisma.trade.count({
        where: { user: { id: userId } }
      })
    ]);

    return {
      totalFeesGenerated: stats[0]._sum.fee_total_usd ?? 0,
      referralEarnings: stats[1]._sum.amount_usd ?? 0,
      cashbackEarnings: stats[2]._sum.amount_usd ?? 0,
      tradesCount: stats[3]
    };
  }
}

export default FeeService;
