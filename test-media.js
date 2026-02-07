const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addTestMedia() {
  try {
    // Get a sample order
    const order = await prisma.order.findFirst();
    
    if (!order) {
      console.log('No orders found');
      return;
    }
    
    console.log('Found order:', order.id);
    
    // Add sample media data
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        arrangingMedia: ['/uploads/test-arranging-1.jpg', '/uploads/test-arranging-2.jpg'],
        packagingMedia: ['/uploads/test-packaging-1.jpg'],
        transitMedia: ['/uploads/test-transit-1.jpg', '/uploads/test-transit-2.jpg', '/uploads/test-transit-3.mp4']
      }
    });
    
    console.log('Updated order with test media:', updatedOrder.id);
    console.log('arrangingMedia:', updatedOrder.arrangingMedia);
    console.log('packagingMedia:', updatedOrder.packagingMedia);
    console.log('transitMedia:', updatedOrder.transitMedia);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addTestMedia();
