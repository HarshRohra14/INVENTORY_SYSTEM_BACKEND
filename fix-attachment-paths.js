const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

async function fixAttachmentPaths() {
  try {
    // 1. Get real files from uploads directory
    const uploadsDir = path.join(__dirname, 'uploads');
    const realFiles = fs.readdirSync(uploadsDir).filter(file => 
      file.endsWith('.jpg') || file.endsWith('.png') || file.endsWith('.mp4')
    );

    console.log(`Found ${realFiles.length} real files in uploads directory`);
    console.log('First few files:', realFiles.slice(0, 5));

    // 2. Find orders with test attachment paths
    const allOrders = await prisma.order.findMany({
      select: {
        id: true,
        arrangingMedia: true,
        packagingMedia: true,
        transitMedia: true
      }
    });

    const ordersWithTestAttachments = allOrders.filter(order => {
      const hasTestAttachments = 
        (order.arrangingMedia && Array.isArray(order.arrangingMedia) && order.arrangingMedia.some(path => path.includes('test-'))) ||
        (order.packagingMedia && Array.isArray(order.packagingMedia) && order.packagingMedia.some(path => path.includes('test-'))) ||
        (order.transitMedia && Array.isArray(order.transitMedia) && order.transitMedia.some(path => path.includes('test-')));
      return hasTestAttachments;
    });

    console.log(`\nFound ${ordersWithTestAttachments.length} orders with test attachments`);

    // 3. Update each order with real file paths
    for (const order of ordersWithTestAttachments) {
      const newMedia = {
        arrangingMedia: [],
        packagingMedia: [],
        transitMedia: []
      };

      // Replace arranging media
      if (order.arrangingMedia && order.arrangingMedia.length > 0) {
        for (let i = 0; i < order.arrangingMedia.length && i < realFiles.length; i++) {
          newMedia.arrangingMedia.push(`/uploads/${realFiles[i]}`);
        }
      }

      // Replace packaging media
      if (order.packagingMedia && order.packagingMedia.length > 0) {
        const startIndex = newMedia.arrangingMedia.length;
        for (let i = 0; i < order.packagingMedia.length && (startIndex + i) < realFiles.length; i++) {
          newMedia.packagingMedia.push(`/uploads/${realFiles[startIndex + i]}`);
        }
      }

      // Replace transit media
      if (order.transitMedia && order.transitMedia.length > 0) {
        const startIndex = newMedia.arrangingMedia.length + newMedia.packagingMedia.length;
        for (let i = 0; i < order.transitMedia.length && (startIndex + i) < realFiles.length; i++) {
          newMedia.transitMedia.push(`/uploads/${realFiles[startIndex + i]}`);
        }
      }

      // Update the order
      await prisma.order.update({
        where: { id: order.id },
        data: {
          arrangingMedia: newMedia.arrangingMedia,
          packagingMedia: newMedia.packagingMedia,
          transitMedia: newMedia.transitMedia
        }
      });

      console.log(`Updated order ${order.id}:`);
      console.log(`  Arranging: ${newMedia.arrangingMedia.length} files`);
      console.log(`  Packaging: ${newMedia.packagingMedia.length} files`);
      console.log(`  Transit: ${newMedia.transitMedia.length} files`);
    }

    console.log('\n✅ Attachment paths fixed successfully!');
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error fixing attachment paths:', error);
    await prisma.$disconnect();
  }
}

fixAttachmentPaths();
