const express = require('express');
const router = express.Router();

// Import controllers
const {
  createOrderController,
  getMyOrders,
  getBranchOrders,
  getOrderByIdController,
  getManagerPendingOrdersController,
  approveOrderController,
  dispatchOrderController,
  confirmOrderController,
  raiseOrderIssueController,
  getOrderIssuesController,
  managerReplyController,
  updateOrderStatusController,
  confirmOrderReceivedController,
  confirmManagerReplyController
} = require('../controllers/orderController');

const { updateArrangingStageController, updateArrangingRemarksController } = require('../controllers/orderController');
const { getOrderAttachmentsController, getManagerOrderAttachmentsController } = require('../controllers/attachmentController');

// Import middleware
const authMiddleware = require('../middleware/authMiddleware');
const { upload } = require('../middleware/multerConfig');
const {
  requireBranchUser,
  requireManager,
  roleMiddleware
} = require('../middleware/roleMiddleware');

// 🔐 All routes require authentication
router.use(authMiddleware);

/**
 * IMPORTANT FIX:
 * Place arranging-stage BEFORE /:id
 * otherwise Express treats "arranging-stage" as :id
 * and sends request to getOrderByIdController → fails → 401
 */
router.put(
  '/arranging-stage/:orderId',
  roleMiddleware(['ADMIN', 'MANAGER']),
  // accept files when changing arranging stage
  upload.array('files', 20),
  updateArrangingStageController
);

// Add arranging remarks endpoint
router.put(
  '/arranging-remarks/:orderId',
  roleMiddleware(['ADMIN', 'MANAGER']),
  updateArrangingRemarksController
);

// Create order (BRANCH_USER only)
router.post('/', requireBranchUser, createOrderController);

// Get user's orders
router.get('/my-orders', getMyOrders);

// Manager-specific routes
router.get(
  '/manager/pending',
  roleMiddleware(['ADMIN', 'MANAGER', 'PACKAGER', 'DISPATCHER']),
  getManagerPendingOrdersController
);

router.put('/approve/:orderId', requireManager, approveOrderController);
router.put('/dispatch/:orderId', requireManager, upload.array('files', 20), dispatchOrderController);
router.put('/reply/:orderId', requireManager, managerReplyController);

// Update status
router.put(
  '/update-status/:orderId',
  roleMiddleware(['ADMIN', 'MANAGER', 'PACKAGER', 'DISPATCHER', 'BRANCH_USER']),
  // accept files when changing status
  upload.array('files', 20),
  updateOrderStatusController
);

// Note: Manual close route removed (auto-close enabled)

// Branch confirmation routes
router.put('/confirm/:orderId', requireBranchUser, confirmOrderController);
router.put('/raise-issue/:orderId', requireBranchUser, raiseOrderIssueController);
router.put('/confirm-manager-reply/:orderId', requireBranchUser, confirmManagerReplyController);
router.put('/confirm-received/:orderId', requireBranchUser, upload.array('media', 20), confirmOrderReceivedController);

// Post-delivery issue thread (branch users create)
router.put('/post-delivery-issue/:orderId', requireBranchUser, upload.array('files', 20), require('../controllers/orderController').postDeliveryIssueController);

// Report received item-wise issues with per-item media (FormData)
router.put('/report-received-issues/:orderId', requireBranchUser, upload.any(), require('../controllers/orderController').reportReceivedIssuesController);

// Get all orders for branch users (branch-wide orders) - MUST be before /:orderId routes
// Fixed route conflict issue - moved before /:orderId to prevent Express from treating 'branch-orders' as :orderId parameter
router.get('/branch-orders', requireBranchUser, (req, res) => {
  console.log('🔍 BRANCH-ORDERS ROUTE HIT!');
  return getBranchOrders(req, res);
});

// Fetch per-order issues (keep below arranging-stage)
router.get('/:orderId/issues', getOrderIssuesController);

// Test endpoint
router.get('/test', (req, res) => {
  console.log('🔍 TEST ENDPOINT HIT - Server is working!');
  res.json({ 
    success: true, 
    message: 'Server is working!',
    timestamp: new Date().toISOString()
  });
});

// Get attachments for an order
router.get('/:orderId/attachments', authMiddleware, getOrderAttachmentsController);

// Get attachments for an order (manager access)
router.get('/:orderId/attachments/manager', requireManager, getManagerOrderAttachmentsController);

// Get specific order (must be LAST)
router.get('/:id', (req, res) => {
  console.log('🔍 /:id ROUTE HIT with ID:', req.params.id);
  return getOrderByIdController(req, res);
});

module.exports = router;
