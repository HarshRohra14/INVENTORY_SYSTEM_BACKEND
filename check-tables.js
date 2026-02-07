const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkTables() {
  try {
    const result = await prisma.$queryRaw`SHOW TABLES`;
    console.log('Tables:', result);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkTables();
