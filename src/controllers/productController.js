const { syncProductsFromBoxHero } = require('../services/boxHeroService');
const { getItemBySku } = require("../services/productService.js");
const prisma = require('../lib/prisma'); // reuse shared prisma client

/**
 * Refresh products from BoxHero API
 * POST /api/products/refresh
 */
const refreshProducts = async (req, res) => {
  try {
    console.log('🔄 Starting product refresh from BoxHero...');
    
    // Call the BoxHero sync service
    const result = await syncProductsFromBoxHero();
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        syncedProducts: result.syncedProducts,
        totalProducts: result.totalProducts,
        errors: result.errors
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Product refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh products from BoxHero',
      error: error.message
    });
  }
};

/**
 * Get all products with optional filtering
 * GET /api/products
 * (Kept for completeness, but not used by the corrected client code)
 */
const getProducts = async (req, res) => {
  try {
    // Validation schema for query parameters
    const Joi = require('joi');
    const schema = Joi.object({
      search: Joi.string().optional().allow(''),
      category: Joi.string().optional().allow(''),
      stockStatus: Joi.string().valid('all', 'in-stock', 'low-stock', 'out-of-stock').optional(),
      targetLocation: Joi.string().optional().allow(''),
      sortBy: Joi.string().optional(),
      sortOrder: Joi.string().valid('asc', 'desc').optional(),
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().integer().min(1).max(100).optional()
    });

    const { error, value } = schema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { search, category, stockStatus, targetLocation, sortBy, sortOrder, page = 1, limit = 20 } = value;
    const skip = (page - 1) * limit;

    // Build where clause for filtering
    const where = {
      isActive: true
    };

    // Search filter
    if (search) {
      // --- FIX: Removed 'mode: insensitive' which is not supported by MySQL ---
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
      ];
    }

    // Category filter - use LIKE to match items containing the category
    if (category) {
      where.category = { contains: category };
    }

    // Target location filter - use LIKE to match items containing the location
    if (targetLocation) {
      where.targetLocation = { contains: targetLocation };
    }

    // Stock status filter
    if (stockStatus && stockStatus !== 'all') {
      switch (stockStatus) {
        case 'in-stock':
          where.currentStock = { gt: 0 };
          break;
        case 'low-stock':
          // Simple definition of "low stock": 1-10 units
          where.AND = [
            { currentStock: { gt: 0 } },
            { currentStock: { lte: 10 } }
          ];
          break;
        case 'out-of-stock':
          where.currentStock = 0;
          break;
      }
    }

    // Build orderBy clause for sorting
    const orderBy = [];
    if (sortBy && sortOrder) {
      orderBy.push({ [sortBy]: sortOrder });
    } else {
      orderBy.push({ name: 'asc' }); // default sorting
    }

    // Get items with pagination
    const [items, totalCount] = await Promise.all([
      prisma.item.findMany({
        where,
        include: {
          branch: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy,
        skip,
        take: limit
      }),
      prisma.item.count({ where })
    ]);

    // --- FIX: Convert Decimal (string) to Number before sending JSON ---
    const itemsWithNumbers = items.map(item => ({
      ...item,
      cost: item.cost ? parseFloat(item.cost) : null,
      price: item.price ? parseFloat(item.price) : null
    }));
    // --- End of Fix ---

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      success: true,
      data: {
        products: itemsWithNumbers, // Send the fixed items
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNextPage,
          hasPrevPage,
          limit
        }
      }
    });

  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching products.'
    });
  }
};

/**
 * Get all unique product categories
 * GET /api/products/categories
 */
const getProductCategories = async (req, res) => {
  try {
    const categories = await prisma.item.findMany({
      where: {
        isActive: true,
        category: { not: null }
      },
      select: {
        category: true
      }
    });

    // Some records may store multiple categories in a comma-separated string.
    // Split, trim, and return unique, case-insensitive values.
    const rawList = categories
      .map(item => item.category)
      .filter(Boolean);

    const splitAndClean = rawList
      .flatMap(cat => String(cat).split(','))
      .map(s => s.trim())
      .filter(Boolean);

    const seen = new Set();
    const unique = [];
    for (const value of splitAndClean) {
      const key = value.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(value);
      }
    }

    unique.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    res.json({
      success: true,
      data: unique
    });

  } catch (error) {
    console.error('Get product categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching product categories.'
    });
  }
};

/**
 * Get all unique target locations
 * GET /api/products/target-locations
 */
const getAllTargetLocations = async (req, res) => {
  try {
    const locations = await prisma.item.findMany({
      where: {
        isActive: true,
        targetLocation: { not: null }
      },
      select: {
        targetLocation: true
      }
    });

    // Handle comma-separated values; split, trim, unique (case-insensitive)
    const rawList = locations
      .map(item => item.targetLocation)
      .filter(Boolean);

    const splitAndClean = rawList
      .flatMap(loc => String(loc).split(','))
      .map(s => s.trim())
      .filter(Boolean);

    const seen = new Set();
    const unique = [];
    for (const value of splitAndClean) {
      const key = value.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(value);
      }
    }

    unique.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    res.json({
      success: true,
      data: unique
    });

  } catch (error) {
    console.error('Get target locations error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching target locations.'
    });
  }
};


/**
 * Fetch products directly from BoxHero API
 * GET /api/products/fetch-boxhero
 */
const fetchBoxHeroProducts = async (req, res) => {
  try {
    console.log('🔄 Fetching products directly from BoxHero API...');
    
    // Call the BoxHero sync service
    const result = await syncProductsFromBoxHero();
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        syncedProducts: result.syncedProducts,
        totalProducts: result.totalProducts,
        errors: result.errors
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Fetch BoxHero products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products from BoxHero',
      error: error.message
    });
  }
};

