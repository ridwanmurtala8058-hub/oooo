/**
 * WithdrawalService - Phase 1.0 Commercial Features
 * Manages withdrawal requests, ledger updates, and on-chain payments
 */

import prisma from './prisma';
import RewardsService from './rewards.service';
import { SystemProgram, PublicKey, Keypair } from '@solana/web3.js';

export interface WithdrawalRequest {
  id: number;
  status: string;
  amount: number;
  type: string;
  requestedAt: Date;
  paidAt?: Date;
  transactionSignature?: string;
}

export class WithdrawalService {
  /**
   * Create a withdrawal request (pending)
   * Idempotent: won't create duplicate if one already pending
   */
  static async createWithdrawalRequest(
    userId: number,
    withdrawalType: string, // 'referral' | 'cashback'
    amount: number,
    destinationWallet: string
  ): Promise<{
    success: boolean;
    withdrawal?: WithdrawalRequest;
    error?: string;
  }> {
    try {
      // Validate params
      if (!['referral', 'cashback'].includes(withdrawalType)) {
        return { success: false, error: 'Invalid withdrawal type' };
      }

      if (amount <= 0) {
        return { success: false, error: 'Withdrawal amount must be > 0' };
      }

      // Validate destination wallet (basic Solana address format)
      if (!this.isValidSolanaAddress(destinationWallet)) {
        return { success: false, error: 'Invalid Solana address' };
      }

      // Get user and check balance
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          referral_balance_usd: true,
          cashback_balance_usd: true
        }
      });

      if (!user) {
        return { success: false, error: `User ${userId} not found` };
      }

      const availableBalance =
        withdrawalType === 'referral' ? user.referral_balance_usd : user.cashback_balance_usd;

      if (amount > availableBalance) {
        return {
          success: false,
          error: `Insufficient ${withdrawalType} balance. Available: $${availableBalance.toFixed(2)}`
        };
      }

      // Check for pending withdrawal (idempotent)
      const existingPending = await prisma.withdrawal.findFirst({
        where: {
          user_id: userId,
          withdrawal_type: withdrawalType,
          status: 'pending'
        }
      });

      if (existingPending) {
        console.log(`[WithdrawalService] User ${userId} already has pending ${withdrawalType} withdrawal`);
        return {
          success: true,
          withdrawal: {
            id: existingPending.id,
            status: existingPending.status,
            amount: existingPending.amount_usd,
            type: existingPending.withdrawal_type,
            requestedAt: existingPending.requested_at,
            paidAt: existingPending.paid_at || undefined,
            transactionSignature: existingPending.transaction_signature || undefined
          }
        };
      }

      // Create withdrawal request in transaction
      const withdrawal = await prisma.$transaction(async (tx: any) => {
        // 1. Create withdrawal record
        const wd = await tx.withdrawal.create({
          data: {
            user_id: userId,
            withdrawal_type: withdrawalType,
            amount_usd: amount,
            destination_wallet: destinationWallet,
            status: 'pending',
            payment_method: 'onchain'
          }
        });

        // 2. Mark related ledger entries as "withdrawn"
        await tx.rewardsLedger.updateMany({
          where: {
            user_id: userId,
            reward_type: withdrawalType,
            status: 'available'
          },
          data: {
            status: 'withdrawn',
            withdrawn_by_id: wd.id,
            withdrawn_at: new Date()
          }
        });

        // 3. Decrement user balance
        const updateData: any = {};
        if (withdrawalType === 'referral') {
          updateData.referral_balance_usd = { decrement: amount };
        } else {
          updateData.cashback_balance_usd = { decrement: amount };
        }

        await tx.user.update({
          where: { id: userId },
          data: updateData
        });

        return wd;
      });

      console.log(
        `[WithdrawalService] Created withdrawal request: ` +
        `User ${userId}, Type: ${withdrawalType}, Amount: $${amount.toFixed(2)}`
      );

      return {
        success: true,
        withdrawal: {
          id: withdrawal.id,
          status: withdrawal.status,
          amount: withdrawal.amount_usd,
          type: withdrawal.withdrawal_type,
          requestedAt: withdrawal.requested_at,
          paidAt: withdrawal.paid_at || undefined,
          transactionSignature: withdrawal.transaction_signature || undefined
        }
      };
    } catch (error) {
      console.error('[WithdrawalService] Error creating withdrawal:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Mark withdrawal as paid (after on-chain transfer confirmed)
   */
  static async markWithdrawalPaid(
    withdrawalId: number,
    transactionSignature: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const withdrawal = await prisma.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: 'paid',
          transaction_signature: transactionSignature,
          paid_at: new Date()
        }
      });

      console.log(
        `[WithdrawalService] Marked withdrawal ${withdrawalId} as paid. ` +
        `Tx: ${transactionSignature}`
      );

      return { success: true };
    } catch (error) {
      console.error(`[WithdrawalService] Error marking withdrawal ${withdrawalId} as paid:`, error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Mark withdrawal as failed
   */
  static async markWithdrawalFailed(
    withdrawalId: number,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const withdrawal = await prisma.withdrawal.findUnique({
        where: { id: withdrawalId },
        select: {
          user_id: true,
          withdrawal_type: true,
          amount_usd: true,
          status: true
        }
      });

      if (!withdrawal) {
        return { success: false, error: `Withdrawal ${withdrawalId} not found` };
      }

      // Revert the withdrawal in a transaction
      await prisma.$transaction(async (tx: any) => {
        // 1. Mark withdrawal as failed
        await tx.withdrawal.update({
          where: { id: withdrawalId },
          data: {
            status: 'failed',
            error_reason: reason
          }
        });

        // 2. Mark ledger entries back to "available"
        await tx.rewardsLedger.updateMany({
          where: {
            withdrawn_by_id: withdrawalId
          },
          data: {
            status: 'available',
            withdrawn_by_id: null,
            withdrawn_at: null
          }
        });

        // 3. Increment balance back
        const updateData: any = {};
        if (withdrawal.withdrawal_type === 'referral') {
          updateData.referral_balance_usd = { increment: withdrawal.amount_usd };
        } else {
          updateData.cashback_balance_usd = { increment: withdrawal.amount_usd };
        }

        await tx.user.update({
          where: { id: withdrawal.user_id },
          data: updateData
        });
      });

      console.log(
        `[WithdrawalService] Marked withdrawal ${withdrawalId} as failed. Reason: ${reason}`
      );

      return { success: true };
    } catch (error) {
      console.error(`[WithdrawalService] Error marking withdrawal as failed:`, error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get withdrawal history for a user
   */
  static async getWithdrawalHistory(
    userId: number,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ withdrawals: WithdrawalRequest[]; total: number }> {
    const [withdrawals, total] = await prisma.$transaction([
      prisma.withdrawal.findMany({
        where: { user_id: userId },
        orderBy: { requested_at: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.withdrawal.count({ where: { user_id: userId } })
    ]);

    return {
      withdrawals: withdrawals.map((w: any) => ({
        id: w.id,
        status: w.status,
        amount: w.amount_usd,
        type: w.withdrawal_type,
        requestedAt: w.requested_at,
        paidAt: w.paid_at || undefined,
        transactionSignature: w.transaction_signature || undefined
      })),
      total
    };
  }

  /**
   * Get pending withdrawals for processing (admin batch payout)
   */
  static async getPendingWithdrawals(limit: number = 100): Promise<WithdrawalRequest[]> {
    const withdrawals = await prisma.withdrawal.findMany({
      where: { status: 'pending' },
      orderBy: { requested_at: 'asc' },
      take: limit
    });

    return withdrawals.map((w: any) => ({
      id: w.id,
      status: w.status,
      amount: w.amount_usd,
      type: w.withdrawal_type,
      requestedAt: w.requested_at,
      paidAt: w.paid_at || undefined,
      transactionSignature: w.transaction_signature || undefined
    }));
  }

  /**
   * Validate Solana address format
   */
  static isValidSolanaAddress(address: string): boolean {
    try {
      const pubkey = new PublicKey(address);
      return PublicKey.isOnCurve(pubkey.toBuffer());
    } catch {
      return false;
    }
  }

  /**
   * Send on-chain withdrawal payment
   * Requires user's encrypted keypair and destination wallet
   */
  static async sendOnchainWithdrawal(
    withdrawalId: number,
    userId: number,
    amountSOL: number
  ): Promise<{ success: boolean; signature?: string; error?: string }> {
    try {
      // This is a placeholder - actual implementation depends on your infrastructure
      // (connection setup, wallet signing, bundle submission, etc.)
      
      // In a real implementation:
      // 1. Get user's keypair from UserEncryptionService.getKeypairForSigning()
      // 2. Get withdrawal destination address
      // 3. Create SystemProgram.transfer instruction
      // 4. Sign and submit transaction
      // 5. Wait for confirmation
      // 6. Call markWithdrawalPaid with signature
      // 7. If failed, call markWithdrawalFailed with reason

      console.log(
        `[WithdrawalService] Placeholder: Would send $${amountSOL.toFixed(2)} SOL ` +
        `for withdrawal ${withdrawalId}`
      );

      // For now, just mark as pending
      return {
        success: false,
        error: 'On-chain withdrawal not yet implemented. Use manual admin payout.'
      };
    } catch (error) {
      console.error('[WithdrawalService] Error sending on-chain withdrawal:', error);
      return { success: false, error: String(error) };
    }
  }
}

export default WithdrawalService;
