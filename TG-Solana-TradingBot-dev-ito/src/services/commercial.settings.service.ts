/**
 * CommercialSettingsService - Phase 1.0 Commercial Features
 * Manages user subscription tiers, feature access, and pricing
 */

import prisma from './prisma';

export interface SubscriptionTier {
  name: string;
  displayName: string;
  monthlyPriceUSD: number;
  description: string;
  features: string[];
  tradeLimitPerMonth?: number;
  maxOpenPositions?: number;
  prioritySupport: boolean;
  analyticsAccess: boolean;
  apiAccess: boolean;
  customAlerts: number; // number of custom alerts allowed
}

export interface UserSubscription {
  userId: number;
  currentTier: string;
  subscribedAt: Date;
  nextBillingDate?: Date;
  autoRenew: boolean;
  paymentMethod?: string;
}

export class CommercialSettingsService {
  // Tier definitions
  static readonly TIERS: { [key: string]: SubscriptionTier } = {
    free: {
      name: 'free',
      displayName: 'Free',
      monthlyPriceUSD: 0,
      description: 'Basic trading with essential features',
      features: [
        'Basic price alerts',
        'Manual trade execution',
        'Limited historical data'
      ],
      tradeLimitPerMonth: 100,
      maxOpenPositions: 5,
      prioritySupport: false,
      analyticsAccess: false,
      apiAccess: false,
      customAlerts: 3
    },
    premium: {
      name: 'premium',
      displayName: 'Premium',
      monthlyPriceUSD: 9.99,
      description: 'Enhanced trading with advanced features',
      features: [
        'All Free features',
        'Advanced alerts',
        'Referral rewards (5%)',
        'Portfolio analytics',
        'Price charts and indicators',
        'Email support'
      ],
      tradeLimitPerMonth: 500,
      maxOpenPositions: 20,
      prioritySupport: false,
      analyticsAccess: true,
      apiAccess: false,
      customAlerts: 25
    },
    elite: {
      name: 'elite',
      displayName: 'Elite',
      monthlyPriceUSD: 29.99,
      description: 'Professional trading suite with premium support',
      features: [
        'All Premium features',
        'Advanced referral rewards (7%)',
        'Real-time analytics dashboard',
        'API access (rate limited)',
        'Webhook integrations',
        'Priority email/Discord support',
        'Advanced risk management tools',
        'Custom strategies'
      ],
      tradeLimitPerMonth: 2000,
      maxOpenPositions: 50,
      prioritySupport: true,
      analyticsAccess: true,
      apiAccess: true,
      customAlerts: 100
    },
    vip: {
      name: 'vip',
      displayName: 'VIP',
      monthlyPriceUSD: 99.99,
      description: 'Enterprise-grade solutions with dedicated support',
      features: [
        'All Elite features',
        'Maximum referral rewards (10%)',
        'Unlimited analytics',
        'Unlimited API access',
        'Dedicated account manager',
        '24/7 priority support',
        'Custom algorithm execution',
        'Advanced backtesting tools',
        'White-glove onboarding'
      ],
      tradeLimitPerMonth: undefined, // unlimited
      maxOpenPositions: undefined, // unlimited
      prioritySupport: true,
      analyticsAccess: true,
      apiAccess: true,
      customAlerts: 999 // unlimited
    }
  };

  /**
   * Get tier details
   */
  static getTierDetails(tierName: string): SubscriptionTier | null {
    return this.TIERS[tierName] || null;
  }