/**
 * Get products that match any of the target locations allowed for a branch
 * GET /api/products/by-branch-target-locations
 * Query params: branchId (optional - defaults to authenticated user's branch), page, limit, search, category, stockStatus, sortBy, sortOrder
 */
const getProductsByBranchTargetLocations = async (req, res) => {
  try {
    const Joi = require('joi');
    const schema = Joi.object({
      branchId: Joi.string().optional().allow(''),
      search: Joi.string().optional().allow(''),
      category: Joi.string().optional().allow(''),
      stockStatus: Joi.string().valid('all', 'in-stock', 'low-stock', 'out-of-stock').optional(),
      // The fix for the 400 error is in the client, but the server validation schema needs to be robust.
      // Joi will automatically coerce the value from the query string to a string.
      targetLocation: Joi.string().optional().allow(''), 
      sortBy: Joi.string().optional(),
      sortOrder: Joi.string().valid('asc', 'desc').optional(),
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().integer().min(1).max(100).optional()
    });

    const { error, value } = schema.validate(req.query);
    if (error) {
      // The request sent `targetLocation=%22Conjuring%22`. If we had not fixed the client,
      // Joi would see the value as '"Conjuring"'. This validation catches it:
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(d => d.message)
      });
    }

    const { branchId: qBranchId, search, category, stockStatus, sortBy, sortOrder, page = 1, limit = 20, targetLocation: queryTargetLocation } = value;
    const skip = (page - 1) * limit;

    const branchId = qBranchId && qBranchId.trim() !== '' ? qBranchId : (req.user && req.user.branchId);
    if (!branchId) {
      // Assuming req.user is populated by middleware and contains branchId
      return res.status(400).json({ success: false, message: 'branchId is required (or user must belong to a branch)' });
    }

    // Fetch allowed target locations for the branch
    const locations = await prisma.branchTargetLocation.findMany({
      where: { branchId },
      select: { location: true }
    });

    const branchLocations = locations.map(l => String(l.location).trim()).filter(Boolean);

    if (branchLocations.length === 0) {
      // Return empty result set with pagination info if branch has no assigned locations
      return res.json({
        success: true,
        data: {
          products: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            totalCount: 0,
            hasNextPage: false,
            hasPrevPage: page > 1,
            limit
          }
        }
      });
    }

    // Build where clause
    const where = { isActive: true };

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } }
      ];
    }

    // Category filter
    if (category) {
      where.category = { contains: category };
    }
    
    // --- COMBINED TARGET LOCATION FILTER LOGIC ---
    let locationsToFilterBy = branchLocations;

    // If the user selected a specific location filter, narrow the list down to that location
    if (queryTargetLocation) {
        // Since we are cleaning the quotes on the client, queryTargetLocation should be clean here.
        // We filter the query to only match items that contain the requested queryTargetLocation string.
        locationsToFilterBy = [queryTargetLocation];
    }
    
    // Target location match: item.targetLocation may be comma-separated; match if it contains any location from the filtered list.
    const tlConditions = locationsToFilterBy.map(loc => ({ targetLocation: { contains: loc } }));
    
    if (tlConditions.length === 1) {
      // single condition
      where.AND = where.AND ? [...where.AND, tlConditions[0]] : [tlConditions[0]];
    } else if (tlConditions.length > 1) {
      where.AND = where.AND ? [...where.AND, { OR: tlConditions }] : [{ OR: tlConditions }];
    }
    // --- END COMBINED TARGET LOCATION FILTER LOGIC ---


    // Stock status
    if (stockStatus && stockStatus !== 'all') {
      switch (stockStatus) {
        case 'in-stock':
          where.currentStock = { gt: 0 };
          break;
        case 'low-stock':
          where.AND = where.AND ? [...where.AND, { currentStock: { gt: 0 } }, { currentStock: { lte: 10 } }] : [{ currentStock: { gt: 0 } }, { currentStock: { lte: 10 } }];
          break;
        case 'out-of-stock':
          where.currentStock = 0;
          break;
      }
    }


    // Sorting
    const orderBy = [];
    if (sortBy && sortOrder) {
      orderBy.push({ [sortBy]: sortOrder });
    } else {
      orderBy.push({ name: 'asc' });
    }

    // Query items
    const [items, totalCount] = await Promise.all([
      prisma.item.findMany({
        where,
        include: { branch: { select: { id: true, name: true } } },
        orderBy,
        skip,
        take: limit
      }),
      prisma.item.count({ where })
    ]);

    const itemsWithNumbers = items.map(item => ({
      ...item,
      cost: item.cost ? parseFloat(item.cost) : null,
      price: item.price ? parseFloat(item.price) : null
    }));

    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return res.json({
      success: true,
      data: {
        products: itemsWithNumbers,
        pagination: { currentPage: page, totalPages, totalCount, hasNextPage, hasPrevPage, limit }
      }
    });

  } catch (error) {
    console.error('getProductsByBranchTargetLocations error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while fetching products by branch target locations.' });
  }
};



const getItemBySkuController = async (req, res) => {
  try {
    const { sku } = req.params;

    if (!sku) {
      return res.status(400).json({ success: false, message: "SKU is required." });
    }

    const result = await getItemBySku(sku);

    if (!result.success) {
      return res.status(404).json({ success: false, message: result.message });
    }

    res.json({ success: true, data: result.data });
  } catch (error) {
    console.error("getItemBySkuController error:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};


module.exports = {
  refreshProducts,
  getProducts,
  getProductCategories,
  getAllTargetLocations,
  getProductsByBranchTargetLocations,
  getItemBySkuController,
  fetchBoxHeroProducts
};