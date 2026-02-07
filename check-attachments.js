const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkOrdersWithAttachments() {
  try {
    const orders = await prisma.order.findMany({
      select: {
        id: true,
        requesterId: true,
        status: true,
        arrangingMedia: true,
        packagingMedia: true,
        transitMedia: true
      },
      take: 5
    });
    
    console.log('Recent orders:');
    orders.forEach(order => {
      console.log(`Order ID: ${order.id}`);
      console.log(`Status: ${order.status}`);
      console.log(`Arranging Media: ${order.arrangingMedia?.length || 0} files`);
      console.log(`Packaging Media: ${order.packagingMedia?.length || 0} files`);
      console.log(`Transit Media: ${order.transitMedia?.length || 0} files`);
      console.log('---');
    });
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
  }
}

checkOrdersWithAttachments();
