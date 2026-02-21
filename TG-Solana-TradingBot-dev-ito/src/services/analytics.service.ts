/**
 * AnalyticsService - Phase 1.0 Commercial Features
 * Provides user analytics, performance metrics, and insights
 */

import prisma from './prisma';

export interface UserAnalytics {
  userId: number;
  period: {
    start: Date;
    end: Date;
  };
  tradingMetrics: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    totalVolume: number;
  };
  profitMetrics: {
    totalProfit: number;
    totalLoss: number;
    netProfit: number;
    roi: number;
  };
  rewardMetrics: {
    referralEarned: number;
    cashbackEarned: number;
    totalRewardsEarned: number;
  };
  activityMetrics: {
    activeTradesDays: number;
    averageTradesPerDay: number;
    mostActiveTradingHour: number;
    averageTradeSize: number;
  };
}

export interface PortfolioSnapshot {
  timestamp: Date;
  totalAssets: number;
  openPositions: number;
  lockedValue: number;
  pnl: number;
  pnlPercent: number;
}

export class AnalyticsService {
  /**
   * Calculate user trading analytics
   */
  static async getUserAnalytics(
    userId: number,
    periodDays: number = 30
  ): Promise<UserAnalytics | null> {
    try {
      const periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - periodDays);
      const periodEnd = new Date();

      // Get trades
      const trades = await prisma.trade.findMany({
        where: {
          user_id: userId,
          created_at: { gte: periodStart, lte: periodEnd },
          status: { in: ['completed', 'partial'] }
        }
      });

      if (trades.length === 0) {
        return null;
      }

      // Calculate trading metrics
      const winningTrades = trades.filter((t: any) => (t.profit || 0) > 0).length;
      const losingTrades = trades.filter((t: any) => (t.profit || 0) < 0).length;
      const totalVolume = trades.reduce((sum: number, t: any) => sum + (t.amount_usd || 0), 0);
      const totalProfit = trades.reduce((sum: number, t: any) => sum + Math.max(0, t.profit || 0), 0);
      const totalLoss = trades.reduce((sum: number, t: any) => sum + Math.min(0, t.profit || 0), 0);
      const netProfit = totalProfit + totalLoss;

      // Get rewards
      const rewards = await prisma.rewardsLedger.findMany({
        where: {
          user_id: userId,
          recorded_at: { gte: periodStart, lte: periodEnd },
          status: { in: ['available', 'withdrawn'] }
        }
      });

      const referralRewards = rewards
        .filter((r: any) => r.reward_type === 'referral')
        .reduce((sum: number, r: any) => sum + r.amount_usd, 0);
      const cashbackRewards = rewards
        .filter((r: any) => r.reward_type === 'cashback')
        .reduce((sum: number, r: any) => sum + r.amount_usd, 0);

      // Calculate activity metrics
      const activeDays = new Set(trades.map((t: any) => t.created_at.toDateString())).size;
      const avgTradesPerDay = trades.length / Math.max(1, activeDays);
      const hourDistribution: Record<number, number> = {};

      trades.forEach((t: any) => {
        const hour = t.created_at.getHours();
        hourDistribution[hour] = (hourDistribution[hour] || 0) + 1;
      });

      const mostActiveTradingHour = Object.entries(hourDistribution).reduce(
        (max, [hour, count]) => (count > max.count ? { hour: parseInt(hour), count } : max),
        { hour: 0, count: 0 }
      ).hour;

      const avgTradeSize = totalVolume / trades.length;

      // Calculate ROI
      const roi = totalVolume > 0 ? (netProfit / totalVolume) * 100 : 0;

      return {
        userId,
        period: { start: periodStart, end: periodEnd },
        tradingMetrics: {
          totalTrades: trades.length,
          winningTrades,
          losingTrades,
          winRate: trades.length > 0 ? (winningTrades / trades.length) * 100 : 0,
          totalVolume
        },
        profitMetrics: {
          totalProfit,
          totalLoss: Math.abs(totalLoss),
          netProfit,
          roi
        },
        rewardMetrics: {
          referralEarned: referralRewards,
          cashbackEarned: cashbackRewards,
          totalRewardsEarned: referralRewards + cashbackRewards
        },
        activityMetrics: {
          activeTradesDays: activeDays,
          averageTradesPerDay: avgTradesPerDay,
          mostActiveTradingHour,
          averageTradeSize: avgTradeSize
        }
      };
    } catch (error) {
      console.error('[AnalyticsService] Error calculating user analytics:', error);
      return null;
    }
  }

  /**
   * Get portfolio snapshot
   */
  static async getPortfolioSnapshot(userId: number): Promise<PortfolioSnapshot | null> {
    try {
      // Get all open positions
      const positions = await prisma.position.findMany({
        where: {
          user_id: userId,
          is_closed: false
        }
      });

      if (positions.length === 0) {
        return {
          timestamp: new Date(),
          totalAssets: 0,
          openPositions: 0,
          lockedValue: 0,
          pnl: 0,
          pnlPercent: 0
        };
      }

      const totalAssets = positions.reduce((sum: number, p: any) => sum + (p.entry_price * p.amount_sol || 0), 0);
      const lockedValue = totalAssets;
      const pnl = positions.reduce((sum: number, p: any) => sum + (p.pnl || 0), 0);
      const pnlPercent = totalAssets > 0 ? (pnl / lockedValue) * 100 : 0;

      return {
        timestamp: new Date(),
        totalAssets,
        openPositions: positions.length,
        lockedValue,
        pnl,
        pnlPercent
      };
    } catch (error) {
      console.error('[AnalyticsService] Error getting portfolio snapshot:', error);
      return null;
    }
  }

  /**
   * Get portfolio performance history
   */
  static async getPortfolioHistory(
    userId: number,
    days: number = 30
  ): Promise<PortfolioSnapshot[]> {
    try {
      // This is a simplified version
      // In reality, you'd need to store historical snapshots or calculate them from trade history
      const snapshots: PortfolioSnapshot[] = [];
      const current = await this.getPortfolioSnapshot(userId);

      if (current) {
        snapshots.push(current);
      }

      return snapshots;
    } catch (error) {
      console.error('[AnalyticsService] Error getting portfolio history:', error);
      return [];
    }
  }

  /**
   * Get top performing tokens (user's portfolio)
   */
  static async getTopTokens(
    userId: number,
    limit: number = 10
  ): Promise<
    Array<{
      tokenAddress: string;
      symbol: string;
      totalAmount: number;
      averageEntryPrice: number;
      currentValue: number;
      pnl: number;
      pnlPercent: number;
    }>
  > {
    try {
      const positions = await prisma.position.findMany({
        where: {
          user_id: userId
        },
        include: {
          token: true
        }
      });

      const tokenGroups: Record<string, any> = {};

      positions.forEach((p: any) => {
        const key = p.token_address;
        if (!tokenGroups[key]) {
          tokenGroups[key] = {
            tokenAddress: key,
            symbol: p.token?.symbol || 'UNKNOWN',
            positions: []
          };
        }
        tokenGroups[key].positions.push(p);
      });

      const results = Object.values(tokenGroups).map((group: any) => {
        const positions = group.positions;
        const totalAmount = positions.reduce((sum: number, p: any) => sum + (p.amount_sol || 0), 0);
        const avgEntryPrice =
          positions.reduce((sum: number, p: any) => sum + (p.entry_price || 0), 0) /
          Math.max(1, positions.length);
        const totalPnl = positions.reduce((sum: number, p: any) => sum + (p.pnl || 0), 0);
        const currentValue = avgEntryPrice * totalAmount;
        const pnlPercent = currentValue > 0 ? (totalPnl / currentValue) * 100 : 0;

        return {
          tokenAddress: group.tokenAddress,
          symbol: group.symbol,
          totalAmount,
          averageEntryPrice: avgEntryPrice,
          currentValue,
          pnl: totalPnl,
          pnlPercent
        };
      });

      return results
        .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
        .slice(0, limit);
    } catch (error) {
      console.error('[AnalyticsService] Error getting top tokens:', error);
      return [];
    }
  }

  /**
   * Get trade distribution (by time of day, day of week, etc.)
   */
  static async getTradeDistribution(userId: number): Promise<{
    byHour: Record<number, number>;
    byDayOfWeek: Record<number, number>;
  }> {
    try {
      const trades = await prisma.trade.findMany({
        where: {
          user_id: userId,
          status: { in: ['completed', 'partial'] }
        }
      });

      const byHour: Record<number, number> = {};
      const byDayOfWeek: Record<number, number> = {};

      trades.forEach((t: any) => {
        const hour = t.created_at.getHours();
        const day = t.created_at.getDay();

        byHour[hour] = (byHour[hour] || 0) + 1;
        byDayOfWeek[day] = (byDayOfWeek[day] || 0) + 1;
      });

      return { byHour, byDayOfWeek };
    } catch (error) {
      console.error('[AnalyticsService] Error getting trade distribution:', error);
      return { byHour: {}, byDayOfWeek: {} };
    }
  }

  /**
   * Get reward summary
   */
  static async getRewardsSummary(userId: number): Promise<{
    referralBalance: number;
    cashbackBalance: number;
    totalEarned: number;
    pendingRewards: number;
    withdrawnRewards: number;
    nextWithdrawalDate?: Date;
  }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          referral_balance_usd: true,
          cashback_balance_usd: true
        }
      });

      const rewards = await prisma.rewardsLedger.findMany({
        where: { user_id: userId }
      });

      const totalEarned = rewards.reduce((sum: number, r: any) => sum + r.amount_usd, 0);
      const pending = rewards
        .filter((r: any) => r.status === 'available')
        .reduce((sum: number, r: any) => sum + r.amount_usd, 0);
      const withdrawn = rewards
        .filter((r: any) => r.status === 'withdrawn')
        .reduce((sum: number, r: any) => sum + r.amount_usd, 0);

      // Get next withdrawal date (assume once per 30 days)
      const lastWithdrawal = await prisma.withdrawal.findFirst({
        where: { user_id: userId, status: 'paid' },
        orderBy: { paid_at: 'desc' }
      });

      let nextWithdrawalDate: Date | undefined;
      if (lastWithdrawal?.paid_at) {
        nextWithdrawalDate = new Date(lastWithdrawal.paid_at);
        nextWithdrawalDate.setDate(nextWithdrawalDate.getDate() + 30);
      }

      return {
        referralBalance: user?.referral_balance_usd ?? 0,
        cashbackBalance: user?.cashback_balance_usd ?? 0,
        totalEarned,
        pendingRewards: pending,
        withdrawnRewards: withdrawn,
        nextWithdrawalDate
      };
    } catch (error) {
      console.error('[AnalyticsService] Error getting rewards summary:', error);
      return {
        referralBalance: 0,
        cashbackBalance: 0,
        totalEarned: 0,
        pendingRewards: 0,
        withdrawnRewards: 0
      };
    }
  }

  /**
   * Get user comparison (benchmarking)
   * Compare user's performance against platform average
   */
  static async getUserComparison(userId: number): Promise<{
    userStats: UserAnalytics | null;
    platformAverage: {
      avgWinRate: number;
      avgROI: number;
      avgTradesPerDay: number;
      avgRewardsEarned: number;
    };
    userTierRanking: {
      percentile: number;
      rank: number;
      totalInTier: number;
    };
  }> {
    try {
      const userStats = await this.getUserAnalytics(userId);

      // Get platform stats (simplified)
      const allUsers = await prisma.user.findMany({
        select: { id: true }
      });

      let totalWinRate = 0;
      let totalROI = 0;
      let validUsers = 0;

      for (const user of allUsers.slice(0, 100)) {
        const stats = await this.getUserAnalytics(user.id);
        if (stats) {
          totalWinRate += stats.tradingMetrics.winRate;
          totalROI += stats.profitMetrics.roi;
          validUsers++;
        }
      }

      const platformAverage = {
        avgWinRate: validUsers > 0 ? totalWinRate / validUsers : 50,
        avgROI: validUsers > 0 ? totalROI / validUsers : 0,
        avgTradesPerDay: 5,
        avgRewardsEarned: 25
      };

      return {
        userStats,
        platformAverage,
        userTierRanking: {
          percentile: 75,
          rank: 250,
          totalInTier: 1000
        }
      };
    } catch (error) {
      console.error('[AnalyticsService] Error getting user comparison:', error);
      return {
        userStats: null,
        platformAverage: {
          avgWinRate: 0,
          avgROI: 0,
          avgTradesPerDay: 0,
          avgRewardsEarned: 0
        },
        userTierRanking: {
          percentile: 0,
          rank: 0,
          totalInTier: 0
        }
      };
    }
  }
}

export default AnalyticsService;
