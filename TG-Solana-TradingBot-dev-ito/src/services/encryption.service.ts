/**
 * Encryption Service - Phase 0.2
 * Handles AES-256-GCM encryption/decryption of sensitive wallet data
 * CRITICAL: Private keys are NEVER stored in plaintext
 */

import crypto from 'crypto';
import { WALLET_MASTER_KEY } from '../config';

export class EncryptionService {
  /**
   * Encrypt data using AES-256-GCM
   * @param plaintext - Data to encrypt
   * @param keyHex - Encryption key (base64 string from env)
   * @returns Base64 encoded ciphertext with IV and auth tag
   */
  static encrypt(plaintext: string, keyBase64: string = WALLET_MASTER_KEY!): string {
    if (!keyBase64) {
      throw new Error('ENCRYPTION_KEY_MISSING: WALLET_MASTER_KEY not configured');
    }

    try {
      // Decode base64 key to buffer (should be 32 bytes for AES-256)
      const key = Buffer.from(keyBase64, 'base64');
      
      if (key.length !== 32) {
        throw new Error(`Invalid key length: expected 32 bytes, got ${key.length}`);
      }

      // Generate random IV (96 bits = 12 bytes for GCM)
      const iv = crypto.randomBytes(12);
      
      // Create cipher
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      
      // Encrypt
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get auth tag
      const authTag = cipher.getAuthTag();
      
      // Combine: IV + authTag + ciphertext, all base64 encoded
      const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')]);
      
      return combined.toString('base64');
    } catch (error) {
      throw new Error(`Encryption failed: ${error}`);
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   * @param encryptedBase64 - Base64 encoded (IV + authTag + ciphertext)
   * @param keyHex - Encryption key (base64 string from env)
   * @returns Decrypted plaintext
   */
  static decrypt(encryptedBase64: string, keyBase64: string = WALLET_MASTER_KEY!): string {
    if (!keyBase64) {
      throw new Error('DECRYPTION_KEY_MISSING: WALLET_MASTER_KEY not configured');
    }

    try {
      // Decode base64 key
      const key = Buffer.from(keyBase64, 'base64');
      
      if (key.length !== 32) {
        throw new Error(`Invalid key length: expected 32 bytes, got ${key.length}`);
      }

      // Decode combined buffer
      const combined = Buffer.from(encryptedBase64, 'base64');
      
      // Extract IV (first 12 bytes), authTag (next 16 bytes), ciphertext (rest)
      const iv = combined.slice(0, 12);
      const authTag = combined.slice(12, 28);
      const ciphertext = combined.slice(28);
      
      // Create decipher
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      
      // Decrypt
      let decrypted = decipher.update(ciphertext.toString('hex'), 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error}`);
    }
  }

  /**
   * Generate a secure random encryption key (base64 encoded)
   * Usage: node -e "const crypto = require('crypto'); console.log(crypto.randomBytes(32).toString('base64'))"
   */
  static generateMasterKey(): string {
    return crypto.randomBytes(32).toString('base64');
  }

  /**
   * Hash a PIN to store in database (NOT reversible)
   * Uses PBKDF2 for salted hashing
   */
  static hashPIN(pin: string): { hash: string; salt: string } {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto
      .pbkdf2Sync(pin, salt, 100000, 64, 'sha256')
      .toString('hex');
    
    return { hash, salt };
  }

  /**
   * Verify PIN against stored hash
   */
  static verifyPIN(pin: string, storedHash: string, salt: string): boolean {
    const hash = crypto
      .pbkdf2Sync(pin, salt, 100000, 64, 'sha256')
      .toString('hex');
    
    // Constant time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(hash),
      Buffer.from(storedHash)
    );
  }
}

export default EncryptionService;
