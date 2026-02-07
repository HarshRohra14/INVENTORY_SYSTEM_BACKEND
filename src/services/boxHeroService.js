const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = require('../lib/prisma'); // reuse shared prisma client

/**
 * Helper function to truncate long messages for database storage
 * @param {string} message - The message to truncate
 * @param {number} maxLength - Maximum length (default: 1000)
 * @returns {string} - Truncated message
 */
const truncateMessage = (message, maxLength = 1000) => {
  if (!message || typeof message !== 'string') return '';
  if (message.length <= maxLength) return message;
  return message.substring(0, maxLength - 3) + '...';
};

/**
 * Helper function to extract values from BoxHero attrs array
 * @param {Array} attrs - The attrs array from BoxHero API response
 * @param {string} attrName - The name of the attribute to extract
 * @returns {any} - The value of the attribute or null if not found
 */
const extractAttrValue = (attrs, attrName) => {
  if (!Array.isArray(attrs)) return null;
  
  const attr = attrs.find(a => a.name === attrName);
  if (!attr) return null;
  
  // Handle different data types
  if (attr.type === 'number') {
    return parseInt(attr.value) || null;
  }
  
  return attr.value || null;
};

// Rate limiting configuration
const RATE_LIMIT_DELAY = 1000; // 1 second delay between requests
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds delay between retries

/**
 * Sleep utility for rate limiting
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Make API request with retry logic and rate limiting using axios
 */
