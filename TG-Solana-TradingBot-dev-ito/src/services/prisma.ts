import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
      // Suppress error and warn logs from stdout - they'll be handled by error handlers
      {
        emit: 'event',
        level: 'error',
      },
      {
        emit: 'event',
        level: 'warn',
      },
    ],
  });
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;

// Connection test and initialization
export const connectDatabase = async () => {
  try {
    await prisma.$connect();
    console.log('✅ PostgreSQL database connected successfully');
    return true;
  } catch (error) {
    console.warn('⚠️  PostgreSQL unavailable - some features may be limited');
    return false;
  }
}

// Graceful shutdown
export const disconnectDatabase = async () => {
  await prisma.$disconnect();
};
