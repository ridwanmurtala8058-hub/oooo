/**
 * User Encryption Service - Phase 0.2 Integration
 * Transparent encryption/decryption for user wallet private keys
 * 
 * This service provides a safe wrapper for:
 * - Storing private keys encrypted in database
 * - Loading and decrypting keys for signing operations
 * - Migrating existing plaintext keys to encrypted format
 */

import { EncryptionService } from './encryption.service';
import { SAPService } from './sap.service';
import { PrismaClient } from '@prisma/client';
import { WALLET_MASTER_KEY } from '../config';
import { Keypair } from '@solana/web3.js';

const prisma = new PrismaClient();

export class UserEncryptionService {
  /**
   * Store encrypted private key for a user
   * Encrypts plaintext private key with WALLET_MASTER_KEY
   */
  static encryptAndStore(plaintextPrivateKey: string): string {
    if (!WALLET_MASTER_KEY) {
      throw new Error('WALLET_MASTER_KEY is not configured. Cannot store encrypted keys.');
    }

    // Validate it's a valid private key (base58 encoded Solana key)
    if (!plaintextPrivateKey || plaintextPrivateKey.length < 87) {
      throw new Error('Invalid private key format');
    }

    // Encrypt with WALLET_MASTER_KEY
    const encryptedKey = EncryptionService.encrypt(plaintextPrivateKey, WALLET_MASTER_KEY);
    return encryptedKey;
  }

  /**
   * Retrieve and decrypt private key for a user
   * Safe decryption for signing operations
   */
  static decryptForSigning(
    userId: number | string,
    encryptedPrivateKey: string,
    requireSAP: boolean = true
  ): string {
    if (!WALLET_MASTER_KEY) {
      throw new Error('WALLET_MASTER_KEY is not configured. Cannot decrypt keys.');
    }

    try {
      // In production: could check SAP session before decrypting
      // For now, the check is done at the operation level
      const plaintextKey = EncryptionService.decrypt(encryptedPrivateKey, WALLET_MASTER_KEY);

      // Validate decrypted key is valid (base58, correct length)
      if (!plaintextKey || plaintextKey.length < 87) {
        throw new Error('Decrypted key is not in valid format. Possible corruption.');
      }

      return plaintextKey;
    } catch (error) {
      console.error(`Failed to decrypt key for user ${userId}:`, error);
      throw new Error('Failed to decrypt private key. Check WALLET_MASTER_KEY configuration.');
    }
  }

  /**
   * Get Keypair for signing (auto-decrypt)
   */
  static async getKeypairForSigning(
    userId: number | string,
    requireSAP: boolean = true
  ): Promise<Keypair> {
    // Load user from database
    const user = await prisma.user.findUnique({
      where: { id: typeof userId === 'string' ? parseInt(userId) : userId },
    });

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Check if user has encrypted key (new format)
    if (!user.encrypted_private_key && !user.private_key) {
      throw new Error('No private key found for user');
    }

    // Prefer encrypted key, fall back to plaintext (migration case)
    const keyString = user.encrypted_private_key || user.private_key;

    if (!keyString) {
      throw new Error('No private key available');
    }

    // Decrypt if encrypted
    let decryptedKey: string;
    if (user.encrypted_private_key) {
      decryptedKey = this.decryptForSigning(userId, user.encrypted_private_key, requireSAP);
    } else {
      // Plaintext key (legacy) - should migrate
      console.warn(`User ${userId} still has plaintext private key. Should migrate to encrypted.`);
      decryptedKey = user.private_key;
    }

    // Create Keypair from decrypted base58 key
    try {
      const keypair = Keypair.fromSecretKey(Buffer.from(JSON.parse(decryptedKey)));
      return keypair;
    } catch (error) {
      throw new Error('Failed to create Keypair from private key: ' + error);
    }
  }