const makeApiRequest = async (url, options = {}, retryCount = 0) => {
  try {
    // Add rate limiting delay
    if (retryCount > 0) {
      await sleep(RATE_LIMIT_DELAY);
    }

    console.log(`🌐 Making API request to: ${url}`);
    console.log(`🔑 Using token: ${process.env.BOXHERO_API_TOKEN ? 'Set' : 'Not set'}`);

    const response = await axios({
      method: options.method || 'GET',
      url: url,
      headers: {
        'Authorization': `Bearer ${process.env.BOXHERO_API_TOKEN}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers
      },
      data: options.body,
      timeout: 30000 // 30 second timeout
    });

    console.log(`📡 Response status: ${response.status} ${response.statusText}`);

    return response.data;

  } catch (error) {
    console.error(`❌ API request error: ${error.message}`);
    
    // Handle rate limiting (429 status)
    if (error.response && error.response.status === 429) {
      if (retryCount < MAX_RETRIES) {
        const retryAfter = error.response.headers['retry-after'] || 2;
        console.log(`⏳ Rate limited, retrying in ${retryAfter} seconds... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        await sleep(retryAfter * 1000);
        return makeApiRequest(url, options, retryCount + 1);
      } else {
        throw new Error('Rate limit exceeded after maximum retries');
      }
    }

    // Handle other HTTP errors
    if (error.response) {
      const errorText = error.response.data || error.message;
      throw new Error(`API request failed: ${error.response.status} ${error.response.statusText} - ${errorText}`);
    }

    // Handle network errors
    if (retryCount < MAX_RETRIES && error.code === 'ECONNABORTED') {
      console.log(`🔄 Network timeout, retrying in ${RETRY_DELAY}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
      await sleep(RETRY_DELAY);
      return makeApiRequest(url, options, retryCount + 1);
    }

    throw error;
  }
};

/**
 * Sync products from BoxHero API with pagination and filtering
 * * This function will:
 * 1. Call BoxHero's GET /products endpoint with pagination
 * 2. Filter items with Visibility = "Listed"
 * 3. Clear old data and insert new products into our local Item table
 * 4. Handle rate limiting and retries
 * * @param {string} cursor - Pagination cursor (optional)
 * @returns {Object} Result of the sync operation
 */
const syncProductsFromBoxHero = async (cursor = null) => {
  try {
    console.log('🔄 Starting BoxHero products sync...');
    
    if (!process.env.BOXHERO_API_TOKEN) {
      throw new Error('BOXHERO_API_TOKEN environment variable is not set');
    }

    // --- FIX P2003: Foreign Key Violation ---
    // Capture existing items map so we can detect 0 -> >0 transitions
    console.log('🔎 Capturing existing products before clearing...');
    const existingItems = await prisma.item.findMany({ select: { sku: true, currentStock: true } });
    const existingMap = {};
    for (const it of existingItems) existingMap[it.sku] = it.currentStock;

    // Clear all existing products from database first
    console.log('🗑️ Clearing existing products from database...');
    const deletedCount = await prisma.item.deleteMany({});
    console.log(`✅ Cleared ${deletedCount.count} existing products`);
    // ----------------------------------------

    let allItems = [];
    let currentCursor = cursor;
    let attempt = 1;
    const limit = 100;
    let loggedRawItem = false;

    // Fetch all pages of products from BoxHero API
    while (true) {
      const url = new URL("https://rest.boxhero-app.com/v1/items");
      url.searchParams.append("limit", limit);
      if (currentCursor) url.searchParams.append("cursor", currentCursor);

      console.log(`➡️ Attempt ${attempt}: Fetching ${url.href}`);
      attempt++;

      const data = await makeApiRequest(url.href, {
        method: 'GET'
      });
      
      if (Array.isArray(data.items)) {
        // --- LOG RAW DATA STRUCTURE (REQUESTED) ---
        if (!loggedRawItem && data.items.length > 0) {
            console.log('--- 🔍 RAW BOXHERO ITEM STRUCTURE (FIRST ITEM W/ ATTRS) ---');
            console.log(JSON.stringify(data.items[0], null, 2)); 
            console.log('------------------------------------------------------------');
            loggedRawItem = true;
        }
        // ------------------------------------------

        // Filter items with Visibility = "Listed" using attrs array
        const listedItems = data.items.filter(
          (item) =>
            Array.isArray(item.attrs) &&
            item.attrs.some(
              (attr) =>
                (attr.Id === 794461 || attr.name === "Visibility") &&
                attr.value === "Listed"
            )
        );
        
        console.log(`📦 Found ${data.items.length} items, ${listedItems.length} with Visibility = "Listed"`);
        allItems.push(...listedItems);
      }

      if (!data.cursor) break;
      currentCursor = data.cursor;

      // Throttle requests to avoid hitting rate limits
      await new Promise((resolve) => setTimeout(resolve, 500)); // 0.5 sec delay
    }

    console.log(`📦 Total products to sync: ${allItems.length}`);
    
    // Insert all products into database
    let syncedCount = 0;
    let errorCount = 0;

    if (allItems.length > 0) {
      // Batch insert for better performance
      const productsToInsert = allItems.map(item => {
        // Extract values from attrs array
        const safetyStock = extractAttrValue(item.attrs, 'Safety Stock');
        const targetLocation = extractAttrValue(item.attrs, 'Target Location');
        const storageLocation = extractAttrValue(item.attrs, 'Storage');
        const unit = extractAttrValue(item.attrs, 'Unit');
        const category = extractAttrValue(item.attrs, 'Category');
        const dimension = extractAttrValue(item.attrs, 'Dimension');
        
        return {
          // FIX: Ensure boxHeroId is always a String for Prisma
          boxHeroId: String(item.id || item.Id || item.itemId), 
          name: item.name || item.itemName || 'Unknown Product',
          sku: item.sku || item.itemSku || null,
          category: category || item.category || item.itemCategory || null,
          unit: unit || item.unit || item.itemUnit || null,
          currentStock: parseInt(item.currentStock || item.stock || item.quantity || 0),
          visibility: 'Listed', // We already filtered for Listed items
          isActive: true, // Explicitly set to active
          // New fields from BoxHero API
          photoUrl: item.photo_url || null,
          cost: item.cost ? parseFloat(item.cost) : null,
          price: item.price ? parseFloat(item.price) : null,
          safetyStock: safetyStock,
          targetLocation: targetLocation,
          storageLocation: storageLocation,
          dimension: dimension,
          lastSyncedAt: new Date()
        };
      });

      try {
        // Debug: Log first product to insert
        console.log('🔍 Debug - First item to insert:', JSON.stringify(productsToInsert[0], null, 2));
        
        // Use prisma.item now that the Product model is removed
        await prisma.item.createMany({
          data: productsToInsert,
          skipDuplicates: true
        });
        
        syncedCount = productsToInsert.length;
        console.log(`✅ Successfully inserted ${syncedCount} products into database`);

        // Notify users if any SKU moved from 0 -> positive stock
        try {
          const { notifyItemBackInStock } = require('./notificationService');
          for (const p of productsToInsert) {
            const old = existingMap[p.sku];
            const nowStock = Number(p.currentStock || 0);
            if ((old === 0 || typeof old === 'undefined') && nowStock > 0) {
              // fire-and-forget
              notifyItemBackInStock(p.sku).catch(err => console.error('notifyItemBackInStock error:', err));
            }
          }
        } catch (notifyErr) {
          console.error('Failed to run stock-available notifications:', notifyErr);
        }
      } catch (batchError) {
        console.error('❌ Batch insert failed, trying individual inserts:', batchError);
        console.error('❌ Batch error details:', truncateMessage(batchError.message));
        
        // Fallback to individual inserts
        for (const item of allItems) {
          try {
            // Extract values from attrs array
            const safetyStock = extractAttrValue(item.attrs, 'Safety Stock');
            const targetLocation = extractAttrValue(item.attrs, 'Target Location');
            const storageLocation = extractAttrValue(item.attrs, 'Storage');
            const unit = extractAttrValue(item.attrs, 'Unit');
            const category = extractAttrValue(item.attrs, 'Category');
            const dimension = extractAttrValue(item.attrs, 'Dimension');
            
            await prisma.item.create({
              data: {
                boxHeroId: String(item.id || item.Id || item.itemId), 
                name: item.name || item.itemName || 'Unknown Product',
                sku: item.sku || item.itemSku || null,
                category: category || item.category || item.itemCategory || null,
                unit: unit || item.unit || item.itemUnit || null,
                currentStock: parseInt(item.currentStock || item.stock || item.quantity || 0),
                visibility: 'Listed',
                // New fields from BoxHero API
                photoUrl: item.photo_url || null,
                cost: item.cost ? parseFloat(item.cost) : null,
                price: item.price ? parseFloat(item.price) : null,
                safetyStock: safetyStock,
                targetLocation: targetLocation,
                storageLocation: storageLocation,
                dimension: dimension,
                lastSyncedAt: new Date()
              }
            });
            syncedCount++;
          } catch (itemError) {
            errorCount++;
            // Only log the message for individual errors
            console.error(`❌ Error inserting item ${item.id}:`, truncateMessage(itemError.message, 250));
          }
        }
      }
    }

    console.log(`✅ BoxHero products sync completed: ${syncedCount} synced, ${errorCount} errors`);

    // // Create a system notification about the sync
    // await prisma.notification.create({
    //   data: {
    //     type: 'SYSTEM_ALERT',
    //     title: 'Products Sync Completed',
    //     // FIX P2000: Truncate message
    //     message: truncateMessage(`Successfully synced ${syncedCount} products from BoxHero${errorCount > 0 ? ` (${errorCount} errors)` : ''}`),
    //     isRead: false
    //   }
    // });

    return {
      success: true,
      message: `Successfully synced ${syncedCount} products`,
      syncedProducts: syncedCount,
      totalProducts: allItems.length,
      errors: errorCount,
      pages: attempt - 1
    };

  } catch (error) {
    console.error('❌ BoxHero products sync failed:', error);

    // // Create an error notification
    // await prisma.notification.create({
    //   data: {
    //     type: 'SYSTEM_ALERT',
    //     title: 'Products Sync Failed',
    //     // FIX P2000: Truncate message
    //     message: truncateMessage(`Failed to sync products from BoxHero: ${error.message}`),
    //     isRead: false
    //   }
    // });

    return {
      success: false,
      message: 'Failed to sync products from BoxHero',
      error: error.message
    };
  }
};

/**
 * Update stock levels in BoxHero
 * * @param {Array} itemsToUpdate - Array of objects with { itemId, quantityToDeduct }
 * @returns {Object} Result of the update operation
 */
const updateBoxHeroStock = async (itemsToUpdate) => {
  try {
    console.log('📤 Updating BoxHero stock levels...');
    console.log('Items to update:', itemsToUpdate);

    const url = `${process.env.BOXHERO_BASE_URL || 'https://api.boxhero.com'}/stock/update`;
    
    const response = await makeApiRequest(url, {
      method: 'POST',
      body: JSON.stringify({
        updates: itemsToUpdate.map(item => ({
          itemId: item.itemId,
          quantityChange: -item.quantityToDeduct, // Negative because we're deducting
          reason: 'Order Dispatch'
        }))
      })
    });

    if (!response.success) {
      throw new Error(response.message || 'Failed to update stock levels in BoxHero');
    }

    console.log('✅ BoxHero stock update completed');
    console.log(`Updated ${response.updatedItems || itemsToUpdate.length} items`);

    // Update our local records to reflect the changes
    for (const itemUpdate of itemsToUpdate) {
      try {
        // Find the item by BoxHero ID (convert to string)
        const item = await prisma.item.findUnique({
          where: { boxHeroId: String(itemUpdate.itemId) }
        });

        if (item) {
          // Update the local stock level
          const prev = item.currentStock;
          const newStock = Math.max(0, item.currentStock - itemUpdate.quantityToDeduct);

          await prisma.item.update({
            where: { id: item.id },
            data: {
              currentStock: newStock,
              lastSyncedAt: new Date()
            }
          });

          console.log(`📉 Updated local stock for ${item.name}: -${itemUpdate.quantityToDeduct} (now ${newStock})`);

          // If stock moved from 0 -> positive (unlikely on deduction), notify (safety)
          if (prev === 0 && newStock > 0) {
            try {
              const { notifyItemBackInStock } = require('./notificationService');
              notifyItemBackInStock(item.sku).catch(e => console.error('notifyItemBackInStock err:', e));
            } catch (err) {
              console.error('Failed to call notifyItemBackInStock:', err);
            }
          }
        }
      } catch (itemError) {
        console.error(`❌ Error updating local stock for item ${itemUpdate.itemId}:`, itemError);
      }
    }

    return {
      success: true,
      message: 'Stock levels updated successfully in BoxHero',
      updatedItems: itemsToUpdate.length
    };

  } catch (error) {
    console.error('❌ BoxHero stock update failed:', error);

    return {
      success: false,
      message: 'Failed to update stock levels in BoxHero',
      error: error.message
    };
  }
};

/**
 * Get current stock levels from BoxHero
 * * @returns {Object} Current stock levels from BoxHero
 */
const getBoxHeroStockLevels = async () => {
  try {
    console.log('📊 Fetching current stock levels from BoxHero...');

    const url = `${process.env.BOXHERO_BASE_URL || 'https://api.boxhero.com'}/stock/levels`;
    
    const response = await makeApiRequest(url, {
      method: 'GET'
    });

    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch stock levels from BoxHero');
    }

    console.log('✅ Retrieved stock levels from BoxHero');

    return {
      success: true,
      stockLevels: response.data?.stockLevels || response.stockLevels || [],
      message: 'Stock levels retrieved successfully'
    };

  } catch (error) {
    console.error('❌ Failed to fetch stock levels from BoxHero:', error);
    return {
      success: false,
      message: 'Failed to fetch stock levels from BoxHero',
      error: error.message
    };
  }
};

/**
 * Get categories from BoxHero
 * * @returns {Object} Categories from BoxHero
 */
const getBoxHeroCategories = async () => {
  try {
    console.log('📂 Fetching categories from BoxHero...');

    const url = `${process.env.BOXHERO_BASE_URL || 'https://api.boxhero.com'}/categories`;
    
    const response = await makeApiRequest(url, {
      method: 'GET'
    });

    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch categories from BoxHero');
    }

    console.log('✅ Retrieved categories from BoxHero');

    return {
      success: true,
      categories: response.data?.categories || response.categories || [],
      message: 'Categories retrieved successfully'
    };

  } catch (error) {
    console.error('❌ Failed to fetch categories from BoxHero:', error);
    return {
      success: false,
      message: 'Failed to fetch categories from BoxHero',
      error: error.message
    };
  }
};

module.exports = {
  syncProductsFromBoxHero,
  updateBoxHeroStock,
  getBoxHeroStockLevels,
  getBoxHeroCategories
};