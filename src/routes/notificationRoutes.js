const express = require('express');
const router = express.Router();

// Middleware
const authMiddleware = require('../middleware/authMiddleware');
const { requireManager } = require('../middleware/roleMiddleware');

// Controllers
const {
  getMyNotifications,
  markNotificationsRead,
  broadcastNotifications,
  getBranchUsers,
} = require('../controllers/notificationController');

// All routes require authentication
router.use(authMiddleware);

// Get current user's notifications
router.get('/me', getMyNotifications);

// Mark notifications as read
router.post('/mark-read', markNotificationsRead);

// Broadcast (MANAGER/ADMIN only)
router.post('/broadcast', requireManager, broadcastNotifications);

// Fetch branch users for selection (MANAGER/ADMIN only)
router.get('/branch-users', requireManager, getBranchUsers);

module.exports = router;


