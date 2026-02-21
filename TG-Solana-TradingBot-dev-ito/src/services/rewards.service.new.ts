/**
 * RewardsService - Phase 1.0 Commercial Features
 * Manages rewards ledger and user balance queries
 */

import prisma from './prisma';

export interface RewardLedgerEntry {
  id: number;
  rewardType: string;
  amount: number;
  status: string;
  tradeId: number | null;
  createdAt: Date;
}

export interface UserRewardsBalance {
  userId: number;
  referralBalance: number;
  cashbackBalance: number;
  pendingReferralRewards: number;
  availableCashbackRewards: number;
  withdrawnReferralRewards: number;
  withdrawnCashbackRewards: number;
}

export class RewardsService {
  /**
   * Get complete rewards balance for a user
   */
  static async getUserRewardsBalance(userId: number): Promise<UserRewardsBalance> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        referral_balance_usd: true,
        cashback_balance_usd: true
      }
    });

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Fetch detailed ledger stats
    const [pendingReferral, pendingCashback, withdrawnReferral, withdrawnCashback] = await prisma.$transaction([
      prisma.rewardsLedger.aggregate({
        where: { user_id: userId, reward_type: 'referral', status: 'available' },
        _sum: { amount_usd: true }
      }),
      prisma.rewardsLedger.aggregate({
        where: { user_id: userId, reward_type: 'cashback', status: 'available' },
        _sum: { amount_usd: true }
      }),
      prisma.rewardsLedger.aggregate({
        where: { user_id: userId, reward_type: 'referral', status: 'withdrawn' },
        _sum: { amount_usd: true }
      }),
      prisma.rewardsLedger.aggregate({
        where: { user_id: userId, reward_type: 'cashback', status: 'withdrawn' },
        _sum: { amount_usd: true }
      })
    ]);

    return {
      userId: user.id,
      referralBalance: user.referral_balance_usd,
      cashbackBalance: user.cashback_balance_usd,
      pendingReferralRewards: pendingReferral._sum.amount_usd ?? 0,
      availableCashbackRewards: pendingCashback._sum.amount_usd ?? 0,
      withdrawnReferralRewards: withdrawnReferral._sum.amount_usd ?? 0,
      withdrawnCashbackRewards: withdrawnCashback._sum.amount_usd ?? 0
    };
  }

  /**
   * Get reward ledger entries for a user with pagination
   */
  static async getUserRewardLedger(
    userId: number,
    rewardType?: string,
    status?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ entries: RewardLedgerEntry[]; total: number }> {
    const where: any = { user_id: userId };
    if (rewardType) where.reward_type = rewardType;
    if (status) where.status = status;

    const [entries, total] = await prisma.$transaction([
      prisma.rewardsLedger.findMany({
        where,
        select: {
          id: true,
          reward_type: true,
          amount_usd: true,
          status: true,
          trade_id: true,
          created_at: true
        },
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.rewardsLedger.count({ where })
    ]);

    return {
      entries: entries.map(e => ({
        id: e.id,
        rewardType: e.reward_type,
        amount: e.amount_usd,
        status: e.status,
        tradeId: e.trade_id,
        createdAt: e.created_at
      })),
      total
    };
  }

  /**
   * Mark ledger entries as withdrawn (in a withdrawal transaction)
   * Called by WithdrawalService when withdrawal is created
   */
  static async markLedgerEntriesWithdrawn(
    userIds: number[],
    rewardType: string,
    withdrawalId: number
  ): Promise<number> {
    // Only mark "available" entries as withdrawn
    const result = await prisma.rewardsLedger.updateMany({
      where: {
        user_id: { in: userIds },
        reward_type: rewardType,
        status: 'available'
      },
      data: {
        status: 'withdrawn',
        withdrawn_by_id: withdrawalId,
        withdrawn_at: new Date()
      }
    });

    return result.count;
  }

  /**
   * Get reward stats for a specific trade
   */
  static async getTradeRewards(tradeId: number): Promise<{
    tradeId: number;
    referralReward: number;
    cashbackReward: number;
    totalRewards: number;
    recipientCount: number;
  }> {
    const rewards = await prisma.rewardsLedger.findMany({
      where: { trade_id: tradeId },
      select: {
        reward_type: true,
        amount_usd: true,
        user_id: true
      }
    });

    const referralReward = rewards
      .filter(r => r.reward_type === 'referral')
      .reduce((sum, r) => sum + r.amount_usd, 0);

    const cashbackReward = rewards
      .filter(r => r.reward_type === 'cashback')
      .reduce((sum, r) => sum + r.amount_usd, 0);

    const uniqueRecipients = new Set(rewards.map(r => r.user_id)).size;

    return {
      tradeId,
      referralReward,
      cashbackReward,
      totalRewards: referralReward + cashbackReward,
      recipientCount: uniqueRecipients
    };
  }

  /**
   * Estimate earning potential for a referrer
   */
  static async estimateReferrerEarnings(userId: number, daysWindow: number = 30): Promise<{
    totalReferred: number;
    activeReferred: number;
    referredTradeVolume: number;
    estimatedFeesGenerated: number;
    estimatedReferralRewards: number;
  }> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysWindow);

    // Get referred users
    const referredUsers = await prisma.user.findMany({
      where: { referred_by_user_id: userId },
      select: { id: true, createdAt: true }
    });

    // Get their trade volume
    const referredUserIds = referredUsers.map(u => u.id);
    const tradeStats = await prisma.trade.aggregate({
      where: {
        user: { id: { in: referredUserIds } },
        createdAt: { gte: fromDate }
      },
      _sum: { volume_usd: true, fee_total_usd: true }
    });

    // Get actual referral rewards earned
    const rewards = await prisma.rewardsLedger.aggregate({
      where: {
        user_id: userId,
        reward_type: 'referral',
        created_at: { gte: fromDate }
      },
      _sum: { amount_usd: true }
    });

    const activeReferred = referredUsers.filter(u => {
      const age = Date.now() - u.createdAt.getTime();
      return age > 24 * 60 * 60 * 1000; // Active if > 24h old
    }).length;

    return {
      totalReferred: referredUsers.length,
      activeReferred,
      referredTradeVolume: tradeStats._sum.volume_usd ?? 0,
      estimatedFeesGenerated: tradeStats._sum.fee_total_usd ?? 0,
      estimatedReferralRewards: rewards._sum.amount_usd ?? 0
    };
  }

  /**
   * Get leaderboard of top referrers
   */
  static async getTopReferrers(limit: number = 10): Promise<Array<{
    userId: number;
    username: string;
    referredCount: number;
    referralEarnings: number;
    totalTradeVolume: number;
  }>> {
    // Get top referrers by referral earnings
    const topReferrers = await prisma.user.findMany({
      where: {
        // Only users who have referrals
        referrals: {
          some: {}
        }
      },
      select: {
        id: true,
        username: true,
        referral_balance_usd: true,
        referrals: true,
        trades: {
          select: { volume_usd: true }
        }
      },
      orderBy: { referral_balance_usd: 'desc' },
      take: limit
    });

    return topReferrers.map(user => ({
      userId: user.id,
      username: user.username,
      referredCount: user.referrals.length,
      referralEarnings: user.referral_balance_usd,
      totalTradeVolume: user.trades.reduce((sum, t) => sum + (t.volume_usd || 0), 0)
    }));
  }
}

export default RewardsService;
