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

// Get all orders for branch users (branch-wide orders) - MUST be at the TOP to avoid conflicts
// Fixed route conflict issue - moved to very top to prevent Express from treating 'branch-orders' as :orderId parameter
// MINIMAL TEST ROUTE - just return simple JSON
router.get('/branch-orders', requireBranchUser, (req, res) => {
  console.log('🔍 BRANCH-ORDERS ROUTE HIT! MINIMAL TEST');
  return res.json({
    success: true,
    message: 'BRANCH-ORDERS ROUTE WORKS!',
    timestamp: new Date().toISOString(),
    user: req.user
  });
});

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

// Fetch per-order issues (keep below arranging-stage)
router.get('/:orderId/issues', getOrderIssuesController);

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
