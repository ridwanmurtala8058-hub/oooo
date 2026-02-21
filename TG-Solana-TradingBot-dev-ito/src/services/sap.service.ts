/**
 * Security Access PIN (SAP) Service - Phase 0.3
 * Manages PIN setup, verification, and timeout for sensitive operations
 */

import { EncryptionService } from './encryption.service';
import { SAP_TIMEOUT_MINUTES } from '../config';
import redisClient from './redis';

export interface SAPVerificationResult {
  success: boolean;
  message: string;
  remainingTime?: number;
}

export class SAPService {
  /**
   * Setup SAP for a user (first time setup)
   * Returns PIN hash and salt to store in database
   */
  static setupSAP(pin: string): { hash: string; salt: string } {
    if (!pin || pin.length < 4) {
      throw new Error('PIN must be at least 4 digits');
    }

    if (!/^\d{4,}$/.test(pin)) {
      throw new Error('PIN must contain only digits');
    }

    return EncryptionService.hashPIN(pin);
  }

  /**
   * Create SAP session in Redis
   */
  static async verifyAndCreateSession(
    userId: number | string,
    pin: string,
    storedHash: string,
    salt: string
  ): Promise<SAPVerificationResult> {
    try {
      // Verify PIN
      const isValid = EncryptionService.verifyPIN(pin, storedHash, salt);

      if (!isValid) {
        return {
          success: false,
          message: '❌ Invalid PIN',
        };
      }

      // Create SAP session in Redis
      const sessionId = `sap_session_${userId}_${Date.now()}`;
      const sessionKey = `sap:${userId}`;

      // Store session (expires after SAP_TIMEOUT_MINUTES)
      await redisClient.setEx(
        sessionKey,
        SAP_TIMEOUT_MINUTES * 60,
        JSON.stringify({
          sessionId,
          verifiedAt: Date.now(),
          expiresAt: Date.now() + SAP_TIMEOUT_MINUTES * 60 * 1000,
        })
      );

      return {
        success: true,
        message: `✅ SAP verified for ${SAP_TIMEOUT_MINUTES} minutes`,
      };
    } catch (error) {
      return {
        success: false,
        message: `❌ SAP verification error: ${error}`,
      };
    }
  }

  /**
   * Check if user has valid SAP session
   */
  static async isVerified(userId: number | string): Promise<boolean> {
    try {
      const sessionKey = `sap:${userId}`;
      const session = await redisClient.get(sessionKey);

      if (!session) return false;

      const data = JSON.parse(session);
      return Date.now() < data.expiresAt;
    } catch (error) {
      console.error('SAP verification error:', error);
      return false;
    }
  }

  /**
   * Get remaining time for current SAP session (in seconds)
   */
  static async getSessionTimeRemaining(userId: number | string): Promise<number> {
    try {
      const sessionKey = `sap:${userId}`;
      const ttl = await redisClient.ttl(sessionKey);
      return Math.max(ttl, 0);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Invalidate SAP session (logout)
   */
  static async invalidateSession(userId: number | string): Promise<void> {
    try {
      const sessionKey = `sap:${userId}`;
      await redisClient.del(sessionKey);
    } catch (error) {
      console.error('Failed to invalidate SAP session:', error);
    }
  }

  /**
   * Check if SAP is needed for operation
   */
  static isSAPRequired(
    operation: 'withdraw' | 'export' | 'delete_wallet' | 'disable_protection',
    config?: {
      requireForWithdraw?: boolean;
      requireForExport?: boolean;
      requireForDelete?: boolean;
    }
  ): boolean {
    const defaults = {
      requireForWithdraw: true,
      requireForExport: true,
      requireForDelete: true,
    };

    const settings = { ...defaults, ...config };

    switch (operation) {
      case 'withdraw':
        return settings.requireForWithdraw;
      case 'export':
        return settings.requireForExport;
      case 'delete_wallet':
        return settings.requireForDelete;
      case 'disable_protection':
        return settings.requireForWithdraw; // Same level as withdraw
      default:
        return false;
    }
  }

  /**
   * Generate SAP prompt message for Telegram
   */
  static getSAPPromptMessage(operation: string, timeoutMinutes: number = SAP_TIMEOUT_MINUTES): string {
    return (
      `🔐 <b>Security Access PIN Required</b>\n\n` +
      `This operation requires your Security PIN:\n` +
      `<b>${operation}</b>\n\n` +
      `⏱️ Valid for ${timeoutMinutes} minutes\n\n` +
      `<i>Please enter your 4-digit PIN</i>`
    );
  }
}

export default SAPService;