  /**
   * Get user's current tier
   */
  static async getUserTier(userId: number): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tier: true }
    });

    return user?.tier ?? 'free';
  }

  /**
   * Get user's subscription details
   */
  static async getUserSubscription(userId: number): Promise<UserSubscription | null> {
    const subscription = await prisma.subscription.findUnique({
      where: { user_id: userId }
    });

    if (!subscription) {
      return null;
    }

    return {
      userId: subscription.user_id,
      currentTier: subscription.current_tier,
      subscribedAt: subscription.subscribed_at,
      nextBillingDate: subscription.next_billing_date ?? undefined,
      autoRenew: subscription.auto_renew,
      paymentMethod: subscription.payment_method ?? undefined
    };
  }

  /**
   * Check if user has feature access
   */
  static async hasFeatureAccess(userId: number, featureName: string): Promise<boolean> {
    const tier = await this.getUserTier(userId);
    const tierDetails = this.getTierDetails(tier);

    if (!tierDetails) {
      return false;
    }

    const featureMap: { [key: string]: keyof SubscriptionTier } = {
      'price-alerts': 'customAlerts',
      'portfolio-analytics': 'analyticsAccess',
      'api-access': 'apiAccess',
      'priority-support': 'prioritySupport',
      'referral-program': 'features', // all tiers except free
      'advanced-charts': 'analyticsAccess'
    };

    const mappedFeature = featureMap[featureName];
    if (!mappedFeature) {
      console.warn(`[CommercialSettingsService] Unknown feature: ${featureName}`);
      return false;
    }

    if (mappedFeature === 'features') {
      // Special case: referral program
      return tier !== 'free';
    }

    return (tierDetails[mappedFeature] as any) === true || (tierDetails[mappedFeature] as any) > 0;
  }

  /**
   * Check trade limit
   */
  static async checkTradeLimit(userId: number, month: Date = new Date()): Promise<{
    allowed: boolean;
    used: number;
    limit?: number;
  }> {
    const tier = await this.getUserTier(userId);
    const tierDetails = this.getTierDetails(tier);

    if (!tierDetails?.tradeLimitPerMonth) {
      return { allowed: true, used: 0 }; // unlimited
    }

    // Count trades in current month
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    const tradeCount = await prisma.trade.count({
      where: {
        user_id: userId,
        created_at: {
          gte: monthStart,
          lte: monthEnd
        },
        status: { in: ['completed', 'partial'] }
      }
    });

    const limit = tierDetails.tradeLimitPerMonth;
    return {
      allowed: tradeCount < limit,
      used: tradeCount,
      limit
    };
  }

  /**
   * Upgrade user subscription
   */
  static async upgradeSubscription(
    userId: number,
    newTier: string,
    paymentMethod?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.TIERS[newTier]) {
        return { success: false, error: `Invalid tier: ${newTier}` };
      }

      const now = new Date();
      const nextBilling = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

      await prisma.$transaction(async (tx: any) => {
        // Update user tier
        await tx.user.update({
          where: { id: userId },
          data: { tier: newTier }
        });

        // Create/update subscription
        const existingSub = await tx.subscription.findUnique({
          where: { user_id: userId }
        });

        if (existingSub) {
          await tx.subscription.update({
            where: { user_id: userId },
            data: {
              current_tier: newTier,
              subscribed_at: now,
              next_billing_date: nextBilling,
              auto_renew: true,
              payment_method: paymentMethod || existingSub.payment_method
            }
          });
        } else {
          await tx.subscription.create({
            data: {
              user_id: userId,
              current_tier: newTier,
              subscribed_at: now,
              next_billing_date: nextBilling,
              auto_renew: true,
              payment_method: paymentMethod || 'card'
            }
          });
        }
      });

      console.log(`[CommercialSettingsService] User ${userId} upgraded to ${newTier}`);
      return { success: true };
    } catch (error) {
      console.error('[CommercialSettingsService] Error upgrading subscription:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Downgrade user subscription
   */
  static async downgradeSubscription(
    userId: number,
    newTier: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.TIERS[newTier]) {
        return { success: false, error: `Invalid tier: ${newTier}` };
      }

      const tier = await this.getUserTier(userId);
      if (!this.isTierDowngrade(tier, newTier)) {
        return { success: false, error: `Cannot downgrade from ${tier} to ${newTier}` };
      }

      // Same as upgrade, but with different messaging
      return await this.upgradeSubscription(userId, newTier);
    } catch (error) {
      console.error('[CommercialSettingsService] Error downgrading subscription:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(
    userId: number,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await prisma.$transaction(async (tx: any) => {
        // Downgrade to free tier
        await tx.user.update({
          where: { id: userId },
          data: { tier: 'free' }
        });

        // Update subscription status
        await tx.subscription.update({
          where: { user_id: userId },
          data: {
            current_tier: 'free',
            auto_renew: false,
            cancelled_at: new Date(),
            cancellation_reason: reason
          }
        });
      });

      console.log(`[CommercialSettingsService] User ${userId} cancelled subscription. Reason: ${reason || 'N/A'}`);
      return { success: true };
    } catch (error) {
      console.error('[CommercialSettingsService] Error cancelling subscription:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Helper: Check if tier1 -> tier2 is a valid downgrade
   */
  private static isTierDowngrade(tier1: string, tier2: string): boolean {
    const hierarchy = ['vip', 'elite', 'premium', 'free'];
    const idx1 = hierarchy.indexOf(tier1);
    const idx2 = hierarchy.indexOf(tier2);

    return idx1 < idx2 || tier1 === tier2; // allow same tier
  }

  /**
   * Get referral rewards rate for tier
   */
  static getReferralRewardsRate(tier: string): number {
    const rates: { [key: string]: number } = {
      free: 0,        // no referral rewards
      premium: 5,     // 5%
      elite: 7,       // 7%
      vip: 10         // 10%
    };

    return rates[tier] ?? 0;
  }

  /**
   * Get all active subscriptions
   */
  static async getActiveSubscriptions(
    limit: number = 100,
    offset: number = 0
  ): Promise<{ subscriptions: UserSubscription[]; total: number }> {
    const [subscriptions, total] = await prisma.$transaction([
      prisma.subscription.findMany({
        where: {
          auto_renew: true,
          cancelled_at: null
        },
        orderBy: { subscribed_at: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.subscription.count({
        where: {
          auto_renew: true,
          cancelled_at: null
        }
      })
    ]);

    return {
      subscriptions: subscriptions.map((s: any) => ({
        userId: s.user_id,
        currentTier: s.current_tier,
        subscribedAt: s.subscribed_at,
        nextBillingDate: s.next_billing_date,
        autoRenew: s.auto_renew,
        paymentMethod: s.payment_method
      })),
      total
    };
  }
}

export default CommercialSettingsService;
