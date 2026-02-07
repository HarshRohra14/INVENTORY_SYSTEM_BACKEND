const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findUsers() {
  try {
    const users = await prisma.user.findMany({
      where: { role: { in: ['MANAGER', 'ADMIN'] } },
      select: { id: true, email: true, role: true, firstName: true, lastName: true }
    });
    console.log('Available Managers/Admins:');
    users.forEach(u => console.log(`- ${u.email} (${u.role})`));
    
    // Also check for any orders to test with
    const orders = await prisma.order.findMany({
      take: 3,
      select: { id: true, status: true, requesterId: true }
    });
    console.log('\nRecent Orders:');
    orders.forEach(o => console.log(`- ${o.id} (${o.status})`));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

findUsers();
