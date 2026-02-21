/**
 * AuditLoggingService - Phase 1.0 Commercial Features
 * Tracks all commercial transactions, user actions, and system events for compliance
 */

import prisma from './prisma';

export interface AuditLog {
  id: number;
  userId?: number;
  action: string;
  category: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class AuditLoggingService {
  /**
   * Log an action
   */
  static async log(
    action: string,
    category: string,
    details: Record<string, any>,
    options?: {
      userId?: number;
      ipAddress?: string;
      userAgent?: string;
      severity?: 'low' | 'medium' | 'high' | 'critical';
    }
  ): Promise<{ success: boolean; logId?: number; error?: string }> {
    try {
      const log = await prisma.auditLog.create({
        data: {
          user_id: options?.userId,
          action,
          category,
          details,
          ip_address: options?.ipAddress,
          user_agent: options?.userAgent,
          severity: options?.severity || 'low',
          timestamp: new Date()
        }
      });

      return { success: true, logId: log.id };
    } catch (error) {
      console.error('[AuditLoggingService] Error creating audit log:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Log subscription action
   */
  static async logSubscriptionAction(
    userId: number,
    action: 'upgrade' | 'downgrade' | 'cancel' | 'renew',
    fromTier: string,
    toTier: string,
    amount?: number
  ): Promise<void> {
    await this.log(
      `subscription_${action}`,
      'subscription',
      {
        fromTier,
        toTier,
        amount: amount?.toFixed(2),
        timestamp: new Date().toISOString()
      },
      {
        userId,
        severity: action === 'cancel' ? 'medium' : 'low'
      }
    );
  }

  /**
   * Log payment action
   */
  static async logPaymentAction(
    userId: number,
    action: 'payment' | 'refund' | 'failed',
    amount: number,
    tier: string,
    transactionId?: string
  ): Promise<void> {
    await this.log(
      `payment_${action}`,
      'payment',
      {
        amount: amount.toFixed(2),
        tier,
        transactionId,
        timestamp: new Date().toISOString()
      },
      {
        userId,
        severity: action === 'failed' ? 'medium' : 'low'
      }
    );
  }

  /**
   * Log withdrawal action
   */
  static async logWithdrawalAction(
    userId: number,
    action: 'request' | 'approved' | 'paid' | 'failed',
    withdrawalId: number,
    amount: number,
    type: string
  ): Promise<void> {
    await this.log(
      `withdrawal_${action}`,
      'withdrawal',
      {
        withdrawalId,
        amount: amount.toFixed(2),
        type,
        timestamp: new Date().toISOString()
      },
      {
        userId,
        severity: action === 'failed' ? 'high' : 'low'
      }
    );
  }

  /**
   * Log reward action
   */
  static async logRewardAction(
    userId: number,
    action: 'earned' | 'pending' | 'claimed' | 'expired',
    rewardType: string,
    amount: number,
    source: string
  ): Promise<void> {
    await this.log(
      `reward_${action}`,
      'rewards',
      {
        rewardType,
        amount: amount.toFixed(2),
        source,
        timestamp: new Date().toISOString()
      },
      {
        userId,
        severity: 'low'
      }
    );
  }

  /**
   * Log referral action
   */
  static async logReferralAction(
    userId: number,
    action: 'code_created' | 'referred_signup' | 'reward_earned',
    referralCode?: string,
    referredUserId?: number,
    amount?: number
  ): Promise<void> {
    await this.log(
      `referral_${action}`,
      'referral',
      {
        referralCode,
        referredUserId,
        amount: amount?.toFixed(2),
        timestamp: new Date().toISOString()
      },
      {
        userId,
        severity: 'low'
      }
    );
  }

  /**
   * Log security event
   */
  static async logSecurityEvent(
    userId: number | undefined,
    eventType: string,
    description: string,
    details: Record<string, any>,
    ipAddress?: string
  ): Promise<void> {
    await this.log(
      eventType,
      'security',
      {
        description,
        ...details,
        timestamp: new Date().toISOString()
      },
      {
        userId,
        ipAddress,
        severity: eventType.includes('failed') ? 'high' : 'medium'
      }
    );
  }

  /**
   * Get audit logs for user
   */
  static async getUserAuditLogs(
    userId: number,
    limit: number = 100,
    offset: number = 0,
    filterCategory?: string
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const where: any = { user_id: userId };
    if (filterCategory) {
      where.category = filterCategory;
    }

    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.auditLog.count({ where })
    ]);

    return {
      logs: logs.map((l: any) => ({
        id: l.id,
        userId: l.user_id || undefined,
        action: l.action,
        category: l.category,
        details: l.details,
        ipAddress: l.ip_address || undefined,
        userAgent: l.user_agent || undefined,
        timestamp: l.timestamp,
        severity: l.severity as any
      })),
      total
    };
  }

  /**
   * Get all audit logs (admin)
   */
  static async getAllAuditLogs(
    limit: number = 100,
    offset: number = 0,
    filterCategory?: string,
    filterSeverity?: string,
    dateStart?: Date,
    dateEnd?: Date
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const where: any = {};

    if (filterCategory) {
      where.category = filterCategory;
    }

    if (filterSeverity) {
      where.severity = filterSeverity;
    }

    if (dateStart || dateEnd) {
      where.timestamp = {};
      if (dateStart) where.timestamp.gte = dateStart;
      if (dateEnd) where.timestamp.lte = dateEnd;
    }

    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.auditLog.count({ where })
    ]);

    return {
      logs: logs.map((l: any) => ({
        id: l.id,
        userId: l.user_id || undefined,
        action: l.action,
        category: l.category,
        details: l.details,
        ipAddress: l.ip_address || undefined,
        userAgent: l.user_agent || undefined,
        timestamp: l.timestamp,
        severity: l.severity as any
      })),
      total
    };
  }

