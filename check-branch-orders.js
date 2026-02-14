const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBranchOrders() {
  try {
    const branchId = 'cmk2lbj1e2xb8kqosuzyz8lfd';
    
    console.log(`Checking orders for branch: ${branchId}`);
    
    // Count total orders for this branch
    const totalCount = await prisma.order.count({
      where: { branchId: branchId }
    });
    
    console.log(`Total orders for branch: ${totalCount}`);
    
    if (totalCount > 0) {
      // Get first few orders
      const orders = await prisma.order.findMany({
        where: { branchId: branchId },
        take: 3,
        include: {
          requester: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      
      console.log('Sample orders:');
      orders.forEach((order, index) => {
        console.log(`  ${index + 1}. Order ID: ${order.id}`);
        console.log(`     Requester: ${order.requester.firstName} ${order.requester.lastName} (${order.requester.email})`);
        console.log(`     Status: ${order.status}`);
        console.log(`     Created: ${order.createdAt}`);
      });
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
  }
}

checkBranchOrders();
