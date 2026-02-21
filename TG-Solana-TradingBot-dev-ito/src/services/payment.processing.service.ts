/**
 * PaymentProcessingService - Phase 1.0 Commercial Features
 * Manages subscription payments, invoicing, and payment processing
 */

import prisma from './prisma';
import CommercialSettingsService from './commercial.settings.service';

export interface Payment {
  id: number;
  userId: number;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  tier: string;
  invoiceId?: string;
  transactionId?: string;
  processedAt?: Date;
  refundedAt?: Date;
}

export interface Invoice {
  id: string;
  userId: number;
  amount: number;
  currency: string;
  tier: string;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  issuedAt: Date;
  dueDate: Date;
  paidAt?: Date;
}

export class PaymentProcessingService {
  static readonly STRIPE_API_VERSION = '2024-01-01';
  static readonly CURRENCY = 'usd';
  static readonly BILLING_CYCLE_DAYS = 30;

  /**
   * Process subscription payment (monthly billing)
   * Called by cron job at billing date
   */
  static async processMonthlyBilling(): Promise<{
    success: boolean;
    processed: number;
    failed: number;
    error?: string;
  }> {
    try {
      console.log('[PaymentProcessingService] Starting monthly billing cycle...');

      // Get all active subscriptions due for billing
      const subscriptions = await prisma.subscription.findMany({
        where: {
          auto_renew: true,
          cancelled_at: null,
          next_billing_date: {
            lte: new Date()
          }
        },
        include: {
            user: {
              select: {
                id: true,
                tier: true
              }
            }
          }
      });

      let processed = 0;
      let failed = 0;

      for (const subscription of subscriptions) {
        try {
          const tierDetails = CommercialSettingsService.getTierDetails(subscription.current_tier);
          if (!tierDetails || tierDetails.monthlyPriceUSD === 0) {
            continue; // Skip free tier
          }

          // Process payment
          const result = await this.processPayment(
            subscription.user_id,
            tierDetails.monthlyPriceUSD,
            subscription.current_tier
          );

          if (result.success) {
            // Generate invoice
            const invoiceResult = await this.generateInvoice(
              subscription.user_id,
              tierDetails.monthlyPriceUSD,
              subscription.current_tier
            );

            // Schedule next billing
            const nextBilling = new Date();
            nextBilling.setDate(nextBilling.getDate() + this.BILLING_CYCLE_DAYS);

            await prisma.subscription.update({
              where: { user_id: subscription.user_id },
              data: {
                next_billing_date: nextBilling,
                last_billing_date: new Date()
              }
            });

            processed++;
            console.log(`[PaymentProcessingService] Processed payment for user ${subscription.user_id}`);
          } else {
            failed++;
            console.error(
              `[PaymentProcessingService] Payment failed for user ${subscription.user_id}: ${result.error}`
            );
          }
        } catch (error) {
          failed++;
          console.error(
            `[PaymentProcessingService] Error processing billing for user ${subscription.user_id}:`,
            error
          );
        }
      }

      console.log(
        `[PaymentProcessingService] Billing cycle complete. Processed: ${processed}, Failed: ${failed}`
      );
      return { success: true, processed, failed };
    } catch (error) {
      console.error('[PaymentProcessingService] Error processing monthly billing:', error);
      return { success: false, processed: 0, failed: 0, error: String(error) };
    }
  }

