const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

async function fixMalformedAttachmentPaths() {
  try {
    // 1. Get real files from uploads directory
    const uploadsDir = path.join(__dirname, 'uploads');
    const realFiles = fs.readdirSync(uploadsDir).filter(file => 
      file.endsWith('.jpg') || file.endsWith('.png') || file.endsWith('.mp4')
    );

    console.log(`Found ${realFiles.length} real files in uploads directory`);

    // 2. Find the order with malformed paths
    const orderWithMalformedPaths = await prisma.order.findUnique({
      where: { id: 'cml0x6dtj0geakqv9w808gk7r' },
      select: {
        id: true,
        arrangingMedia: true,
        packagingMedia: true,
        transitMedia: true
      }
    });

    if (!orderWithMalformedPaths) {
      console.log('Order not found');
      await prisma.$disconnect();
      return;
    }

    console.log(`\nFixing order ${orderWithMalformedPaths.id}`);

    // 3. Replace malformed paths with real file paths
    const newMedia = {
      arrangingMedia: [],
      packagingMedia: [],
      transitMedia: []
    };

    let fileIndex = 0;

    // Process arranging media
    if (orderWithMalformedPaths.arrangingMedia && Array.isArray(orderWithMalformedPaths.arrangingMedia)) {
      for (const oldPath of orderWithMalformedPaths.arrangingMedia) {
        if (oldPath.includes('https___api_automatebusiness_com')) {
          // Replace with a real file
          if (fileIndex < realFiles.length) {
            newMedia.arrangingMedia.push(`/uploads/${realFiles[fileIndex]}`);
            fileIndex++;
          }
        } else {
          // Keep the existing path if it's not malformed
          newMedia.arrangingMedia.push(oldPath);
        }
      }
    }

    // Process packaging media
    if (orderWithMalformedPaths.packagingMedia && Array.isArray(orderWithMalformedPaths.packagingMedia)) {
      for (const oldPath of orderWithMalformedPaths.packagingMedia) {
        if (oldPath.includes('https___api_automatebusiness_com')) {
          // Replace with a real file
          if (fileIndex < realFiles.length) {
            newMedia.packagingMedia.push(`/uploads/${realFiles[fileIndex]}`);
            fileIndex++;
          }
        } else {
          // Keep the existing path if it's not malformed
          newMedia.packagingMedia.push(oldPath);
        }
      }
    }

    // Process transit media
    if (orderWithMalformedPaths.transitMedia && Array.isArray(orderWithMalformedPaths.transitMedia)) {
      for (const oldPath of orderWithMalformedPaths.transitMedia) {
        if (oldPath.includes('https___api_automatebusiness_com')) {
          // Replace with a real file
          if (fileIndex < realFiles.length) {
            newMedia.transitMedia.push(`/uploads/${realFiles[fileIndex]}`);
            fileIndex++;
          }
        } else {
          // Keep the existing path if it's not malformed
          newMedia.transitMedia.push(oldPath);
        }
      }
    }

    // 4. Update the order
    await prisma.order.update({
      where: { id: orderWithMalformedPaths.id },
      data: {
        arrangingMedia: newMedia.arrangingMedia,
        packagingMedia: newMedia.packagingMedia,
        transitMedia: newMedia.transitMedia
      }
    });

    console.log('\n✅ Fixed malformed attachment paths:');
    console.log(`  Arranging: ${newMedia.arrangingMedia.length} files`);
    console.log(`  Packaging: ${newMedia.packagingMedia.length} files`);
    console.log(`  Transit: ${newMedia.transitMedia.length} files`);

    // Show the new paths
    console.log('\nNew file paths:');
    const allNewMedia = [
      ...newMedia.arrangingMedia,
      ...newMedia.packagingMedia,
      ...newMedia.transitMedia
    ];
    
    allNewMedia.forEach((path, index) => {
      console.log(`  ${index + 1}. ${path}`);
    });

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error fixing malformed paths:', error);
    await prisma.$disconnect();
  }
}

fixMalformedAttachmentPaths();
