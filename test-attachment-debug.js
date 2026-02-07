const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAttachmentFeature() {
  try {
    // 1. Find a user with orders that have attachments
    const orderWithAttachments = await prisma.order.findFirst({
      where: {
        OR: [
          { arrangingMedia: { not: null } },
          { packagingMedia: { not: null } },
          { transitMedia: { not: null } }
        ]
      },
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

    if (!orderWithAttachments) {
      console.log('No orders with attachments found');
      await prisma.$disconnect();
      return;
    }

    console.log('Found order with attachments:');
    console.log(`Order ID: ${orderWithAttachments.id}`);
    console.log(`Requester: ${orderWithAttachments.requester.email} (${orderWithAttachments.requester.role})`);
    console.log(`Status: ${orderWithAttachments.status}`);
    console.log(`Arranging Media: ${orderWithAttachments.arrangingMedia?.length || 0} files`);
    console.log(`Packaging Media: ${orderWithAttachments.packagingMedia?.length || 0} files`);
    console.log(`Transit Media: ${orderWithAttachments.transitMedia?.length || 0} files`);

    // 2. Show the actual file paths
    const allMedia = [
      ...(orderWithAttachments.arrangingMedia || []),
      ...(orderWithAttachments.packagingMedia || []),
      ...(orderWithAttachments.transitMedia || [])
    ];

    if (allMedia.length > 0) {
      console.log('\nMedia file paths:');
      allMedia.forEach((path, index) => {
        console.log(`${index + 1}. ${path}`);
      });
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
  }
}

testAttachmentFeature();
