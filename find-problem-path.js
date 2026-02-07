const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findSpecificProblemPath() {
  try {
    // Search for the specific problematic path
    const problematicPath = 'https___api_automatebusiness_com_storage_v1_object_public_task-attachments_22903_1d017725-2784-4ab0-b4b8-88bacfdfc564_IMG-20260131-WA0034-1770271676545-448937896.jpg';
    
    const allOrders = await prisma.order.findMany({
      select: {
        id: true,
        arrangingMedia: true,
        packagingMedia: true,
        transitMedia: true
      }
    });

    const orderWithProblem = allOrders.find(order => {
      const allMedia = [
        ...(Array.isArray(order.arrangingMedia) ? order.arrangingMedia : []),
        ...(Array.isArray(order.packagingMedia) ? order.packagingMedia : []),
        ...(Array.isArray(order.transitMedia) ? order.transitMedia : [])
      ];
      
      return allMedia.some(path => path.includes(problematicPath));
    });

    if (orderWithProblem) {
      console.log('Found order with problematic path:');
      console.log(`Order ID: ${orderWithProblem.id}`);
      
      const allMedia = [
        ...(Array.isArray(orderWithProblem.arrangingMedia) ? orderWithProblem.arrangingMedia : []),
        ...(Array.isArray(orderWithProblem.packagingMedia) ? orderWithProblem.packagingMedia : []),
        ...(Array.isArray(orderWithProblem.transitMedia) ? orderWithProblem.transitMedia : [])
      ];
      
      console.log('All media paths:');
      allMedia.forEach((path, index) => {
        console.log(`  ${index + 1}. ${path}`);
      });
    } else {
      console.log('No order found with that specific problematic path');
      
      // Let's check all media paths to see what we have
      console.log('\nChecking all media paths across all orders...');
      let totalMedia = 0;
      let urlPaths = 0;
      
      allOrders.forEach(order => {
        const allMedia = [
          ...(Array.isArray(order.arrangingMedia) ? order.arrangingMedia : []),
          ...(Array.isArray(order.packagingMedia) ? order.packagingMedia : []),
          ...(Array.isArray(order.transitMedia) ? order.transitMedia : [])
        ];
        
        totalMedia += allMedia.length;
        urlPaths += allMedia.filter(path => path.startsWith('http')).length;
        
        if (allMedia.length > 0) {
          console.log(`Order ${order.id}: ${allMedia.length} media files`);
        }
      });
      
      console.log(`\nTotal media files: ${totalMedia}`);
      console.log(`URL-based paths: ${urlPaths}`);
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
  }
}

findSpecificProblemPath();
