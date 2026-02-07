const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkOrdersWithAttachments() {
  try {
    console.log('🔍 Checking orders with attachments...\n');

    // Find orders with any media files
    const ordersWithMedia = await prisma.order.findMany({
      where: {
        OR: [
          { arrangingMedia: { not: null } },
          { packagingMedia: { not: null } },
          { transitMedia: { not: null } }
        ]
      },
      select: {
        id: true,
        status: true,
        requesterId: true,
        arrangingMedia: true,
        packagingMedia: true,
        transitMedia: true,
        requester: {
          select: {
            email: true,
            role: true
          }
        }
      },
      take: 5
    });

    console.log(`Found ${ordersWithMedia.length} orders with attachments:\n`);

    ordersWithMedia.forEach((order, index) => {
      console.log(`${index + 1}. Order ID: ${order.id}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Requester: ${order.requester.email} (${order.requester.role})`);
      console.log(`   Arranging Media: ${order.arrangingMedia ? order.arrangingMedia.length : 0} files`);
      console.log(`   Packaging Media: ${order.packagingMedia ? order.packagingMedia.length : 0} files`);
      console.log(`   Transit Media: ${order.transitMedia ? order.transitMedia.length : 0} files`);
      console.log('');
    });

    // Also check a few recent orders without attachments for testing
    const recentOrders = await prisma.order.findMany({
      where: {
        AND: [
          { arrangingMedia: null },
          { packagingMedia: null },
          { transitMedia: null }
        ]
      },
      select: {
        id: true,
        status: true,
        requesterId: true,
        requester: {
          select: {
            email: true,
            role: true
          }
        }
      },
      take: 3
    });

    console.log(`\nRecent orders without attachments (for testing):\n`);
    recentOrders.forEach((order, index) => {
      console.log(`${index + 1}. Order ID: ${order.id}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Requester: ${order.requester.email} (${order.requester.role})`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkOrdersWithAttachments();
