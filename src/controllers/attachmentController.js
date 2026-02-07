const { getOrderAttachments, getManagerOrderAttachments } = require('../services/attachmentService');

/**
 * Get attachments for an order
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getOrderAttachmentsController = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    // Validate input
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    // Get attachments
    const result = await getOrderAttachments(orderId, userId);

    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        success: false,
        message: result.message
      });
    }

    res.json(result);

  } catch (error) {
    console.error('Get order attachments controller error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving attachments'
    });
  }
};

/**
 * Get attachments for an order (manager access)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getManagerOrderAttachmentsController = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Validate input
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    // Get attachments (manager access)
    const result = await getManagerOrderAttachments(orderId, userId, userRole);

    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        success: false,
        message: result.message
      });
    }

    res.json(result);

  } catch (error) {
    console.error('Get manager order attachments controller error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving attachments'
    });
  }
};

module.exports = {
  getOrderAttachmentsController,
  getManagerOrderAttachmentsController
};
