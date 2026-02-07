const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkOrderDetails() {
  try {
    const order = await prisma.order.findUnique({
      where: {
        id: 'cmk583t35cxxrkqose9q6euof'
      },
      select: {
        id: true,
        requesterId: true,
        status: true,
        arrangingMedia: true,
        packagingMedia: true,
        transitMedia: true,
        requester: {
          select: {
            email: true,
            role: true
          }
        }
      }
    });
    
    console.log('Order Details:');
    console.log(`Order ID: ${order.id}`);
    console.log(`Requester ID: ${order.requesterId}`);
    console.log(`Requester Email: ${order.requester.email}`);
    console.log(`Requester Role: ${order.requester.role}`);
    console.log(`Status: ${order.status}`);
    console.log(`Arranging Media: ${order.arrangingMedia?.length || 0} files`);
    console.log(`Packaging Media: ${order.packagingMedia?.length || 0} files`);
    console.log(`Transit Media: ${order.transitMedia?.length || 0} files`);
    
    if (order.arrangingMedia && order.arrangingMedia.length > 0) {
      console.log('\nArranging Media Files:');
      order.arrangingMedia.forEach((file, index) => {
        console.log(`${index + 1}. ${file}`);
      });
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
  }
}

checkOrderDetails();
