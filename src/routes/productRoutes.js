
const express = require('express');
 const router = express.Router();

// Import controllers
const {
  refreshProducts,
  getProducts,
  getProductCategories,
  getAllTargetLocations,
  getProductsByBranchTargetLocations,
  fetchBoxHeroProducts, 
  getItemBySkuController
} = require('../controllers/productController');

// Import middleware
const authMiddleware = require('../middleware/authMiddleware');

/**
 * Product Routes
 * 
 * POST /api/products/refresh - Refresh products from BoxHero API (All authenticated users)
 * GET  /api/products - Get all products with filtering and pagination
 * GET  /api/products/categories - Get all unique product categories
 * GET  /api/products/fetch-boxhero - Fetch products directly from BoxHero API
 */

// All routes require authentication except by-sku
router.get("/by-sku/:sku", getItemBySkuController);
router.use(authMiddleware);

// Refresh products route (All authenticated users)
router.post('/refresh', refreshProducts);

// Public product routes (authenticated users only)
router.get('/', getProducts);
router.get('/categories', getProductCategories);
router.get('/target-locations', getAllTargetLocations);
router.get('/by-branch-target-locations', getProductsByBranchTargetLocations);
router.get('/fetch-boxhero', fetchBoxHeroProducts);
module.exports = router;
