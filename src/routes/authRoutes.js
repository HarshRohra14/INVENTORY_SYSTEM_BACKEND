const express = require('express');
const router = express.Router();

// Import controllers
const {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  logout
} = require('../controllers/authController');

// Import middleware
const authMiddleware = require('../middleware/authMiddleware');
const { requireAdmin, requireManager } = require('../middleware/roleMiddleware');

/**
 * Authentication Routes
 * 
 * POST /api/auth/register - Register new user (Admin/Manager only)
 * POST /api/auth/login - Login user
 * GET /api/auth/profile - Get current user profile
 * PUT /api/auth/profile - Update current user profile
 * PUT /api/auth/change-password - Change password
 * POST /api/auth/logout - Logout user
 */

// Public routes
router.post('/login', login);
router.post('/logout', logout);

// Protected routes (require authentication)
router.use(authMiddleware);

// User profile routes
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/change-password', changePassword);

// Admin/Manager only routes
router.post('/register', requireManager, register);

module.exports = router;
