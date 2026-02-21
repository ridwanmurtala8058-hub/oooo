/**
 * RewardsService - Phase 1.0 Commercial Features
 * Core service for managing all types of rewards (referral, cashback, staking)
 */

import prisma from './prisma';

export interface RewardRecord {
  id: number;
  userId: number;
  type: string; // 'referral' | 'cashback' | 'staking'
  amount: number;
  status: string; // 'available' | 'withdrawn' | 'expired'
  recordedAt: Date;
  expireAt?: Date;
  description: string;
}

export class RewardsService {
  /**
   * Record a reward in the ledger
   */
  static async recordReward(
    userId: number,
    rewardType: string,
    amount: number,
    metadata: Record<string, any> = {}
  ): Promise<{ success: boolean; rewardId?: number; error?: string }> {
    try {
      if (amount <= 0) {
        return { success: false, error: 'Reward amount must be positive' };
      }

      // Create reward ledger entry
      const reward = await prisma.rewardsLedger.create({
        data: {
          user_id: userId,
          reward_type: rewardType,
          amount_usd: amount,
          status: 'available',
          description: metadata.description || `${rewardType} reward`,
          metadata: metadata,
          recorded_at: new Date(),
          expires_at: this.calculateExpireDate(rewardType)
        }
      });

      // Update user balance
      await this.updateUserBalance(userId, rewardType, amount);

      console.log(
        `[RewardsService] Recorded ${rewardType} reward: User ${userId}, Amount: $${amount.toFixed(2)}`
      );

      return { success: true, rewardId: reward.id };
    } catch (error) {
      console.error('[RewardsService] Error recording reward:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get user's current reward balances
   */
  static async getUserRewardBalances(userId: number): Promise<{
    referral: number;
    cashback: number;
    total: number;
  }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          referral_balance_usd: true,
          cashback_balance_usd: true
        }
      });

