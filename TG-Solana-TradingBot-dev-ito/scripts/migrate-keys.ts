#!/usr/bin/env node

/**
 * Key Migration Script - Phase 0.2
 * 
 * This script migrates all existing users with plaintext private keys
 * to the new encrypted format using AES-256-GCM encryption.
 * 
 * Run with: npx ts-node scripts/migrate-keys.ts
 */

import { PrismaClient } from '@prisma/client';
import { UserEncryptionService } from '../src/services/user.encryption.service';

const prisma = new PrismaClient();

async function main() {
  console.log('🔒 Starting Key Migration (Phase 0.2)...\n');

  try {
    // Run migration
    const result = await UserEncryptionService.migrateAllUsers();

    console.log('\n📊 Migration Summary:');
    console.log(`   Total Users: ${result.total}`);
    console.log(`   ✅ Migrated: ${result.migrated}`);
    console.log(`   ❌ Failed: ${result.failed}`);

    if (result.failed === 0 && result.total > 0) {
      console.log('\n✅ All users migrated successfully!');
    } else if (result.total === 0) {
      console.log('\n✅ No users needed migration (all using encrypted keys)');
    } else {
      console.log(`\n⚠️  ${result.failed} users failed to migrate. Check logs above.`);
    }
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
