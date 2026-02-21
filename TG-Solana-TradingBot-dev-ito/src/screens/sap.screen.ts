/**
 * SAP (Security Access PIN) Screen Handler - Phase 0.3
 * Handles SAP setup, verification, and management via Telegram
 */

import TelegramBot from 'node-telegram-bot-api';
import { UserEncryptionService } from '../services/user.encryption.service';
import { SAPService } from '../services/sap.service';
import { REQUIRE_SAP_FOR_WITHDRAW, SAP_TIMEOUT_MINUTES } from '../config';
import redisClient from '../services/redis';

interface SAP_State {
  step: 'waiting_for_pin' | 'waiting_for_confirm' | 'waiting_for_operation_pin';
  operation?: 'setup' | 'verify' | 'change';
  newPin?: string;
  operationType?: string;
}

export class SAPHandler {
  private bot: TelegramBot;

  constructor(bot: TelegramBot) {
    this.bot = bot;
  }

  /**
   * Start SAP setup flow
   */
  async startSAPSetup(chatId: string, userId: number): Promise<void> {
    try {
      // Check if user already has SAP
      const hasSAP = await UserEncryptionService.hasSAPSetup(userId);

      if (hasSAP) {
        await this.bot.sendMessage(
          chatId,
          '🔐 <b>SAP Already Setup</b>\n\n' +
            'You already have a Security PIN enabled.\n\n' +
            'Options:\n' +
            '• /changepin - Change your PIN\n' +
            '• /disablesap - Disable SAP (not recommended)',
          { parse_mode: 'HTML' }
        );
        return;
      }

      // Start setup flow
      await this.setUserState(chatId, {
        step: 'waiting_for_pin',
        operation: 'setup',
      });

      await this.bot.sendMessage(
        chatId,
        '🔐 <b>Setup Security PIN</b>\n\n' +
          'Choose a 4-6 digit PIN to protect sensitive operations.\n\n' +
          '<b>⚠️ Important:</b>\n' +
          '• Use a PIN you remember (no recovery option)\n' +
          '• Required for: Withdraw, Export Keys, Delete Wallet\n' +
          '• Valid for 5 minutes per operation\n\n' +
          '<i>Send your PIN (4-6 digits only):</i>',
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      console.error('Error starting SAP setup:', error);
      await this.bot.sendMessage(chatId, '❌ Failed to start SAP setup. Try again.');
    }
  }

  /**
   * Handle PIN input during setup
   */
  async handlePINInput(chatId: string, userId: number, pin: string): Promise<void> {
    try {
      const state = await this.getUserState(chatId);

      if (!state) {
        return;
      }

      // Validate PIN format
      if (!/^\d{4,6}$/.test(pin)) {
        await this.bot.sendMessage(
          chatId,
          '❌ <b>Invalid PIN Format</b>\n\n' +
            'PIN must be 4-6 digits only.\n\n' +
            '<i>Try again:</i>',
          { parse_mode: 'HTML' }
        );
        return;
      }

      // Handle setup flow
      if (state.operation === 'setup') {
        if (state.step === 'waiting_for_pin') {
          // Store temporary PIN and ask for confirmation
          await this.setUserState(chatId, {
            ...state,
            step: 'waiting_for_confirm',
            newPin: pin,
          });

          await this.bot.sendMessage(
            chatId,
            '🔐 <b>Confirm PIN</b>\n\n' +
              'Please enter your PIN again to confirm:\n\n' +
              '<i>Confirm PIN:</i>',
            { parse_mode: 'HTML' }
          );
        } else if (state.step === 'waiting_for_confirm') {
          // Verify confirmation matches
          if (pin !== state.newPin) {
            await this.bot.sendMessage(
              chatId,
              '❌ <b>PIN Mismatch</b>\n\n' +
                'The PINs you entered do not match.\n\n' +
                'Starting over...',
              { parse_mode: 'HTML' }
            );

            // Reset and restart
            await this.clearUserState(chatId);
            await this.startSAPSetup(chatId, userId);
            return;
          }

          // Setup SAP with confirmed PIN
          const success = await UserEncryptionService.setupSAP(userId, pin);

          if (success) {
            await this.clearUserState(chatId);

            await this.bot.sendMessage(
              chatId,
              '✅ <b>SAP Setup Complete</b>\n\n' +
                'Your Security PIN is now active.\n\n' +
                '<b>Protected Operations:</b>\n' +
                '• 💸 Withdraw SOL\n' +
                '• 🔑 Export Private Key\n' +
                '• 🗑️ Delete Wallet\n\n' +
                '<b>PIN Duration:</b> ' +
                `${SAP_TIMEOUT_MINUTES} minutes per operation\n\n` +
                '🔒 Keep your PIN safe!',
              { parse_mode: 'HTML' }
            );
          } else {
            await this.bot.sendMessage(
              chatId,
              '❌ Failed to setup PIN. Try again with /setuppin'
            );
            await this.clearUserState(chatId);
          }
        }
      }
      // Handle verification flow
      else if (state.operation === 'verify') {
        await this.verifySAPForOperation(chatId, userId, pin, state.operationType || '');
      }
    } catch (error) {
      console.error('Error handling PIN input:', error);
      await this.bot.sendMessage(chatId, '❌ Error processing PIN. Try again.');
      await this.clearUserState(chatId);
    }
  }

  /**
   * Request SAP for an operation (withdraw, export, etc.)
   */
  async requestSAPForOperation(
    chatId: string,
    userId: number,
    operation: string
  ): Promise<boolean> {
    try {
      // Check if operation requires SAP
      const requiresSAP = SAPService.isSAPRequired(
        operation as 'withdraw' | 'export' | 'delete_wallet' | 'disable_protection'
      );

      if (!requiresSAP) {
        return true; // Operation doesn't require SAP
      }

      // Check if user has SAP setup
      const hasSAP = await UserEncryptionService.hasSAPSetup(userId);

      if (!hasSAP) {
        await this.bot.sendMessage(
          chatId,
          '🔐 <b>SAP Required</b>\n\n' +
            'This operation requires a Security PIN.\n\n' +
            'Setup your PIN with /setuppin first.',
          { parse_mode: 'HTML' }
        );
        return false;
      }

      // Check if already verified in this session
      const isVerified = await SAPService.isVerified(userId);

      if (isVerified) {
        return true; // Already verified in recent session
      }

      // Request SAP
      await this.setUserState(chatId, {
        step: 'waiting_for_operation_pin',
        operation: 'verify',
        operationType: operation,
      });

      await this.bot.sendMessage(
        chatId,
        SAPService.getSAPPromptMessage(operation, SAP_TIMEOUT_MINUTES),
        { parse_mode: 'HTML' }
      );

      return false; // Waiting for PIN
    } catch (error) {
      console.error('Error requesting SAP:', error);
      return false;
    }
  }

  /**
   * Verify SAP for an operation
   */
  private async verifySAPForOperation(
    chatId: string,
    userId: number,
    pin: string,
    operation: string
  ): Promise<void> {
    try {
      const result = await UserEncryptionService.verifyAndRegisterSAP(userId, pin);

      await this.clearUserState(chatId);

      if (result.success) {
        // Verified! Operation can proceed
        // Caller should check user state to see SAP was completed
        await this.bot.sendMessage(chatId, '✅ ' + result.message, {
          parse_mode: 'HTML',
        });

        // TODO: Proceed with original operation
      } else {
        await this.bot.sendMessage(chatId, result.message, { parse_mode: 'HTML' });
      }
    } catch (error) {
      console.error('Error verifying SAP:', error);
      await this.bot.sendMessage(chatId, '❌ SAP verification error. Try again.');
      await this.clearUserState(chatId);
    }
  }

  /**
   * Get user SAP state from Redis
   */
  private async getUserState(chatId: string): Promise<SAP_State | null> {
    try {
      const state = await redisClient.get(`sap_state:${chatId}`);
      return state ? JSON.parse(state) : null;
    } catch (error) {
      console.error('Error getting SAP state:', error);
      return null;
    }
  }

  /**
   * Set user SAP state in Redis
   */
  private async setUserState(chatId: string, state: SAP_State): Promise<void> {
    try {
      await redisClient.setEx(
        `sap_state:${chatId}`,
        10 * 60, // 10 minute timeout
        JSON.stringify(state)
      );
    } catch (error) {
      console.error('Error setting SAP state:', error);
    }
  }

  /**
   * Clear user SAP state
   */
  private async clearUserState(chatId: string): Promise<void> {
    try {
      await redisClient.del(`sap_state:${chatId}`);
    } catch (error) {
      console.error('Error clearing SAP state:', error);
    }
  }

  /**
   * Get SAP session info (remaining time, etc.)
   */
  async getSAPSessionInfo(userId: number): Promise<{ remaining: number } | null> {
    try {
      const remaining = await SAPService.getSessionTimeRemaining(userId);
      if (remaining > 0) {
        return { remaining };
      }
      return null;
    } catch (error) {
      console.error('Error getting SAP session info:', error);
      return null;
    }
  }
}

export default SAPHandler;