  /**
   * Migrate plaintext key to encrypted (for existing users)
   * Should be run in a migration script
   */
  static async migrateUserKey(userId: number | string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: typeof userId === 'string' ? parseInt(userId) : userId },
    });

    if (!user || !user.private_key) {
      console.log(`User ${userId} has no plaintext key to migrate`);
      return false;
    }

    if (user.encrypted_private_key) {
      console.log(`User ${userId} already has encrypted key`);
      return false;
    }

    try {
      // Encrypt the plaintext key
      const encrypted = this.encryptAndStore(user.private_key);

      // Update database
      await prisma.user.update({
        where: { id: typeof userId === 'string' ? parseInt(userId) : userId },
        data: {
          encrypted_private_key: encrypted,
          // Keep private_key for now for backward compatibility during rollout
        },
      });

      console.log(`✅ Migrated user ${userId} to encrypted key storage`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to migrate user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Batch migrate all users with plaintext keys
   */
  static async migrateAllUsers(): Promise<{ total: number; migrated: number; failed: number }> {
    const users = await prisma.user.findMany({
      where: {
        private_key: { not: undefined },
        encrypted_private_key: undefined,
      },
    });

    let migrated = 0;
    let failed = 0;

    for (const user of users) {
      try {
        const success = await this.migrateUserKey(user.id);
        if (success) migrated++;
      } catch (error) {
        failed++;
        console.error(`Failed to migrate user ${user.id}:`, error);
      }
    }

    return {
      total: users.length,
      migrated,
      failed,
    };
  }

  /**
   * Check if user has SAP setup
   */
  static async hasSAPSetup(userId: number | string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: typeof userId === 'string' ? parseInt(userId) : userId },
      select: { pin_hash: true },
    });

    return !!user?.pin_hash;
  }

  /**
   * Setup SAP for user (store hash/salt in database)
   */
  static async setupSAP(userId: number | string, pin: string): Promise<boolean> {
    try {
      // Create hash/salt
      const { hash, salt } = SAPService.setupSAP(pin);

      // Store in database
      await prisma.user.update({
        where: { id: typeof userId === 'string' ? parseInt(userId) : userId },
        data: {
          pin_hash: hash,
          pin_salt: salt,
          pin_attempts: 0,
        },
      });

      console.log(`✅ SAP setup complete for user ${userId}`);
      return true;
    } catch (error) {
      console.error(`Failed to setup SAP for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Verify SAP and clear lockout on success
   */
  static async verifyAndRegisterSAP(
    userId: number | string,
    pin: string
  ): Promise<{ success: boolean; message: string }> {
    const user = await prisma.user.findUnique({
      where: { id: typeof userId === 'string' ? parseInt(userId) : userId },
      select: { pin_hash: true, pin_salt: true, pin_attempts: true, pin_locked_until: true },
    });

    if (!user || !user.pin_hash || !user.pin_salt) {
      return { success: false, message: 'SAP not setup for this user' };
    }

    // Check if locked out
    if (user.pin_locked_until && new Date(user.pin_locked_until) > new Date()) {
      return {
        success: false,
        message: `⏱️ Account locked. Try again in 5 minutes`,
      };
    }

    // Verify PIN
    const isValid = EncryptionService.verifyPIN(pin, user.pin_hash, user.pin_salt);

    if (!isValid) {
      // Increment failed attempts
      const attempts = user.pin_attempts + 1;

      if (attempts >= 3) {
        // Lock account for 5 minutes
        const lockedUntil = new Date(Date.now() + 5 * 60 * 1000);
        await prisma.user.update({
          where: { id: typeof userId === 'string' ? parseInt(userId) : userId },
          data: {
            pin_attempts: attempts,
            pin_locked_until: lockedUntil,
          },
        });

        return {
          success: false,
          message: `❌ Too many failed attempts. Account locked for 5 minutes.`,
        };
      }

      // Update attempts
      await prisma.user.update({
        where: { id: typeof userId === 'string' ? parseInt(userId) : userId },
        data: { pin_attempts: attempts },
      });

      return {
        success: false,
        message: `❌ Invalid PIN. ${3 - attempts} attempts remaining.`,
      };
    }

    // Clear attempts and lockout on success
    await prisma.user.update({
      where: { id: typeof userId === 'string' ? parseInt(userId) : userId },
      data: {
        pin_attempts: 0,
        pin_locked_until: null,
      },
    });

    // Create SAP session
    const result = await SAPService.verifyAndCreateSession(
      userId,
      pin,
      user.pin_hash,
      user.pin_salt
    );

    return result;
  }
}

export default UserEncryptionService;
