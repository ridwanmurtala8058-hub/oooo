/**
 * ReferralService - Phase 1.0 Commercial Features
 * Manages referral codes, referred users, and referral relationships
 */

import prisma from './prisma';
import crypto from 'crypto';

export class ReferralService {
  /**
   * Generate a unique, URL-safe referral code
   * Format: 6-8 alphanumeric characters
   */
  static generateReferralCode(length: number = 8): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
  }

  /**
   * Find or create referral code for a user
   * Ensures each user has exactly one referral code
   */
  static async ensureReferralCode(userId: number, username: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referral_code: true }
    });

    if (user?.referral_code) {
      return user.referral_code;
    }

    // Generate unique code
    let referralCode: string = '';
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      referralCode = this.generateReferralCode();
      const existing = await prisma.user.findFirst({
        where: { referral_code: referralCode }
      });
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique || !referralCode) {
      throw new Error('Failed to generate unique referral code after 10 attempts');
    }

    // Update user with new code
    await prisma.user.update({
      where: { id: userId },
      data: { referral_code: referralCode }
    });

    return referralCode;
  }

  /**
   * Bind a new user to a referrer using referral code
   * IDEMPOTENT: Only succeeds if user.referred_by_user_id is NULL
   * Called from /start handler with referral code parameter
   */
  static async bindReferral(userId: number, referralCode: string): Promise<boolean> {
    // Find the user making the request
    const newUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        referred_by_user_id: true,
        createdAt: true
      }
    });

    if (!newUser) {
      throw new Error(`User ${userId} not found`);
    }

    // Already has a referrer - don't override (idempotent)
    if (newUser.referred_by_user_id) {
      console.log(`User ${userId} already referred by ${newUser.referred_by_user_id}. Skipping.`);
      return false;
    }

    // Find referrer by code
    const referrer = await prisma.user.findFirst({
      where: { referral_code: referralCode },
      select: { id: true, username: true }
    });

    if (!referrer) {
      console.warn(`Invalid referral code: ${referralCode}`);
      return false;
    }

    // Self-referral check
    if (referrer.id === userId) {
      console.warn(`User ${userId} attempted self-referral`);
      return false;
    }

    // Anti-sybil: User must be > 5 minutes old (prevents immediate bulk signup)
    const timeSinceCreation = Date.now() - newUser.createdAt.getTime();
    if (timeSinceCreation < 5 * 60 * 1000) {
      console.warn(`User ${userId} too new for referral (${(timeSinceCreation / 1000).toFixed(0)}s)`);
      return false;
    }

    // Bind referral in transaction
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { referred_by_user_id: referrer.id }
      });

      console.log(`✅ User ${userId} referred by ${referrer.username} (${referralCode})`);
      return true;
    } catch (error) {
      console.error('Failed to bind referral:', error);
      return false;
    }
  }

  /**
   * Get referral stats for a user
   */
  static async getReferralStats(userId: number): Promise<{
    referralCode: string | null;
    referralLink: string;
    referredCount: number;
    referralEarnings: number;
    pendingReferralRewards: number;
    withdrawnReferralRewards: number;
    referrer: { id: number; username: string } | null;
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        referral_code: true,
        referred_by_user_id: true,
        referral_balance_usd: true,
        id: true
      }
    });

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Count referred users
    const referredUsers = await prisma.user.count({
      where: { referred_by_user_id: userId }
    });

    // Get referrer info
    let referrer = null;
    if (user.referred_by_user_id) {
      const ref = await prisma.user.findUnique({
        where: { id: user.referred_by_user_id },
        select: { id: true, username: true }
      });
      referrer = ref;
    }

    // Fetch reward ledger stats
    const pendingRewards = await prisma.rewardsLedger.aggregate({
      where: {
        user_id: userId,
        reward_type: 'referral',
        status: 'available'
      },
      _sum: { amount_usd: true }
    });

    const withdrawnRewards = await prisma.rewardsLedger.aggregate({
      where: {
        user_id: userId,
        reward_type: 'referral',
        status: 'withdrawn'
      },
      _sum: { amount_usd: true }
    });

    // Deep link format for Telegram
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'CoinHunter_Bot';
    const referralLink = user.referral_code
      ? `https://t.me/${botUsername}?start=${user.referral_code}`
      : 'Not available';

    return {
      referralCode: user.referral_code,
      referralLink,
      referredCount: referredUsers,
      referralEarnings: user.referral_balance_usd,
      pendingReferralRewards: pendingRewards._sum.amount_usd ?? 0,
      withdrawnReferralRewards: withdrawnRewards._sum.amount_usd ?? 0,
      referrer
    };
  }

  /**
   * Get all users referred by this user
   */
  static async getReferredUsers(userId: number, limit: number = 20): Promise<Array<{
    id: number;
    username: string;
    referralDate: Date;
    totalTradeVolume: number;
  }>> {
    const referrals = await prisma.user.findMany({
      where: { referred_by_user_id: userId },
      select: {
        id: true,
        username: true,
        createdAt: true,
        trades: {
          select: { volume_usd: true }
        }
      },
      take: limit
    });

    return referrals.map(user => ({
      id: user.id,
      username: user.username,
      referralDate: user.createdAt,
      totalTradeVolume: (user.trades || []).reduce((sum, trade) => sum + (trade.volume_usd || 0), 0)
    }));
  }

  /**
   * Extract referral code from Telegram /start command
   * Format: /start REFCODE
   */
  static extractReferralCode(startText: string | undefined): string | null {
    if (!startText) return null;

    // Remove /start and any extra whitespace
    const parts = startText.trim().split(/\s+/);
    if (parts.length >= 2 && parts[0] === '/start') {
      return parts[1];
    }
    return null;
  }
}

export default ReferralService;