      return {
        referral: user?.referral_balance_usd ?? 0,
        cashback: user?.cashback_balance_usd ?? 0,
        total: (user?.referral_balance_usd ?? 0) + (user?.cashback_balance_usd ?? 0)
      };
    } catch (error) {
      console.error('[RewardsService] Error getting user reward balances:', error);
      return { referral: 0, cashback: 0, total: 0 };
    }
  }

  /**
   * Get reward history
   */
  static async getRewardHistory(
    userId: number,
    rewardType?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ rewards: RewardRecord[]; total: number }> {
    try {
      const where: any = { user_id: userId };
      if (rewardType) {
        where.reward_type = rewardType;
      }

      const [rewards, total] = await prisma.$transaction([
        prisma.rewardsLedger.findMany({
          where,
          orderBy: { recorded_at: 'desc' },
          take: limit,
          skip: offset
        }),
        prisma.rewardsLedger.count({ where })
      ]);

      return {
        rewards: rewards.map((r: any) => ({
          id: r.id,
          userId: r.user_id,
          type: r.reward_type,
          amount: r.amount_usd,
          status: r.status,
          recordedAt: r.recorded_at,
          expireAt: r.expires_at,
          description: r.description
        })),
        total
      };
    } catch (error) {
      console.error('[RewardsService] Error getting reward history:', error);
      return { rewards: [], total: 0 };
    }
  }

  /**
   * Check for expired rewards and clean them up
   */
  static async cleanupExpiredRewards(): Promise<{ success: boolean; cleaned: number }> {
    try {
      const now = new Date();

      const expired = await prisma.rewardsLedger.updateMany({
        where: {
          status: 'available',
          expires_at: { lte: now }
        },
        data: {
          status: 'expired'
        }
      });

      console.log(`[RewardsService] Cleaned up ${expired.count} expired rewards`);

      return { success: true, cleaned: expired.count };
    } catch (error) {
      console.error('[RewardsService] Error cleaning up expired rewards:', error);
      return { success: false, cleaned: 0 };
    }
  }

  /**
   * Expire specific reward
   */
  static async expireReward(rewardId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const reward = await prisma.rewardsLedger.findUnique({
        where: { id: rewardId },
        select: {
          user_id: true,
          reward_type: true,
          amount_usd: true,
          status: true
        }
      });

      if (!reward) {
        return { success: false, error: 'Reward not found' };
      }

      if (reward.status !== 'available') {
        return { success: false, error: `Reward is already ${reward.status}` };
      }

      // Update reward status
      await prisma.rewardsLedger.update({
        where: { id: rewardId },
        data: { status: 'expired' }
      });

      // Revert balance
      await this.updateUserBalance(reward.user_id, reward.reward_type, -reward.amount_usd);

      console.log(
        `[RewardsService] Expired reward ${rewardId}. Reverted $${reward.amount_usd.toFixed(2)} from user ${reward.user_id}`
      );

      return { success: true };
    } catch (error) {
      console.error('[RewardsService] Error expiring reward:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Calculate reward expiration date based on type
   */
  private static calculateExpireDate(rewardType: string): Date | null {
    const expireDate = new Date();

    switch (rewardType) {
      case 'referral':
        expireDate.setFullYear(expireDate.getFullYear() + 1); // 1 year
        return expireDate;
      case 'cashback':
        expireDate.setFullYear(expireDate.getFullYear() + 2); // 2 years
        return expireDate;
      case 'staking':
        expireDate.setFullYear(expireDate.getFullYear() + 3); // 3 years
        return expireDate;
      default:
        return null; // No expiration
    }
  }

  /**
   * Update user's reward balance
   */
  private static async updateUserBalance(
    userId: number,
    rewardType: string,
    amount: number
  ): Promise<void> {
    const updateData: any = {};

    if (rewardType === 'referral') {
      updateData.referral_balance_usd = { increment: amount };
    } else if (rewardType === 'cashback') {
      updateData.cashback_balance_usd = { increment: amount };
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: updateData
      });
    }
  }

  /**
   * Get reward analytics
   */
  static async getRewardAnalytics(userId: number): Promise<{
    totalReferralEarned: number;
    totalCashbackEarned: number;
    totalAvailable: number;
    totalWithdrawn: number;
    rewardsByMonth: Array<{
      month: string;
      referral: number;
      cashback: number;
    }>;
  }> {
    try {
      const rewards = await prisma.rewardsLedger.findMany({
        where: { user_id: userId }
      });

      const byMonth: Record<string, any> = {};

      rewards.forEach((r: any) => {
        const monthKey = r.recorded_at.toISOString().slice(0, 7);
        if (!byMonth[monthKey]) {
          byMonth[monthKey] = { referral: 0, cashback: 0 };
        }
        if (r.reward_type === 'referral') {
          byMonth[monthKey].referral += r.amount_usd;
        } else if (r.reward_type === 'cashback') {
          byMonth[monthKey].cashback += r.amount_usd;
        }
      });

      const totalReferral = rewards
        .filter((r: any) => r.reward_type === 'referral')
        .reduce((sum: number, r: any) => sum + r.amount_usd, 0);

      const totalCashback = rewards
        .filter((r: any) => r.reward_type === 'cashback')
        .reduce((sum: number, r: any) => sum + r.amount_usd, 0);

      const totalAvailable = rewards
        .filter((r: any) => r.status === 'available')
        .reduce((sum: number, r: any) => sum + r.amount_usd, 0);

      const totalWithdrawn = rewards
        .filter((r: any) => r.status === 'withdrawn')
        .reduce((sum: number, r: any) => sum + r.amount_usd, 0);

      return {
        totalReferralEarned: totalReferral,
        totalCashbackEarned: totalCashback,
        totalAvailable,
        totalWithdrawn,
        rewardsByMonth: Object.entries(byMonth)
          .sort()
          .map(([month, data]) => ({
            month,
            ...data
          }))
      };
    } catch (error) {
      console.error('[RewardsService] Error getting reward analytics:', error);
      return {
        totalReferralEarned: 0,
        totalCashbackEarned: 0,
        totalAvailable: 0,
        totalWithdrawn: 0,
        rewardsByMonth: []
      };
    }
  }
}

export default RewardsService;
