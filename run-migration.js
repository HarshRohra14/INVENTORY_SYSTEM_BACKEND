const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrate() {
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE `orders` MODIFY `branchId` VARCHAR(191)');
    console.log('✅ Migration successful: branchId is now nullable');
  } catch (error) {
    console.error('❌ Migration error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