  /**
   * Process a single payment
   * In reality, this would call Stripe/PayPal/etc
   */
  static async processPayment(
    userId: number,
    amount: number,
    tier: string
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    try {
      if (amount <= 0) {
        return { success: true }; // Free tier
      }

      // Create payment record (pending)
      const payment = await prisma.payment.create({
        data: {
          user_id: userId,
          amount,
          currency: this.CURRENCY,
          tier,
          status: 'pending'
        }
      });

      // In a real implementation:
      // 1. Call Stripe API (create charge)
      // 2. Handle webhook response
      // 3. Update payment status
      // For now, simulate success
      const transactionId = `txn_${payment.id}_${Date.now()}`;

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'completed',
          transaction_id: transactionId,
          processed_at: new Date()
        }
      });

      console.log(
        `[PaymentProcessingService] Payment processed: User ${userId}, ` +
        `Amount: $${amount.toFixed(2)}, Tier: ${tier}, TxnId: ${transactionId}`
      );

      return { success: true, transactionId };
    } catch (error) {
      console.error('[PaymentProcessingService] Error processing payment:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Handle payment failure (retry logic)
   */
  static async handlePaymentFailure(
    userId: number,
    error: string
  ): Promise<{ success: boolean; retriesRemaining?: number }> {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { user_id: userId },
        select: { payment_retry_count: true }
      });

      if (!subscription) {
        return { success: false };
      }

      const retriesRemaining = 2 - (subscription.payment_retry_count || 0);

      if (retriesRemaining > 0) {
        // Schedule retry in 3 days
        const retryDate = new Date();
        retryDate.setDate(retryDate.getDate() + 3);

        await prisma.subscription.update({
          where: { user_id: userId },
          data: {
            next_billing_date: retryDate,
            payment_retry_count: (subscription.payment_retry_count || 0) + 1
          }
        });

        console.log(
          `[PaymentProcessingService] Scheduled payment retry for user ${userId}. ` +
          `Retries remaining: ${retriesRemaining - 1}`
        );

        return { success: true, retriesRemaining: retriesRemaining - 1 };
      } else {
        // No retries left, downgrade to free
        await CommercialSettingsService.downgradeSubscription(userId, 'free');

        console.log(
          `[PaymentProcessingService] Downgraded user ${userId} to free after payment failures`
        );

        return { success: true, retriesRemaining: 0 };
      }
    } catch (error) {
      console.error('[PaymentProcessingService] Error handling payment failure:', error);
      return { success: false };
    }
  }

  /**
   * Generate invoice for payment
   */
  static async generateInvoice(
    userId: number,
    amount: number,
    tier: string
  ): Promise<{ success: boolean; invoiceId?: string; error?: string }> {
    try {
      const now = new Date();
      const billingStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const billingEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + 14);

      const invoiceId = `inv_${userId}_${Date.now()}`;

      const invoice = await prisma.invoice.create({
        data: {
          user_id: userId,
          invoice_id: invoiceId,
          amount,
          currency: this.CURRENCY,
          tier,
          billing_period_start: billingStart,
          billing_period_end: billingEnd,
          status: 'sent',
          issued_at: now,
          due_date: dueDate
        }
      });

      console.log(
        `[PaymentProcessingService] Generated invoice: ${invoiceId} for user ${userId}, ` +
        `Amount: $${amount.toFixed(2)}`
      );

      return { success: true, invoiceId };
    } catch (error) {
      console.error('[PaymentProcessingService] Error generating invoice:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get user's payment history
   */
  static async getPaymentHistory(
    userId: number,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ payments: Payment[]; total: number }> {
    const [payments, total] = await prisma.$transaction([
      prisma.payment.findMany({
        where: { user_id: userId },
        orderBy: { processed_at: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.payment.count({ where: { user_id: userId } })
    ]);

    return {
      payments: payments.map((p: any) => ({
        id: p.id,
        userId: p.user_id,
        amount: p.amount,
        currency: p.currency,
        status: p.status as any,
        tier: p.tier,
        invoiceId: p.invoice_id || undefined,
        transactionId: p.transaction_id || undefined,
        processedAt: p.processed_at || undefined,
        refundedAt: p.refunded_at || undefined
      })),
      total
    };
  }

  /**
   * Get invoice
   */
  static async getInvoice(invoiceId: string): Promise<Invoice | null> {
    const invoice = await prisma.invoice.findFirst({
      where: { invoice_id: invoiceId }
    });

    if (!invoice) {
      return null;
    }

    return {
      id: invoice.invoice_id,
      userId: invoice.user_id,
      amount: invoice.amount,
      currency: invoice.currency,
      tier: invoice.tier,
      billingPeriodStart: invoice.billing_period_start,
      billingPeriodEnd: invoice.billing_period_end,
      status: invoice.status as any,
      issuedAt: invoice.issued_at,
      dueDate: invoice.due_date,
      paidAt: invoice.paid_at || undefined
    };
  }

  /**
   * Get invoices for user
   */
  static async getUserInvoices(
    userId: number,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ invoices: Invoice[]; total: number }> {
    const [invoices, total] = await prisma.$transaction([
      prisma.invoice.findMany({
        where: { user_id: userId },
        orderBy: { issued_at: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.invoice.count({ where: { user_id: userId } })
    ]);

    return {
      invoices: invoices.map((i: any) => ({
        id: i.invoice_id,
        userId: i.user_id,
        amount: i.amount,
        currency: i.currency,
        tier: i.tier,
        billingPeriodStart: i.billing_period_start,
        billingPeriodEnd: i.billing_period_end,
        status: i.status as any,
        issuedAt: i.issued_at,
        dueDate: i.due_date,
        paidAt: i.paid_at || undefined
      })),
      total
    };
  }

  /**
   * Process refund
   */
  static async processRefund(
    paymentId: number,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId }
      });

      if (!payment) {
        return { success: false, error: 'Payment not found' };
      }

      if (payment.status !== 'completed') {
        return { success: false, error: 'Only completed payments can be refunded' };
      }

      // In real implementation, call payment processor
      // For now, just update status
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'refunded',
          refunded_at: new Date(),
          refund_reason: reason
        }
      });

      console.log(
        `[PaymentProcessingService] Refunded payment ${paymentId}. Reason: ${reason}`
      );

      return { success: true };
    } catch (error) {
      console.error('[PaymentProcessingService] Error processing refund:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Handle Stripe webhook (payment.intent.succeeded)
   */
  static async handleStripewebhook(event: any): Promise<{ success: boolean; error?: string }> {
    try {
      const { type, data } = event;

      switch (type) {
        case 'payment_intent.succeeded':
          // Update payment status
          const paymentIntent = data.object;
          // Find and update related payment record
          console.log(`[PaymentProcessingService] Stripe webhook: payment_intent.succeeded`);
          break;

        case 'customer.subscription.updated':
          // Handle subscription changes
          console.log(`[PaymentProcessingService] Stripe webhook: customer.subscription.updated`);
          break;

        case 'invoice.payment_failed':
          // Handle payment failure
          console.log(`[PaymentProcessingService] Stripe webhook: invoice.payment_failed`);
          break;

        default:
          console.log(`[PaymentProcessingService] Unhandled Stripe webhook: ${type}`);
      }

      return { success: true };
    } catch (error) {
      console.error('[PaymentProcessingService] Error handling Stripe webhook:', error);
      return { success: false, error: String(error) };
    }
  }
}

export default PaymentProcessingService;