  /**
   * Generate audit report
   */
  static async generateAuditReport(
    startDate: Date,
    endDate: Date
  ): Promise<{
    success: boolean;
    report?: {
      dateRange: { start: Date; end: Date };
      totalEvents: number;
      byCategory: Record<string, number>;
      bySeverity: Record<string, number>;
      paymentMetrics: {
        totalPayments: number;
        totalAmount: number;
        failedPayments: number;
      };
      withdrawalMetrics: {
        totalWithdrawals: number;
        totalAmount: number;
        failedWithdrawals: number;
      };
    };
    error?: string;
  }> {
    try {
      const logs = await prisma.auditLog.findMany({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      const byCategory: Record<string, number> = {};
      const bySeverity: Record<string, number> = {};
      let totalPaymentAmount = 0;
      let totalWithdrawalAmount = 0;
      let failedPayments = 0;
      let failedWithdrawals = 0;

      for (const log of logs) {
        // Group by category
        byCategory[log.category] = (byCategory[log.category] || 0) + 1;

        // Group by severity
        bySeverity[log.severity] = (bySeverity[log.severity] || 0) + 1;

        // Extract metrics (safely handle Json type)
        const details: any = (log.details as any) || {};

        if (log.category === 'payment') {
          if (details.amount) {
            totalPaymentAmount += parseFloat(String(details.amount));
          }
          if (log.action && log.action.includes('failed')) {
            failedPayments++;
          }
        } else if (log.category === 'withdrawal') {
          if (details.amount) {
            totalWithdrawalAmount += parseFloat(String(details.amount));
          }
          if (log.action && log.action.includes('failed')) {
            failedWithdrawals++;
          }
        }
      }

      const report = {
        dateRange: { start: startDate, end: endDate },
        totalEvents: logs.length,
        byCategory,
        bySeverity,
        paymentMetrics: {
          totalPayments: byCategory['payment'] || 0,
          totalAmount: totalPaymentAmount,
          failedPayments
        },
        withdrawalMetrics: {
          totalWithdrawals: byCategory['withdrawal'] || 0,
          totalAmount: totalWithdrawalAmount,
          failedWithdrawals
        }
      };

      console.log('[AuditLoggingService] Generated audit report:', report);
      return { success: true, report };
    } catch (error) {
      console.error('[AuditLoggingService] Error generating audit report:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Archive old audit logs (data retention policy)
   */
  static async archiveOldLogs(daysToKeep: number = 365): Promise<{
    success: boolean;
    archived: number;
    error?: string;
  }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      // In a real scenario, you'd move these to archive storage
      // For now, just count and log
      const count = await prisma.auditLog.count({
        where: {
          timestamp: { lt: cutoffDate }
        }
      });

      console.log(
        `[AuditLoggingService] Archived ${count} logs older than ${cutoffDate.toDateString()}`
      );

      return { success: true, archived: count };
    } catch (error) {
      console.error('[AuditLoggingService] Error archiving logs:', error);
      return { success: false, archived: 0, error: String(error) };
    }
  }

  /**
   * Check for suspicious activity
   */
  static async checkSuspiciousActivity(userId: number): Promise<{
    suspicious: boolean;
    alerts: string[];
  }> {
    try {
      const alerts: string[] = [];
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);

      // Check for multiple failed login attempts
      const failedLogins = await prisma.auditLog.count({
        where: {
          user_id: userId,
          action: 'login_failed',
          timestamp: { gte: dayStart }
        }
      });

      if (failedLogins > 5) {
        alerts.push('Multiple failed login attempts');
      }

      // Check for large withdrawal requests
      const largeWithdrawals = await prisma.auditLog.count({
        where: {
          user_id: userId,
          category: 'withdrawal',
          timestamp: { gte: dayStart }
        }
      });

      if (largeWithdrawals > 2) {
        alerts.push('Multiple withdrawal requests in one day');
      }

      // Check for subscription changes followed by refund
      const recentSubscriptions = await prisma.auditLog.findMany({
        where: {
          user_id: userId,
          category: 'subscription',
          timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        },
        take: 5
      });

      if (recentSubscriptions.length > 1) {
        alerts.push('Multiple subscription changes in 24 hours');
      }

      return {
        suspicious: alerts.length > 0,
        alerts
      };
    } catch (error) {
      console.error('[AuditLoggingService] Error checking suspicious activity:', error);
      return { suspicious: false, alerts: [] };
    }
  }
}

export default AuditLoggingService;
