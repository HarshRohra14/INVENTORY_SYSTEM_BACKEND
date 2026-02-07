const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Dynamic base URL configuration
const BASE_URL = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || `http://localhost:${process.env.PORT || 3001}`;

/**
 * Get attachments for a specific order
 * @param {string} orderId - ID of the order
 * @param {string} userId - ID of the user requesting (for authorization)
 * @returns {Object} Attachments data with metadata
 */
const getOrderAttachments = async (orderId, userId) => {
  try {
    // Step 1: Validate the order exists and user has access
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        requesterId: userId // Only the order requester can view attachments
      },
      select: {
        id: true,
        requesterId: true,
        arrangingMedia: true,
        packagingMedia: true,
        transitMedia: true,
        status: true
      }
    });

    if (!order) {
      return {
        success: false,
        message: 'Order not found or access denied'
      };
    }

    // Step 2: Process media files and create attachment objects
    const attachments = [];

    // Process arranging media
    if (order.arrangingMedia && Array.isArray(order.arrangingMedia)) {
      order.arrangingMedia.forEach((mediaPath, index) => {
        attachments.push({
          id: `arranging-${index + 1}`,
          filename: mediaPath.split('/').pop() || mediaPath,
          originalName: mediaPath.split('/').pop() || mediaPath,
          mimeType: getMimeType(mediaPath),
          size: 0, // We'll implement file size detection later
          uploadedAt: new Date().toISOString(),
          stage: 'ARRANGING',
          url: `${BASE_URL}${mediaPath}`
        });
      });
    }

    // Process packaging media
    if (order.packagingMedia && Array.isArray(order.packagingMedia)) {
      order.packagingMedia.forEach((mediaPath, index) => {
        attachments.push({
          id: `packaging-${index + 1}`,
          filename: mediaPath.split('/').pop() || mediaPath,
          originalName: mediaPath.split('/').pop() || mediaPath,
          mimeType: getMimeType(mediaPath),
          size: 0,
          uploadedAt: new Date().toISOString(),
          stage: 'PACKAGING',
          url: `${BASE_URL}${mediaPath}`
        });
      });
    }

    // Process transit media
    if (order.transitMedia && Array.isArray(order.transitMedia)) {
      order.transitMedia.forEach((mediaPath, index) => {
        attachments.push({
          id: `transit-${index + 1}`,
          filename: mediaPath.split('/').pop() || mediaPath,
          originalName: mediaPath.split('/').pop() || mediaPath,
          mimeType: getMimeType(mediaPath),
          size: 0,
          uploadedAt: new Date().toISOString(),
          stage: 'TRANSIT',
          url: `${BASE_URL}${mediaPath}`
        });
      });
    }

    return {
      success: true,
      message: 'Attachments retrieved successfully',
      data: attachments
    };

  } catch (error) {
    console.error('Get order attachments error:', error);
    return {
      success: false,
      message: error.message || 'Failed to retrieve attachments'
    };
  }
};

/**
 * Helper function to determine MIME type from file extension
 * @param {string} filePath - File path
 * @returns {string} MIME type
 */
function getMimeType(filePath) {
  const extension = filePath.split('.').pop()?.toLowerCase();
  
  const mimeTypes = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'ogg': 'video/ogg',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  };

  return mimeTypes[extension] || 'application/octet-stream';
}

/**
 * Get attachments for a specific order (manager access)
 * @param {string} orderId - ID of the order
 * @param {string} userId - ID of the user requesting (for authorization)
 * @param {string} userRole - Role of the user requesting
 * @returns {Object} Attachments data with metadata
 */
const getManagerOrderAttachments = async (orderId, userId, userRole) => {
  try {
    // Step 1: Validate the order exists and user has access
    let order;
    
    if (userRole === 'MANAGER' || userRole === 'ADMIN') {
      // Managers and admins can view any order's attachments
      order = await prisma.order.findFirst({
        where: {
          id: orderId
        },
        select: {
          id: true,
          requesterId: true,
          arrangingMedia: true,
          packagingMedia: true,
          transitMedia: true,
          status: true
        }
      });
    } else {
      // Branch users can only view their own order attachments
      order = await prisma.order.findFirst({
        where: {
          id: orderId,
          requesterId: userId // Only the order requester can view attachments
        },
        select: {
          id: true,
          requesterId: true,
          arrangingMedia: true,
          packagingMedia: true,
          transitMedia: true,
          status: true
        }
      });
    }

    if (!order) {
      return {
        success: false,
        message: 'Order not found or access denied'
      };
    }

    // Step 2: Process media files and create attachment objects
    const attachments = [];

    // Process arranging media
    if (order.arrangingMedia && Array.isArray(order.arrangingMedia)) {
      order.arrangingMedia.forEach((mediaPath, index) => {
        attachments.push({
          id: `arranging-${index + 1}`,
          filename: mediaPath.split('/').pop() || mediaPath,
          originalName: mediaPath.split('/').pop() || mediaPath,
          mimeType: getMimeType(mediaPath),
          size: 0, // We'll implement file size detection later
          uploadedAt: new Date().toISOString(),
          stage: 'ARRANGING',
          url: `${BASE_URL}${mediaPath}`
        });
      });
    }

    // Process packaging media
    if (order.packagingMedia && Array.isArray(order.packagingMedia)) {
      order.packagingMedia.forEach((mediaPath, index) => {
        attachments.push({
          id: `packaging-${index + 1}`,
          filename: mediaPath.split('/').pop() || mediaPath,
          originalName: mediaPath.split('/').pop() || mediaPath,
          mimeType: getMimeType(mediaPath),
          size: 0,
          uploadedAt: new Date().toISOString(),
          stage: 'PACKAGING',
          url: `${BASE_URL}${mediaPath}`
        });
      });
    }

    // Process transit media
    if (order.transitMedia && Array.isArray(order.transitMedia)) {
      order.transitMedia.forEach((mediaPath, index) => {
        attachments.push({
          id: `transit-${index + 1}`,
          filename: mediaPath.split('/').pop() || mediaPath,
          originalName: mediaPath.split('/').pop() || mediaPath,
          mimeType: getMimeType(mediaPath),
          size: 0,
          uploadedAt: new Date().toISOString(),
          stage: 'TRANSIT',
          url: `${BASE_URL}${mediaPath}`
        });
      });
    }

    return {
      success: true,
      message: 'Attachments retrieved successfully',
      data: attachments
    };

  } catch (error) {
    console.error('Get manager order attachments error:', error);
    return {
      success: false,
      message: error.message || 'Failed to retrieve attachments'
    };
  }
};

module.exports = {
  getOrderAttachments,
  getManagerOrderAttachments
};
