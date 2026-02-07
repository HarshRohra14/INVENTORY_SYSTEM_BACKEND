const express = require('express');
const router = express.Router();

// Import controllers
const {
  getItems,
  getCategories,
  getItemById
} = require('../controllers/itemController');

// Import middleware
const authMiddleware = require('../middleware/authMiddleware');

/**
 * Item Routes
 * 
 * GET /api/items - Get all items with filtering and pagination
 * GET /api/items/categories - Get all unique categories
 * GET /api/items/:id - Get a single item by ID
 */

// All routes require authentication
router.use(authMiddleware);

// Public item routes (authenticated users only)
router.get('/', getItems);
router.get('/categories', getCategories);
router.get('/:id', getItemById);

module.exports = router;
