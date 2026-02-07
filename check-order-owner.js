const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkOrderOwner() {
  try {
    const order = await prisma.order.findUnique({
      where: { id: 'cml0x6dtj0geakqv9w808gk7r' },
      include: {
        requester: {
          select: {
            id: true,
            email: true,
            role: true
          }
        }
      }
    });

    if (order) {
      console.log('Order Details:');
      console.log(`Order ID: ${order.id}`);
      console.log(`Requester ID: ${order.requester.id}`);
      console.log(`Requester Email: ${order.requester.email}`);
      console.log(`Requester Role: ${order.requester.role}`);
      console.log(`Status: ${order.status}`);
      console.log(`Arranging Media: ${order.arrangingMedia?.length || 0} files`);
      console.log(`Packaging Media: ${order.packagingMedia?.length || 0} files`);
      console.log(`Transit Media: ${order.transitMedia?.length || 0} files`);
    } else {
      console.log('Order not found');
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
  }
}

checkOrderOwner();
