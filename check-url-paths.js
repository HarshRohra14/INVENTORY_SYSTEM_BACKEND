const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAttachmentPaths() {
  try {
    // Find orders with problematic attachment paths
    const allOrders = await prisma.order.findMany({
      select: {
        id: true,
        arrangingMedia: true,
        packagingMedia: true,
        transitMedia: true
      }
    });

    const ordersWithUrlPaths = allOrders.filter(order => {
      const hasUrlPaths = 
        (order.arrangingMedia && Array.isArray(order.arrangingMedia) && order.arrangingMedia.some(path => path.startsWith('http'))) ||
        (order.packagingMedia && Array.isArray(order.packagingMedia) && order.packagingMedia.some(path => path.startsWith('http'))) ||
        (order.transitMedia && Array.isArray(order.transitMedia) && order.transitMedia.some(path => path.startsWith('http')));
      return hasUrlPaths;
    });

    console.log(`Found ${ordersWithUrlPaths.length} orders with URL-based attachment paths`);

    if (ordersWithUrlPaths.length > 0) {
      ordersWithUrlPaths.forEach(order => {
        console.log(`\nOrder ID: ${order.id}`);
        
        const allMedia = [
          ...(order.arrangingMedia || []),
          ...(order.packagingMedia || []),
          ...(order.transitMedia || [])
        ];
        
        const urlMedia = allMedia.filter(path => path.startsWith('http'));
        console.log('URL-based paths:');
        urlMedia.forEach((path, index) => {
          console.log(`  ${index + 1}. ${path}`);
        });
      });
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
  }
}

checkAttachmentPaths();
