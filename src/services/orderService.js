const { Prisma } = require('@prisma/client');
const {
  sendManagerReplyConfirmationNotification,
  sendOrderUpdatedByManagerNotification,
  sendOrderConfirmPendingNotification,
  sendOrderConfirmedNotification,
  sendOrderIssueRaisedNotification,
  sendOrderDispatchNotification,
  sendManagerReplyNotification,
  sendOrderStatusUpdateNotification,
  sendOrderReceivedNotification,
  sendOrderClosedNotification,
  sendOrderCreatedNotification,
  sendOrderCreatedNotificationToManager,
  sendBranchConfirmationToManagerNotification,
  sendBranchConfirmationReceivedNotification,
  sendBranchIssueSubmittedNotification,
  sendOrderApprovedConfirmedNotification,
  sendPackagingAssignmentNotification,
  sendPackagingStageStartedNotification,
  sendPackagingInProgressNotificationToPackager,
  sendPackagingInProgressNotificationToManager,
  sendPackagingCompletedNotificationToPackager,
  sendPackagingCompletedNotificationToManager,
  sendDispatchTaskNotification,
  sendInTransitNotificationToManager,
  sendInTransitNotificationToDispatcher,
  sendReceivedNotificationToManager,
  sendReceivedNotificationToDispatcher,
  notifyUsers
} = require('./notificationService');

const prisma = require('../lib/prisma');
const { addWorkingHours } = require('../lib/workingHours');

/**
 * Order Service
 * Contains business logic for order operations
 */

/**
 * Create a new order with order items
 * @param {Object} orderData - Order creation data
 * @param {string} orderData.requesterId - ID of the user creating the order
 * @param {string} orderData.branchId - ID of the branch
 * @param {string} orderData.remarks - Optional remarks from the user
 * @param {Array} orderData.items - Array of items with quantities
 * @returns {Object} Created order with order items
 */

const createOrder = async (orderData) => {
  try {
    const { requesterId, branchId, remarks, items, inStockItems, outOfStockItems } = orderData;

    // Support both legacy `items` (treat as in-stock) and new arrays
    const resolvedInStock = Array.isArray(inStockItems) && inStockItems.length > 0 ? inStockItems : (Array.isArray(items) ? items : []);
    const resolvedOutOfStock = Array.isArray(outOfStockItems) ? outOfStockItems : [];

    // Combined items array preserving outOfStock flag
    const combinedItems = [
      ...resolvedInStock.map(i => ({ ...i, outOfStock: false })),
      ...resolvedOutOfStock.map(i => ({ ...i, outOfStock: true }))
    ];

    // ✅ 1. Validate that all SKUs exist and are active
    const skus = combinedItems.map(item => item.sku).filter(Boolean);
    
    if (skus.length === 0) {
      throw new Error('No valid SKUs provided in the order');
    }
    
    console.log(`🔍 Looking for SKUs: ${skus.join(', ')}`);
    
    const existingItems = await prisma.item.findMany({
      where: {
        sku: { in: skus },
        isActive: true
      },
      select: {
        sku: true,
        name: true,
        currentStock: true,
        price: true,
        category: true,
        unit: true,
        boxHeroId: true
      }
    });

    console.log(`✅ Found ${existingItems.length} items out of ${skus.length} requested`);
    if (existingItems.length > 0) {
      console.log(`   Found SKUs: ${existingItems.map(i => i.sku).join(', ')}`);
    }

    if (existingItems.length !== skus.length) {
      const notFoundSkus = skus.filter(sku => !existingItems.find(i => i.sku === sku));
      throw new Error(`One or more SKUs not found or inactive. Not found: ${notFoundSkus.join(', ')}`);
    }

    // ✅ 2. Check stock availability for only in-stock items
    for (const item of combinedItems.filter(ci => !ci.outOfStock)) {
      const existingItem = existingItems.find(i => i.sku === item.sku);
      if (!existingItem) {
        throw new Error(`Item with SKU ${item.sku} not found`);
      }
      if (existingItem.currentStock < item.quantity) {
        throw new Error(`Insufficient stock for ${existingItem.name}. Available: ${existingItem.currentStock}, Requested: ${item.quantity}`);
      }
    }

    // ✅ 3. Generate order number (format: OR + 6 random alphanumeric chars, e.g., OR3X9K2M)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const randomAlphaNum = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const orderNumber = `OR${randomAlphaNum}`;

    // ✅ 4. Calculate totals (only include in-stock items in totalValue)
    const totalItems = combinedItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalValue = combinedItems.reduce((sum, item) => {
      if (item.outOfStock) return sum;
      const existingItem = existingItems.find(i => i.sku === item.sku);
      return sum + (Number(existingItem.price || 0) * item.quantity);
    }, 0);

    // ✅ 5. Create order + items in transaction
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber,
          status: 'UNDER_REVIEW',
          remarks: remarks || null,
          totalItems,
          totalValue,
          requesterId,
          branchId
        }
      });

      const orderItems = [];

      for (const item of combinedItems) {
        const existingItem = existingItems.find(i => i.sku === item.sku);
        if (!existingItem) throw new Error(`Item with SKU ${item.sku} not found`);

        const orderItem = await tx.orderItem.create({
          data: {
            orderId: order.id,
            sku: existingItem.sku,
            qtyRequested: item.quantity,
            outOfStock: item.outOfStock,
            // For out-of-stock items, do not set prices so they don't contribute to totals
            unitPrice: item.outOfStock ? null : new Prisma.Decimal(existingItem.price || 0),
            totalPrice: item.outOfStock ? null : new Prisma.Decimal(Number(existingItem.price || 0) * item.quantity)
          }
        });

        orderItems.push(orderItem);
      }

      return { order, orderItems };
    });

    // ✅ 6. Send formatted email notification to requester
    try {
      const orderWithRequesterAndBranch = await prisma.order.findUnique({
        where: { id: result.order.id },
        include: {
          requester: { select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true } },
          branch: { select: { id: true, name: true } },
          orderItems: {
            include: {
              item: { select: { id: true, name: true, sku: true, category: true, unit: true } }
            }
          }
        }
      });

      if (orderWithRequesterAndBranch && orderWithRequesterAndBranch.requester && orderWithRequesterAndBranch.requester.email) {
        // Attach item details for the notification
        const orderItemsWithDetails = orderWithRequesterAndBranch.orderItems.map((oi) => {
          const itemDetails = existingItems.find(i => i.sku === oi.sku);
          return { ...oi, item: itemDetails || null };
        });

        const completeOrderForEmail = { 
          ...orderWithRequesterAndBranch,
          totalValue: orderWithRequesterAndBranch.totalValue ? Number(orderWithRequesterAndBranch.totalValue) : 0,
          orderItems: orderItemsWithDetails 
        };

        await sendOrderCreatedNotification(completeOrderForEmail);
      }
    } catch (emailErr) {
      console.error('Failed to send formatted email notification to requester:', emailErr);
    }

    // ✅ 6.5 Send manager notifications for all managers in the branch
    try {
      const branchManagers = await prisma.managerBranch.findMany({
        where: { branchId, isActive: true },
        include: {
          manager: { select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true } }
        }
      });

      if (branchManagers && branchManagers.length > 0) {
        const orderWithDetails = await prisma.order.findUnique({
          where: { id: result.order.id },
          include: {
            requester: { select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true } },
            branch: { select: { id: true, name: true } },
            orderItems: {
              include: {
                item: { select: { id: true, name: true, sku: true, category: true, unit: true } }
              }
            }
          }
        });

        // Attach item details
        const orderItemsWithDetails = orderWithDetails.orderItems.map((oi) => {
          const itemDetails = existingItems.find(i => i.sku === oi.sku);
          return { ...oi, item: itemDetails || null };
        });

        const completeOrderForManagers = { 
          ...orderWithDetails,
          totalValue: orderWithDetails.totalValue ? Number(orderWithDetails.totalValue) : 0,
          orderItems: orderItemsWithDetails 
        };

        // Send notification to each manager
        for (const bm of branchManagers) {
          if (bm.manager && bm.manager.email) {
            try {
              await sendOrderCreatedNotificationToManager(completeOrderForManagers, bm.manager);
            } catch (managerEmailErr) {
              console.error(`Failed to send notification to manager ${bm.manager.firstName}:`, managerEmailErr);
            }
          }
        }
      }
    } catch (managerNotificationErr) {
      console.error('Failed to send manager notifications:', managerNotificationErr);
    }

    // ✅ 7. Create in-app notifications for admins, branch users and branch managers (excluding requester to avoid duplicate emails)
    try {
      const adminUsers = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
      const branchUsers = await prisma.user.findMany({ where: { branchId, isActive: true, id: { not: requesterId } }, select: { id: true } });
      const mgrs = await prisma.managerBranch.findMany({ where: { branchId }, select: { managerId: true } });

      const userIds = [
        ...adminUsers.map(a => a.id),
        ...branchUsers.map(b => b.id),
        ...mgrs.map(m => m.managerId)
      ];

      await notifyUsers(userIds, result.order.id, 'ORDER_CREATED', 'Stock/Order Request Successfully Created – Pending Manager Approval ', `Order ${result.order.orderNumber} has been created and is under review`);
    } catch (notifyErr) {
      console.error('Failed to create broadcast notifications for new order:', notifyErr);
    }

    // ✅ 7. Fetch full order with items + item details
    const order = await prisma.order.findUnique({
      where: { id: result.order.id },
      include: {
        requester: { select: { id: true, firstName: true, lastName: true, email: true } },
        branch: { select: { id: true, name: true } },
        orderItems: true
      }
    });

    // Attach item details by SKU (not foreign key)
    const orderItemsWithDetails = order.orderItems.map((oi) => {
      const itemDetails = existingItems.find(i => i.sku === oi.sku);
      return { ...oi, item: itemDetails || null };
    });

    const completeOrder = { ...order, orderItems: orderItemsWithDetails };

    return { success: true, data: completeOrder };

  } catch (error) {
    console.error('❌ Create order error:', error);
    return {
      success: false,
      message: error.message || 'Failed to create order',
      error: error.message
    };
  }   
};


/**
 * Get orders for a specific user
 * @param {string} userId - ID of the user
 * @param {Object} options - Query options
 * @returns {Object} User's orders with pagination
 */
const getUserOrders = async (userId, options = {}) => {
  try {
    const { page = 1, limit = 20, status } = options;
    const skip = (page - 1) * limit;

    // Build where clause
    const where = { requesterId: userId };
    if (status) {
      where.status = status;
    }

    // Fetch orders and total count in parallel
    const [orders, totalCount] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          branch: {
            select: {
              id: true,
              name: true
            }
          },
          orderItems: {
            select: {
              id: true,
              sku: true,
              qtyRequested: true,  // ✅ correct name
              qtyApproved: true,
              qtyReceived: true,
              unitPrice: true,
              totalPrice: true,
              createdAt: true,
              updatedAt: true
            }
          },
          // arranging fields are now stored directly on Order (arrangingStage, arrangingStartedAt, arrangingCompletedAt, sentForPackagingAt)
          
          // 🔥 ADD MEDIA FIELDS for attachment viewing
          // Note: arrangingMedia, packagingMedia, transitMedia are scalar fields and included by default
        },
        orderBy: {
          requestedAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.order.count({ where })
    ]);

    // Pagination details
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return {
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNextPage,
          hasPrevPage,
          limit
        }
      }
    };
  } catch (error) {
    console.error('Get user orders error:', error);
    return {
      success: false,
      message: 'Failed to fetch user orders',
      error: error.message
    };
  }
};


/**
 * Get all orders for a specific branch
 * @param {string} branchId - ID of the branch
 * @param {Object} options - Query options
 * @returns {Object} Branch orders with pagination
 */
const getBranchOrdersService = async (branchId, options = {}) => {
  try {
    const { page = 1, limit = 20, status } = options;
    const skip = (page - 1) * limit;

    // Build where clause for branch
    const where = { branchId: branchId };
    if (status) {
      where.status = status;
    }

    // Fetch orders and total count in parallel
    const [orders, totalCount] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          branch: {
            select: {
              id: true,
              name: true
            }
          },
          requester: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          orderItems: {
            select: {
              id: true,
              quantity: true,
              item: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  currentStock: true
                }
              }
            }
          },
          _count: {
            select: {
              orderIssues: true
            }
          }
        },
        orderBy: [
          { createdAt: 'desc' }
        ],
        skip,
        take: limit
      }),
      prisma.order.count({ where })
    ]);

    // Calculate pagination
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return {
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNextPage,
          hasPrevPage,
          limit
        }
      }
    };
  } catch (error) {
    console.error('Get branch orders error:', error);
    return {
      success: false,
      message: 'Failed to fetch branch orders',
      error: error.message
    };
  }
};


/**
 * Get a single order by ID (with authorization check)
 * @param {string} orderId - ID of the order
 * @param {string} userId - ID of the user requesting the order
 * @returns {Object} Order details
 */
const getOrderById = async (orderId, userId) => {
  try {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        requesterId: userId
      },
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        branch: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true
          }
        },
        orderItems: {
          select: {
            id: true,
            sku: true,
            qtyRequested: true,
            qtyApproved: true,
            qtyReceived: true,
            unitPrice: true,
            totalPrice: true,
            createdAt: true,
            updatedAt: true
          }
        },
        tracking: true,

        // 🔥 ADD THIS (timeline issue events)
        orderIssues: {
          select: {
            id: true,
            message: true,
            senderRole: true,
            createdAt: true,
            repliedBy: true,
            repliedAt: true,
            itemId: true
          },
          orderBy: {
            createdAt: 'asc'
          }
        },
        
        // 🔥 ADD MEDIA FIELDS for attachment viewing
        // Note: arrangingMedia, packagingMedia, transitMedia are scalar fields and included by default
      }
    });

    if (!order) {
      return {
        success: false,
        message: 'Order not found or access denied.'
      };
    }

    return {
      success: true,
      data: order
    };

  } catch (error) {
    console.error('❌ Get order by ID error:', error);
    return {
      success: false,
      message: 'Internal server error while fetching order details.',
      error: error.message
    };
  }
};



/**
 * Get pending orders for managers (orders from their assigned branches)
 * @param {string} managerId - ID of the manager
 * @param {Object} options - Query options
 * @returns {Object} Pending orders with pagination
 */
const getManagerPendingOrders = async (managerId, options = {}, actorRole = 'MANAGER') => {
  try {
    const { page = 1, limit = 20, branchId, status } = options;
    const skip = (page - 1) * limit;

    // 🧩 1. Build where clause depending on actor role
    // Managers are restricted to their assigned branches; Admin/Packager/Dispatcher can view all branches
    const where = {};

    if (actorRole === 'MANAGER') {
      // 🧩 Get manager info & assigned branches
      const manager = await prisma.user.findUnique({
        where: { id: managerId },
        select: {
          role: true,
          managedBranches: {
            where: { isActive: true },
            select: {
              branchId: true,
              branch: { select: { id: true, name: true } }
            }
          }
        }
      });

      if (!manager) throw new Error('Manager not found');

      // restrict to manager's branches (unless ADMIN)
      if (manager.role !== 'ADMIN') {
        const managedBranchIds = manager.managedBranches.map(mb => mb.branchId);
        if (managedBranchIds.length === 0) {
          return {
            success: true,
            data: {
              orders: [],
              pagination: {
                currentPage: page,
                totalPages: 0,
                totalCount: 0,
                hasNextPage: false,
                hasPrevPage: false,
                limit
              }
            }
          };
        }
        where.branchId = { in: managedBranchIds };
      }

      // Apply branch filter if provided (ensure manager has access)
      if (branchId) {
        if (manager.role === 'ADMIN') {
          where.branchId = branchId;
        } else {
          const managedBranchIds = manager.managedBranches.map(mb => mb.branchId);
          where.branchId = managedBranchIds.includes(branchId)
            ? branchId
            : '__no_match__';
        }
      }
    } else {
      // Admin, Packager, Dispatcher: can view all branches. Apply branch filter if provided.
      if (branchId) where.branchId = branchId;
    }

    // Apply status filter if provided
    //if (status) where.status = status;

    // 🔐 STATUS FILTERS (ROLE-AWARE)
    // Dispatcher: STRICT visibility
    if (actorRole === 'DISPATCHER') {
      where.status = {
        in: ['PACKAGING_COMPLETED', 'IN_TRANSIT']
      };
    }
    // Other roles: respect requested status filter
    else if (status) {
      where.status = status;
    }
  

    // 🧩 3. Fetch orders & total count
    const [orders, totalCount] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          requester: {
            select: { id: true, firstName: true, lastName: true, email: true }
          },
          branch: {
            select: { id: true, name: true, address: true, city: true, state: true }
          },
          orderItems: {
            select: { id: true, sku: true, qtyRequested: true, qtyApproved: true, qtyReceived: true, unitPrice: true, totalPrice: true }
          },
          // arranging fields are now stored directly on Order (arrangingStage, arrangingStartedAt, arrangingCompletedAt, sentForPackagingAt)
          
          // 🔥 ADD MEDIA FIELDS for attachment viewing
          // Note: arrangingMedia, packagingMedia, transitMedia are scalar fields and included by default
        },
        orderBy: { requestedAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.order.count({ where })
    ]);

    // 🧩 4. Collect all SKUs and fetch matching product info once
    // 🧩 4. Collect all SKUs and fetch matching product info once
    const allSkus = [
      ...new Set(
        orders
          .flatMap(order => order.orderItems.map(item => item.sku))
          .filter((sku) => typeof sku === "string" && sku.trim() !== "")
      ),
    ];

    // 🧩 5. Fetch only if we have valid SKUs
    let itemDetails = [];
    if (allSkus.length > 0) {
      itemDetails = await prisma.item.findMany({
        where: { sku: { in: allSkus } },
        select: {
          sku: true,
          name: true,
          category: true,
          unit: true,
          currentStock: true,
        },
      });
    }


    // Create lookup map for fast merging
    const itemMap = Object.fromEntries(itemDetails.map(i => [i.sku, i]));

    // 🧩 5. Merge item details back into orderItems
    for (const order of orders) {
      for (const orderItem of order.orderItems) {
        orderItem.item = itemMap[orderItem.sku] || null;
      }
    }

    // 🧩 6. Pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    // ✅ Return structured result
    return {
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNextPage,
          hasPrevPage,
          limit
        }
      }
    };

  } catch (error) {
    console.error('Get manager pending orders error:', error);
    return {
      success: false,
      message: 'Failed to fetch pending orders',
      error: error.message
    };
  }
};


/**
 * Approve an order with modified quantities
 * Managers can:
 * - Keep the same requested quantity
 * - Decrease quantity (partial approval)
 * - INCREASE quantity (MORE than requested) ✅ NEW FEATURE
 *
 * @param {string} orderId - ID of the order to approve
 * @param {string} approverId - ID of the manager approving
 * @param {Array} approvedItems - Array of approved items with quantities
 *   Each item: { sku: string, qtyApproved: number }
 * @returns {Object} Approved order details
 */
const approveOrder = async (orderId, approverId, approvedItems) => {
  try {
    // ✅ 1. Check order exists and is UNDER_REVIEW
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        status: 'UNDER_REVIEW',
      },
      include: {
        orderItems: true,
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!order) throw new Error('Order not found or not in UNDER_REVIEW status');

    // ✅ 2. Validate approved items - SUPPORT QUANTITY INCREASES
    // Log when manager increases quantity beyond requested
    const quantityChanges = {};
    for (const approvedItem of approvedItems) {
      const orderItem = order.orderItems.find((oi) => oi.sku === approvedItem.sku);
      if (!orderItem) throw new Error(`Order item with SKU ${approvedItem.sku} not found`);
      
      // ✅ Allow managers to approve any quantity (less, same, or MORE than requested)
      if (approvedItem.qtyApproved < 0)
        throw new Error(`Approved quantity cannot be negative for SKU ${approvedItem.sku}`);
      
      // Track quantity changes (decrease, same, or increase)
      const change = approvedItem.qtyApproved - orderItem.qtyRequested;
      quantityChanges[approvedItem.sku] = {
        requested: orderItem.qtyRequested,
        approved: approvedItem.qtyApproved,
        change: change,
        isIncreased: change > 0,
        isDecreased: change < 0
      };
      
      if (change > 0) {
        console.log(`✅ MANAGER INCREASING ORDER: SKU ${approvedItem.sku} from ${orderItem.qtyRequested} to ${approvedItem.qtyApproved} (+${change} units)`);
      }
    }

    // ✅ 3. Transaction — update order & items
    const result = await prisma.$transaction(async (tx) => {
      // Update order to CONFIRM_PENDING
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'CONFIRM_PENDING',
          approvedAt: new Date(),
          managerId: approverId,
        },
      });

      // Update each item’s qtyApproved and totalPrice
      for (const approvedItem of approvedItems) {
        const orderItem = order.orderItems.find((oi) => oi.sku === approvedItem.sku);
        if (!orderItem) continue;

        await tx.orderItem.update({
          where: { id: orderItem.id },
          data: {
            qtyApproved: approvedItem.qtyApproved,
            totalPrice:
              approvedItem.qtyApproved * (Number(orderItem.unitPrice) || 0),
          },
        });
      }

      return updatedOrder;
    });

    // ✅ 4. Create notification for requester
    try {
      await notifyUsers([order.requesterId], order.id, 'ORDER_CONFIRM_PENDING', 'Order Approval Pending Confirmation', `Your order ${order.orderNumber} has been approved and is waiting for your confirmation.`);
    } catch (err) {
      console.error('Failed to notify requester for confirm pending:', err);
    }

    // ✅ 5. Fetch full updated order
    let completeOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
        orderItems: true,
      },
    });

    // ✅ 6. Try sending email/WhatsApp
    try {
      // Send updated-by-manager notification to requester
      if (completeOrder.managerId) {
        // Fetch manager details with email
        const manager = await prisma.user.findUnique({ 
          where: { id: completeOrder.managerId }, 
          select: { 
            id: true,
            firstName: true, 
            lastName: true, 
            email: true,
            phoneNumber: true
          } 
        });
        if (manager) {
          console.log(`📧 Manager found: ${manager.firstName} ${manager.lastName}, Email: ${manager.email}`);
          console.log(`📧 Sending updated-by-manager notification for order ${completeOrder.orderNumber}`);
          await sendOrderUpdatedByManagerNotification(completeOrder, manager);
        } else {
          console.warn(`⚠️ Manager not found for managerId: ${completeOrder.managerId}`);
        }
      } else {
        console.warn(`⚠️ No managerId set for order ${completeOrder.orderNumber}`);
      }
      await sendOrderConfirmPendingNotification(completeOrder);
    } catch (err) {
      console.error('Failed to send confirm pending or updated-by-manager notifications:', err);
    }

    return {
      success: true,
      data: completeOrder,
      message: 'Order approved successfully',
      quantityChanges: quantityChanges,  // ✅ Include information about quantity increases/decreases
    };
  } catch (error) {
    console.error('Approve order error:', error);
    return {
      success: false,
      message: error.message || 'Failed to approve order',
      error: error.message,
    };
  }
};



/**
 * Dispatch an approved order with tracking information
 * @param {string} orderId - ID of the order to dispatch
 * @param {string} managerId - ID of the manager dispatching
 * @param {Object} dispatchData - Dispatch information
 * @returns {Object} Dispatched order details
 */
const dispatchOrder = async (orderId, managerId, dispatchData, mediaPaths = []) => {
  try {
    const { trackingId, courierLink } = dispatchData;

    // Validate the order exists and is in accepted status
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        status: 'ACCEPTED_ORDER'
      },
      include: {
        orderItems: true,
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        branch: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!order) {
      throw new Error('Order not found or not in accepted status');
    }

    // Update order status and create tracking record in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update order status and ensure manager is set
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'IN_TRANSIT',
          dispatchedAt: new Date(),
          managerId: managerId // Ensure manager is set (in case it wasn't set during approval)
        }
      });

      // Create or update tracking record
      await tx.tracking.upsert({
        where: { orderId: orderId },
        update: {
          trackingId,
          courierLink,
          updatedAt: new Date()
        },
        create: {
          orderId: orderId,
          trackingId,
          courierLink
        }
      });

      return updatedOrder;
    });

    // Import and call BoxHero stock update service
    const { updateBoxHeroStock } = require('./boxHeroService');

    // Prepare items for stock update: only include items that are NOT marked outOfStock
    const itemsToUpdate = [];
    for (const orderItem of order.orderItems) {
      if (orderItem.outOfStock) continue; // skip out-of-stock items
      // find item by SKU to get BoxHero ID
      const itemRecord = await prisma.item.findUnique({ where: { sku: orderItem.sku } });
      if (!itemRecord || !itemRecord.boxHeroId) continue;
      itemsToUpdate.push({
        itemId: itemRecord.boxHeroId,
        quantityToDeduct: orderItem.qtyApproved || orderItem.qtyRequested
      });
    }

    // Update BoxHero stock levels (will only affect in-stock items)
    const stockUpdateResult = await updateBoxHeroStock(itemsToUpdate);

    if (!stockUpdateResult.success) {
      console.error('Failed to update BoxHero stock:', stockUpdateResult.message);
      // Note: We don't fail the dispatch if BoxHero update fails
      // The order is still dispatched, but stock sync failed
    }

    // Create notification for order dispatch
    try {
      await notifyUsers([order.requesterId], order.id, 'ORDER_DISPATCHED', 'Order Dispatched', `Your order ${order.orderNumber} has been dispatched. Tracking ID: ${trackingId}`);
    } catch (err) {
      console.error('Failed to notify requester about dispatch:', err);
    }

    // Fetch the complete updated order with tracking
    const completeOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        branch: {
          select: {
            id: true,
            name: true
          }
        },
        orderItems: {
          include: {
            item: {
              select: {
                id: true,
                name: true,
                sku: true,
                category: true,
                unit: true
              }
            }
          }
        },
        tracking: true
      }
    });

    // Save transit media paths if provided
    if (mediaPaths && mediaPaths.length > 0) {
      try {
        const existing = completeOrder.transitMedia || [];
        await prisma.order.update({ where: { id: orderId }, data: { transitMedia: [...existing, ...mediaPaths] } });
        // refresh completeOrder with media
        const refreshed = await prisma.order.findUnique({ where: { id: orderId }, include: { requester: { select: { id: true, firstName: true, lastName: true, email: true } }, branch: { select: { id: true, name: true } }, orderItems: true, tracking: true } });
        if (refreshed) completeOrder = refreshed;
      } catch (err) {
        console.error('Failed to save transit media paths:', err);
      }
    }

    // Send email and WhatsApp notifications
    try {
      await sendOrderDispatchNotification(completeOrder);
    } catch (notificationError) {
      console.error('Failed to send dispatch notifications:', notificationError);
      // Don't fail the dispatch if notifications fail
    }

    return {
      success: true,
      data: completeOrder,
      message: 'Order dispatched successfully',
      stockUpdateResult
    };

  } catch (error) {
    console.error('Dispatch order error:', error);
    return {
      success: false,
      message: error.message || 'Failed to dispatch order',
      error: error.message
    };
  }
};

/**
 * Update arranging stage for an order (unified 3-stage flow)
 * @param {string} orderId
 * @param {string} userId
 * @param {string} arrangingStage - 'ARRANGING' | 'ARRANGED' | 'SENT_FOR_PACKAGING'
 */
/**
 * Update arranging stage for order and mirror it to main status
 */
/**
 * Update arranging stage and mirror it to main status
 */
const updateArrangingStage = async (orderId, userId, arrangingStage, mediaPaths = []) => {
  try {
    const allowed = ['ARRANGING', 'ARRANGED', 'SENT_FOR_PACKAGING'];
    if (!allowed.includes(arrangingStage)) {
      return { success: false, statusCode: 400, message: 'Invalid arranging stage' };
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return { success: false, statusCode: 404, message: 'Order not found' };

    const now = new Date();
    const curr = order.arrangingStage || null;

    // 🚫 stop arranging changes after packaging starts
    const packagingPhases = ['UNDER_PACKAGING', 'PACKAGING_COMPLETED', 'IN_TRANSIT'];
    if (packagingPhases.includes(order.status)) {
      return { success: false, statusCode: 400, message: 'Cannot change arranging stage during/after packaging' };
    }

    // 🔥 enforce forward-only transitions
    const validTransitions = {
      null: ['ARRANGING'],
      ARRANGING: ['ARRANGED'],
      ARRANGED: ['SENT_FOR_PACKAGING'],
      SENT_FOR_PACKAGING: [] // no further arranging
    };

    if (!validTransitions[curr].includes(arrangingStage)) {
      return {
        success: false,
        statusCode: 400,
        message: `Invalid transition: ${curr} → ${arrangingStage}`
      };
    }

    let updateData = {
      arrangingStage,
      status: arrangingStage   // mirror to main status
    };

    // If mediaPaths provided, merge into arrangingMedia JSON field (ensure array)
    if (mediaPaths && mediaPaths.length > 0) {
      const existing = order.arrangingMedia || [];
      updateData.arrangingMedia = [...existing, ...mediaPaths];
    }

    if (curr === null && arrangingStage === 'ARRANGING') {
      updateData.arrangingStartedAt = now;
    }

    if (curr === 'ARRANGING' && arrangingStage === 'ARRANGED') {
      updateData.arrangingCompletedAt = now;
    }

    if (arrangingStage === 'SENT_FOR_PACKAGING') {
      updateData.sentForPackagingAt = now;
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: updateData
    });

    // Notify branch user about arranging stage change
    try {
      const typeMap = {
        ARRANGING: 'ORDER_ARRANGING',
        ARRANGED: 'ORDER_ARRANGED',
        SENT_FOR_PACKAGING: 'ORDER_SENT_FOR_PACKAGING'
      };
      const titleMap = {
        ARRANGING: 'Order Arranging',
        ARRANGED: 'Order Arranged',
        SENT_FOR_PACKAGING: 'Order Sent For Packaging'
      };
      const notifyType = typeMap[arrangingStage] || 'ORDER_ARRANGING';
      const notifyTitle = titleMap[arrangingStage] || 'Order Arranging';
      // fetch requester id
      const fresh = await prisma.order.findUnique({ where: { id: orderId }, select: { requesterId: true, orderNumber: true } });
      if (fresh) {
        await notifyUsers([fresh.requesterId], orderId, notifyType, notifyTitle, `Order ${fresh.orderNumber} updated to ${arrangingStage}`);
      }
    } catch (notifyErr) {
      console.error('Failed to notify on arranging stage change:', notifyErr);
    }

    // Send email notification for ARRANGING, ARRANGED, and SENT_FOR_PACKAGING
    if (['ARRANGING', 'ARRANGED', 'SENT_FOR_PACKAGING'].includes(arrangingStage)) {
      try {
        console.log(`🔍 [DEBUG] Arranging stage email trigger: arrangingStage=${arrangingStage}, orderId=${orderId}`);
        // Fetch complete order with requester details
        const completeOrder = await prisma.order.findUnique({
          where: { id: orderId },
          include: {
            requester: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phoneNumber: true
              }
            },
            branch: {
              select: {
                id: true,
                name: true
              }
            },
            orderItems: true,
            tracking: true
          }
        });
        if (completeOrder) {
          console.log(`🔍 [DEBUG] About to call sendOrderStatusUpdateNotification from arranging stage...`);
          await sendOrderStatusUpdateNotification(completeOrder, arrangingStage);
          console.log(`🔍 [DEBUG] sendOrderStatusUpdateNotification returned from arranging stage.`);
          
          // Additional notifications for SENT_FOR_PACKAGING
          if (arrangingStage === 'SENT_FOR_PACKAGING') {
            // Send notification to assigned packager (if exists)
            try {
              // TODO: Get assigned packager from order or branch configuration
              // For now, we'll skip packager notification as we need to determine who the packager is
              console.log(`🔍 [DEBUG] SENT_FOR_PACKAGING: Would send to packager if assigned`);
            } catch (packagerError) {
              console.error('Failed to send packager notification:', packagerError);
            }
            
            // Send notification to manager
            try {
              // Get manager who approved the order
              if (completeOrder.managerId) {
                const manager = await prisma.user.findUnique({
                  where: { id: completeOrder.managerId },
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    phoneNumber: true
                  }
                });
                if (manager) {
                  console.log(`🔍 [DEBUG] Sending packaging stage started notification to manager...`);
                  await sendPackagingStageStartedNotification(completeOrder, manager);
                  console.log(`🔍 [DEBUG] Packaging stage started notification sent to manager.`);
                }
              }
            } catch (managerError) {
              console.error('Failed to send manager notification:', managerError);
            }
          }
        }
      } catch (emailError) {
        console.error('Failed to send arranging stage email notification:', emailError);
      }
    }

    return { success: true, data: updatedOrder };
  } catch (err) {
    console.error('updateArrangingStage error:', err);
    return { success: false, statusCode: 500, message: err.message };
  }
};




//  * Confirm an order (branch user accepts the approved order)
//  * @param {string} orderId - ID of the order to confirm
//  * @param {string} userId - ID of the user confirming
//  * @returns {Object} Confirmed order details
//  *
const confirmOrder = async (orderId, userId) => {
  try {
    // ✅ Step 1: Validate the order exists and is in confirm pending status
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        status: 'CONFIRM_PENDING',
        requesterId: userId, // Ensure user can only confirm their own orders
      },
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
        orderItems: true,
      },
    });

    if (!order) {
      throw new Error('Order not found or not in confirm pending status');
    }

    // ✅ Step 2: Update order status to APPROVED_ORDER
    const result = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'APPROVED_ORDER',
        },
      });

      return updatedOrder;
    });

    // ✅ Step 3: Notify manager and admins about order confirmation
    try {
      const adminUsers = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
      const userIds = [...(adminUsers.map(a => a.id))];
      if (order.managerId) userIds.push(order.managerId);
      await notifyUsers(userIds, order.id, 'ORDER_CONFIRMED', 'Order Confirmed', `Order ${order.orderNumber} has been confirmed by branch user`);
    } catch (notifyErr) {
      console.error('Failed to notify manager/admins for order confirmation:', notifyErr);
    }

    // ✅ Step 4: Send notifications
    try {
      await sendOrderConfirmedNotification(order);
      
      // ✅ Send confirmation received email to requester
      console.log(`📧 Sending confirmation received email to requester for order ${order.orderNumber}`);
      const requesterConfirmResult = await sendBranchConfirmationReceivedNotification(order);
      console.log(`📧 Confirmation received notification result:`, requesterConfirmResult);
      
      // ✅ Send order approved & confirmed email to requester (final approval notification)
      console.log(`📧 Sending order approved & confirmed email to requester for order ${order.orderNumber}`);
      const approvedConfirmedResult = await sendOrderApprovedConfirmedNotification(order);
      console.log(`📧 Order approved & confirmed notification result:`, approvedConfirmedResult);
      
      // Send branch confirmation email to manager if order was updated by manager
      console.log(`🔍 Checking for manager notification - Order.managerId: ${order.managerId}`);
      if (order.managerId) {
        console.log(`🔍 Order has managerId: ${order.managerId}, fetching manager details...`);
        const manager = await prisma.user.findUnique({
          where: { id: order.managerId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        });
        console.log(`🔍 Manager found:`, manager);
        if (manager && manager.email) {
          console.log(`📧 Sending branch confirmation email to manager: ${manager.email}`);
          const notifResult = await sendBranchConfirmationToManagerNotification(order, manager);
          console.log(`📧 Branch confirmation notification result:`, notifResult);
        } else {
          console.warn(`⚠️ Manager not found or missing email for managerId: ${order.managerId}`);
        }
      } else {
        console.warn(`⚠️ Order ${order.orderNumber} has no managerId set`);
      }
    } catch (notificationError) {
      console.error('Failed to send confirmation notifications:', notificationError);
    }

    // ✅ Step 5: Fetch full updated order
    const completeOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
        orderItems: true,
      },
    });

    return {
      success: true,
      data: completeOrder,
      message: 'Order confirmed successfully',
    };
  } catch (error) {
    console.error('Confirm order error:', error);
    return {
      success: false,
      message: error.message || 'Failed to confirm order',
      error: error.message,
    };
  }
};


/**
 * Raise one or more issues for an approved order (branch user sends back to manager)
 * Accepts either a single string or an array of { itemId, reason }
 * @param {string} orderId - ID of the order
 * @param {string} userId - ID of the user raising the issue
 * @param {string|Array} issuePayload - Either a string or array of { itemId, reason }
 * @returns {Object} Updated order details
 * 
 * 
 */

const raiseOrderIssue = async (orderId, userId, issuePayload) => {
  try {
    // ✅ Validate that the order exists and belongs to this user
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        status: { in: ['CONFIRM_PENDING', 'MANAGER_REPLIED', 'IN_TRANSIT'] },
        requesterId: userId,
      },
      include: {
        requester: { select: { id: true, firstName: true, lastName: true, email: true } },
        branch: { select: { id: true, name: true } },
        orderItems: true,
      },
    });

    if (!order) {
      throw new Error('Order not found or not in confirm pending, manager replied, or in transit status');
    }

    // ✅ Normalize payload
    let issues = [];
    if (typeof issuePayload === 'string') {
      const trimmed = issuePayload.trim();
      if (!trimmed) throw new Error('Issue reason cannot be empty');
      issues.push({ itemId: null, reason: trimmed });
    } else if (Array.isArray(issuePayload)) {
      issues = issuePayload
        .map((it) => ({
          itemId: it.itemId || null,
          reason: (it.reason || '').trim(),
        }))
        .filter((it) => it.reason.length > 0);
      if (issues.length === 0) throw new Error('No valid issues provided');
    } else {
      throw new Error('Invalid payload for issue(s)');
    }

    // ✅ Create a readable summary for order.remarks
    const combinedRemarks =
      issues.length === 1
        ? issues[0].reason
        : issues.map((i, idx) => `#${idx + 1}: ${i.reason}`).join(' | ');

    // ✅ Run everything in a transaction
    const updatedOrder = await prisma.$transaction(async (tx) => {
      // 1️⃣ Update order status + summary
      const newStatus = order.status === 'IN_TRANSIT' ? 'RAISED_ISSUE' : 'WAITING_FOR_MANAGER_REPLY';
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: newStatus,
          remarks: combinedRemarks,
        },
      });

      // 2️⃣ Insert each issue separately in OrderIssue table
      await tx.orderIssue.createMany({
        data: issues.map((it) => ({
          orderId,
          itemId: it.itemId,
          message: it.reason,
          senderRole: 'BRANCH_USER',
        })),
      });

      // 3️⃣ (Do not create notifications inside TX) - handled after transaction

      return updated;
    });

    // ✅ Send async notifications
    try {
      await sendOrderIssueRaisedNotification(order, combinedRemarks);
    } catch (notificationError) {
      console.error('Failed to send issue raised notifications:', notificationError);
    }

    // ✅ Send email to manager about branch issue (NEW)
    try {
      if (order.managerId) {
        const manager = await prisma.user.findUnique({
          where: { id: order.managerId },
          select: { id: true, firstName: true, lastName: true, email: true }
        });

        if (manager && manager.email) {
          const { sendBranchIssuePendingManagerActionNotification } = require('./notificationService');
          await sendBranchIssuePendingManagerActionNotification(
            order,
            manager,
            { remarks: combinedRemarks, createdAt: new Date() }
          );
        }
      }
    } catch (managerEmailErr) {
      console.error('⚠️ Failed to send manager issue notification email:', managerEmailErr);
    }

    // ✅ Send confirmation email to requester about issue submission
    try {
      console.log(`📧 Sending issue submission email to requester for order ${order.orderNumber}`);
      const requesterIssueResult = await sendBranchIssueSubmittedNotification(order, combinedRemarks);
      console.log(`📧 Issue submission notification result:`, requesterIssueResult);
    } catch (requesterIssueErr) {
      console.error('⚠️ Failed to send requester issue notification email:', requesterIssueErr);
    }

    // Notify branch managers + admins about raised issue
    try {
      const adminUsers = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
      const mgrs = await prisma.managerBranch.findMany({ where: { branchId: order.branch.id }, select: { managerId: true } });
      const userIds = [...adminUsers.map(a => a.id), ...mgrs.map(m => m.managerId)];
      if (userIds.length > 0) {
        await notifyUsers(userIds, order.id, 'ORDER_ISSUE_RAISED', 'Order Issue Raised', `Order ${order.orderNumber} has ${issues.length} issue(s): ${combinedRemarks}`);
      }
    } catch (notifyErr) {
      console.error('Failed to notify admins/managers about raised issue:', notifyErr);
    }

    return {
      success: true,
      data: updatedOrder,
      message: 'Order issue(s) raised successfully',
    };
  } catch (error) {
    console.error('Raise order issue error:', error);
    return {
      success: false,
      message: error.message || 'Failed to raise order issue',
      error: error.message,
    };
  }
};



/**
 * Get all issues for an order
 * @param {string} orderId
 * @param {string} userId
 * @param {string} userRole
 * @returns {Object}
 */
const getOrderIssues = async (orderId, userId, userRole) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, requesterId: true },
    });

    if (!order) throw new Error("Order not found");

    // 🔒 Access control
    if (
      userRole !== "ADMIN" &&
      userRole !== "MANAGER" &&
      order.requesterId !== userId
    ) {
      throw new Error("Access denied");
    }

    // 🧩 Fetch conversation messages
    const chatMessages = await prisma.orderIssue.findMany({
      where: { orderId },
      orderBy: { createdAt: "asc" },
      include: {
        orderItem: { select: { id: true, sku: true } },
        repliedByUser: { select: { firstName: true, lastName: true, role: true } },
      },
    });

    return { success: true, data: chatMessages };
  } catch (error) {
    console.error("Get order issues error:", error);
    return { success: false, message: error.message };
  }
};


/**
 * Create a post-delivery issue thread (branch user)
 * @param {string} orderId
 * @param {string} userId
 * @param {Array} issues - Array of { itemId, text }
 * @param {Array} mediaPaths - Array of file paths
 */
const postDeliveryIssue = async (orderId, userId, issues = [], mediaPaths = []) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { branch: true } });
    if (!order) throw new Error('Order not found');

    // Create thread and initial messages in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const thread = await tx.issueThread.create({ data: { orderId, createdBy: userId } });

      // If issues array provided, create a message per issue
      if (Array.isArray(issues) && issues.length > 0) {
        for (const it of issues) {
          const text = it.text || it.reason || '';
          await tx.issueMessage.create({
            data: {
              threadId: thread.id,
              senderId: userId,
              senderRole: 'BRANCH_USER',
              text: text || null,
              media: mediaPaths && mediaPaths.length > 0 ? mediaPaths : null
            }
          });
        }
      } else if (mediaPaths && mediaPaths.length > 0) {
        // Create a single message containing media only
        await tx.issueMessage.create({
          data: {
            threadId: thread.id,
            senderId: userId,
            senderRole: 'BRANCH_USER',
            text: null,
            media: mediaPaths
          }
        });
      }

      // Create notification for manager(s) — notify branch manager if exists
      // Find managers assigned to this branch
      const managers = await tx.managerBranch.findMany({ where: { branchId: order.branchId }, select: { managerId: true } });
      for (const m of managers) {
        await tx.notification.create({
          data: {
            type: 'ORDER_ISSUE_RAISED',
            title: 'Post-delivery Issue Raised',
            message: `Post-delivery issue created for order ${order.orderNumber}`,
            userId: m.managerId,
            orderId: order.id
          }
        });
      }

      return thread;
    });

    return { success: true, data: result, message: 'Post-delivery issue thread created' };
  } catch (err) {
    console.error('postDeliveryIssue error:', err);
    return { success: false, message: err.message || 'Failed to create post-delivery issue' };
  }
};





/**
 * Manager replies to raised issue
 * @param {string} orderId - ID of the order
 * @param {string} managerId - ID of the manager replying
 * @param {string} reply - Manager's reply
 * @param {Array} updatedQuantities - Array of updated quantities
 * @returns {Object} Updated order details
 */

const managerReplyToIssue = async (orderId, actorId, actorRole, replies = []) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: orderId },
      include: { requester: true, branch: true, orderItems: true },
    });

    if (!order) throw new Error("Order not found");

    await prisma.$transaction(async (tx) => {
      for (const r of replies) {
        // 🗨️ Manager sends chat message
        await tx.orderIssue.create({
          data: {
            orderId,
            itemId: r.itemId,
            message: r.reply,        // 🆕 use unified message
            senderRole: actorRole,   // 'MANAGER'
            repliedBy: actorId,
            repliedAt: new Date(),
          },
        });

        // ✅ If manager also updates quantity
        if (r.qtyApproved !== undefined) {
          await tx.orderItem.update({
            where: { id: r.itemId },
            data: { qtyApproved: r.qtyApproved },
          });
        }
      }

      // ✅ Mark order as replied
      await tx.order.update({
        where: { id: orderId },
        data: { status: "MANAGER_REPLIED" },
      });
    });

    // ✅ Notify the requester (branch user) and also inform admins/managers
    try {
      const adminUsers = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
      const mgrs = await prisma.managerBranch.findMany({ where: { branchId: order.branchId }, select: { managerId: true } });
      const userIds = [order.requesterId, ...adminUsers.map(a => a.id), ...mgrs.map(m => m.managerId)];
      await notifyUsers(userIds, order.id, 'ORDER_MANAGER_REPLY', `${actorRole} Reply`, `${actorRole} has replied to raised issues for order ${order.orderNumber}`);
    } catch (notifyErr) {
      console.error('Failed to notify users for manager reply:', notifyErr);
    }

    return { success: true, message: "Replies sent successfully" };
  } catch (error) {
    console.error("Manager reply error:", error);
    return { success: false, message: error.message };
  }
};





/**
 * Manager updates order status from APPROVED_ORDER to UNDER_PACKAGING or IN_TRANSIT
 * @param {string} orderId - ID of the order
 * @param {string} managerId - ID of the manager updating
 * @param {string} newStatus - New status (UNDER_PACKAGING or IN_TRANSIT)
 * @param {Object} trackingDetails - Tracking details for IN_TRANSIT status
 * @returns {Object} Updated order details
 */

const updateOrderStatus = async (
  orderId,
  actorId,
  actorRole,
  newStatusInput, // Renamed argument to avoid conflict
  trackingDetails = null,
  mediaPaths = [],
  expectedDeliveryTime = undefined
) => {
  try {
    // --- 🚀 Backend Fix: Normalize the newStatus parameter ---
    let finalStatus = newStatusInput;

    // Check if the input is an object (i.e., likely a parsed FormData or a payload object)
    if (typeof newStatusInput === 'object' && newStatusInput !== null) {
      // Assuming your API route has already parsed the FormData and put fields in the body.
      // If no files are attached, newStatusInput will be the simple status string.
      // If files are attached, newStatusInput will be the entire body, which includes the 'newStatus' field.
      // The frontend sends the actual status string in a field named 'newStatus' within the FormData object.
      if (typeof newStatusInput.newStatus === 'string') {
        finalStatus = newStatusInput.newStatus;
      }
    }

    if (typeof finalStatus !== 'string') {
      throw new Error("Invalid newStatus format received in core service function.");
    }
    // --------------------------------------------------------

    const allowedTransitions = {
      'APPROVED_ORDER': ['ARRANGING', 'UNDER_PACKAGING'],
      'ARRANGING': ['ARRANGED'],
      'ARRANGED': ['SENT_FOR_PACKAGING'],
      'SENT_FOR_PACKAGING': ['UNDER_PACKAGING'],
      'UNDER_PACKAGING': ['PACKAGING_COMPLETED'],
      'PACKAGING_COMPLETED': ['IN_TRANSIT']
    };

    const allowedRolesForStatus = {
      ARRANGING: ['BRANCH_USER', 'MANAGER', 'ADMIN'],
      ARRANGED: ['BRANCH_USER', 'MANAGER', 'ADMIN'],
      SENT_FOR_PACKAGING: ['BRANCH_USER', 'MANAGER', 'ADMIN'],
      UNDER_PACKAGING: ['ADMIN', 'MANAGER', 'PACKAGER'],
      PACKAGING_COMPLETED: ['ADMIN', 'MANAGER', 'PACKAGER'],
      IN_TRANSIT: ['ADMIN', 'MANAGER', 'DISPATCHER']
    };

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { requester: true, branch: true, orderItems: true }
    });

    if (!order) throw new Error("Order not found");

    const currentStatus = order.status;
    const possibleNext = allowedTransitions[currentStatus] || [];

    // Use the normalized finalStatus
    if (!possibleNext.includes(finalStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} → ${finalStatus}`);
    }

    // Use the normalized finalStatus
    if (!allowedRolesForStatus[finalStatus] || !allowedRolesForStatus[finalStatus].includes(actorRole)) {
      throw new Error("Access denied. You cannot perform this transition.");
    }

    const now = new Date();
    const updateData = { status: finalStatus }; // Use the normalized finalStatus

    // ----------------------
    // TIMELINE TIMESTAMPS: USE THE NORMALIZED finalStatus
    // ----------------------
    if (finalStatus === "ARRANGING") {
      updateData.arrangingStartedAt = now;
    }

    if (finalStatus === "ARRANGED") {
      updateData.arrangingCompletedAt = now;
    }

    if (finalStatus === "SENT_FOR_PACKAGING") {
      updateData.sentForPackagingAt = now;
    }

    if (finalStatus === "UNDER_PACKAGING") {
      updateData.packagingStartedAt = now; // ✅ NOW THIS WILL RUN
    }

    if (finalStatus === "PACKAGING_COMPLETED") {
      updateData.packagingCompletedAt = now; // AND THIS WILL RUN
    }

    if (finalStatus === "IN_TRANSIT") {
      updateData.dispatchedAt = now;
      // Also, check for expectedDeliveryTime in newStatusInput if it came via FormData
      let deliveryTime = expectedDeliveryTime;
      if (typeof newStatusInput === 'object' && newStatusInput !== null && newStatusInput.expectedDeliveryTime) {
        deliveryTime = newStatusInput.expectedDeliveryTime;
      }

      if (deliveryTime) {
        const deliveryDate = new Date(deliveryTime);
        const currentDate = new Date();
        
        // Validate that delivery time is not in the past
        if (deliveryDate < currentDate) {
          throw new Error('Expected delivery time cannot be earlier than current date');
        }
        
        updateData.expectedDeliveryTime = deliveryDate;
      }

      // Also normalize trackingDetails if coming from FormData
      if (typeof newStatusInput === 'object' && newStatusInput !== null && newStatusInput.trackingDetails) {
        trackingDetails = newStatusInput.trackingDetails;
      }
    }

    // -----------------------
    // DATABASE UPDATE (TX)
    // -----------------------
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: updateData
      });

      if (finalStatus === "IN_TRANSIT") {
        // Always create a tracking record for IN_TRANSIT status, even if trackingDetails are not provided
        await tx.tracking.upsert({
          where: { orderId },
          update: {
            trackingId: trackingDetails?.trackingId || null,
            courierLink: trackingDetails?.trackingLink || null,
            updatedAt: new Date()
          },
          create: {
            orderId,
            trackingId: trackingDetails?.trackingId || null,
            courierLink: trackingDetails?.trackingLink || null
          }
        });
      }

      return updated;
    });

    // -----------------------
    // SAVE MEDIA: USE THE NORMALIZED finalStatus
    // -----------------------
    if (mediaPaths.length > 0) {
      const existing = await prisma.order.findUnique({
        where: { id: orderId },
        select: { arrangingMedia: true, packagingMedia: true, transitMedia: true }
      });

      if (['ARRANGING', 'ARRANGED', 'SENT_FOR_PACKAGING'].includes(finalStatus)) { // Use finalStatus
        await prisma.order.update({
          where: { id: orderId },
          data: {
            arrangingMedia: [...(existing.arrangingMedia || []), ...mediaPaths]
          }
        });
      }

      if (['UNDER_PACKAGING', 'PACKAGING_COMPLETED'].includes(finalStatus)) { // Use finalStatus
        await prisma.order.update({
          where: { id: orderId },
          data: {
            packagingMedia: [...(existing.packagingMedia || []), ...mediaPaths]
          }
        });
      }

      if (finalStatus === "IN_TRANSIT") { // Use finalStatus
        await prisma.order.update({
          where: { id: orderId },
          data: {
            transitMedia: [...(existing.transitMedia || []), ...mediaPaths]
          }
        });
      }
    }

    // ... rest of return logic
    // -----------------------
    // RETURN UPDATED ORDER
    // -----------------------
    const completeOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true
          }
        },
        branch: {
          select: {
            id: true,
            name: true
          }
        },
        orderItems: true,
        tracking: true
      }
    });

    try {
      if (actorRole === 'MANAGER' && ['ARRANGING', 'SENT_FOR_PACKAGING', 'UNDER_PACKAGING', 'PACKAGING_COMPLETED', 'IN_TRANSIT', 'RECEIVED'].includes(finalStatus)) {
        console.log(`🔍 [DEBUG] Manager status update: actorRole=${actorRole}, finalStatus=${finalStatus}, orderId=${orderId}`);
        console.log(`🔍 [DEBUG] completeOrder.requester.email:`, completeOrder.requester?.email);
        console.log(`🔍 [DEBUG] completeOrder.requester:`, completeOrder.requester);
        console.log(`🔍 [DEBUG] About to call sendOrderStatusUpdateNotification...`);
        await sendOrderStatusUpdateNotification(completeOrder, finalStatus);
        console.log(`🔍 [DEBUG] sendOrderStatusUpdateNotification returned.`);
        
        // Additional notifications for SENT_FOR_PACKAGING
        if (finalStatus === 'SENT_FOR_PACKAGING') {
          // Send notification to assigned packager (if exists)
          try {
            // TODO: Get assigned packager from order or branch configuration
            // For now, we'll skip packager notification as we need to determine who the packager is
            console.log(`🔍 [DEBUG] SENT_FOR_PACKAGING: Would send to packager if assigned`);
          } catch (packagerError) {
            console.error('Failed to send packager notification:', packagerError);
          }
          
          // Send notification to manager
          try {
            // Get manager who approved the order
            if (completeOrder.managerId) {
              const manager = await prisma.user.findUnique({
                where: { id: completeOrder.managerId },
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phoneNumber: true
                }
              });
              if (manager) {
                console.log(`🔍 [DEBUG] Sending packaging stage started notification to manager...`);
                await sendPackagingStageStartedNotification(completeOrder, manager);
                console.log(`🔍 [DEBUG] Packaging stage started notification sent to manager.`);
              }
            }
          } catch (managerError) {
            console.error('Failed to send manager notification:', managerError);
          }
        }
        
        // Additional notifications for UNDER_PACKAGING
        if (finalStatus === 'UNDER_PACKAGING') {
          // Send notification to assigned packager (if exists)
          try {
            // TODO: Get assigned packager from order or branch configuration
            // For now, we'll skip packager notification as we need to determine who the packager is
            console.log(`🔍 [DEBUG] UNDER_PACKAGING: Would send to packager if assigned`);
          } catch (packagerError) {
            console.error('Failed to send packager notification:', packagerError);
          }
          
          // Send notification to manager
          try {
            // Get manager who approved the order
            if (completeOrder.managerId) {
              const manager = await prisma.user.findUnique({
                where: { id: completeOrder.managerId },
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phoneNumber: true
                }
              });
              if (manager) {
                console.log(`🔍 [DEBUG] Sending packaging in progress notification to manager...`);
                await sendPackagingInProgressNotificationToManager(completeOrder, manager);
                console.log(`🔍 [DEBUG] Packaging in progress notification sent to manager.`);
              }
            }
          } catch (managerError) {
            console.error('Failed to send manager notification:', managerError);
          }
        }
        
        // Additional notifications for PACKAGING_COMPLETED
        if (finalStatus === 'PACKAGING_COMPLETED') {
          // Send notification to assigned packager (if exists)
          try {
            // TODO: Get assigned packager from order or branch configuration
            // For now, we'll skip packager notification as we need to determine who the packager is
            console.log(`🔍 [DEBUG] PACKAGING_COMPLETED: Would send to packager if assigned`);
          } catch (packagerError) {
            console.error('Failed to send packager notification:', packagerError);
          }
          
          // Send notification to manager
          try {
            // Get manager who approved the order
            if (completeOrder.managerId) {
              const manager = await prisma.user.findUnique({
                where: { id: completeOrder.managerId },
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phoneNumber: true
                }
              });
              if (manager) {
                console.log(`🔍 [DEBUG] Sending packaging completed notification to manager...`);
                await sendPackagingCompletedNotificationToManager(completeOrder, manager);
                console.log(`🔍 [DEBUG] Packaging completed notification sent to manager.`);
              }
            }
          } catch (managerError) {
            console.error('Failed to send manager notification:', managerError);
          }
          
          // Send notification to dispatcher (if exists)
          try {
            // TODO: Get assigned dispatcher from order or branch configuration
            // For now, we'll skip dispatcher notification as we need to determine who the dispatcher is
            console.log(`🔍 [DEBUG] PACKAGING_COMPLETED: Would send to dispatcher if assigned`);
          } catch (dispatcherError) {
            console.error('Failed to send dispatcher notification:', dispatcherError);
          }
        }
        
        // Additional notifications for IN_TRANSIT
        if (finalStatus === 'IN_TRANSIT') {
          // Send notification to manager
          try {
            // Get manager who approved the order
            if (completeOrder.managerId) {
              const manager = await prisma.user.findUnique({
                where: { id: completeOrder.managerId },
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phoneNumber: true
                }
              });
              if (manager) {
                console.log(`🔍 [DEBUG] Sending in transit notification to manager...`);
                await sendInTransitNotificationToManager(completeOrder, manager);
                console.log(`🔍 [DEBUG] In transit notification sent to manager.`);
              }
            }
          } catch (managerError) {
            console.error('Failed to send manager notification:', managerError);
          }
          
          // Send notification to dispatcher (if exists)
          try {
            // TODO: Get assigned dispatcher from order or branch configuration
            // For now, we'll skip dispatcher notification as we need to determine who the dispatcher is
            console.log(`🔍 [DEBUG] IN_TRANSIT: Would send to dispatcher if assigned`);
          } catch (dispatcherError) {
            console.error('Failed to send dispatcher notification:', dispatcherError);
          }
        }
        
        // Additional notifications for RECEIVED
        if (finalStatus === 'RECEIVED') {
          // Send notification to manager
          try {
            // Get manager who approved the order
            if (completeOrder.managerId) {
              const manager = await prisma.user.findUnique({
                where: { id: completeOrder.managerId },
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phoneNumber: true
                }
              });
              if (manager) {
                console.log(`🔍 [DEBUG] Sending received notification to manager...`);
                await sendReceivedNotificationToManager(completeOrder, manager);
                console.log(`🔍 [DEBUG] Received notification sent to manager.`);
              }
            }
          } catch (managerError) {
            console.error('Failed to send manager notification:', managerError);
          }
          
          // Send notification to dispatcher (if exists)
          try {
            // TODO: Get assigned dispatcher from order or branch configuration
            // For now, we'll skip dispatcher notification as we need to determine who the dispatcher is
            console.log(`🔍 [DEBUG] RECEIVED: Would send to dispatcher if assigned`);
          } catch (dispatcherError) {
            console.error('Failed to send dispatcher notification:', dispatcherError);
          }
        }
      }
    } catch (notificationError) {
      console.error('Failed to send order status update notifications:', notificationError);
    }

    // Notify relevant users depending on finalStatus
    try {
      const branchUserId = completeOrder.requester?.id || completeOrder.requesterId;
      const statusToType = {
        ARRANGING: ['ORDER_ARRANGING', 'Order Arranging'],
        ARRANGED: ['ORDER_ARRANGED', 'Order Arranged'],
        SENT_FOR_PACKAGING: ['ORDER_SENT_FOR_PACKAGING', 'Order Sent For Packaging'],
        UNDER_PACKAGING: ['ORDER_UNDER_PACKAGING', 'Order Under Packaging'],
        PACKAGING_COMPLETED: ['ORDER_PACKAGING_COMPLETED', 'Order Packaging Completed'],
        IN_TRANSIT: ['ORDER_IN_TRANSIT', 'Order Dispatched']
      };

      if (statusToType[finalStatus]) {
        const [ntype, ntitle] = statusToType[finalStatus];
        const message = finalStatus === 'IN_TRANSIT' && completeOrder.tracking ? `Order ${completeOrder.orderNumber} is in transit. Tracking: ${completeOrder.tracking.trackingId || 'N/A'}` : `Order ${completeOrder.orderNumber} updated to ${finalStatus}`;
        if (branchUserId) await notifyUsers([branchUserId], orderId, ntype, ntitle, message);
      }
    } catch (notifyErr) {
      console.error('Failed to notify users on status update:', notifyErr);
    }

    return {
      success: true,
      message: `Order updated to ${finalStatus} successfully`, // Use finalStatus
      data: completeOrder
    };

  } catch (error) {
    console.error("Update order status error:", error);
    return { success: false, message: error.message };
  }
};





/**
 * Branch user confirms order received
 * @param {string} orderId - ID of the order
 * @param {string} userId - ID of the user confirming
 * @param {Array} mediaFiles - Array of uploaded media files (optional but recommended)
 * @returns {Object} Updated order details
 */
const confirmOrderReceived = async (orderId, userId, mediaFiles = []) => {
  try {
    // Step 1: Validate the order exists and belongs to the user
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        status: 'IN_TRANSIT',
        requesterId: userId, // user can only confirm their own orders
      },
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
        // ✅ OrderItems — no `item` relation
        orderItems: true,
      },
    });

    if (!order) {
      throw new Error('Order not found or not in transit status');
    }

    // Step 2: Make media upload mandatory
    if (!mediaFiles || mediaFiles.length === 0) {
      throw new Error('Please upload at least one photo or video to confirm receipt of items.');
    }

    // Step 3: Process media files if provided
    let mediaPaths = [];
    if (mediaFiles && mediaFiles.length > 0) {
      mediaPaths = mediaFiles.map(file => `/uploads/${file.filename}`);
    }

    // Step 4: Update order status and set autoCloseAt (56 working hours after received)
    const receivedAt = new Date();
    const autoCloseAt = addWorkingHours(receivedAt, 56);

    const updatedOrder = await prisma.$transaction(async (tx) => {
      return await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'CONFIRM_ORDER_RECEIVED',
          receivedAt,
          autoCloseAt,
        },
      });
    });

    // Step 3: Fetch complete order with all details for notifications
    const completeOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true
          }
        },
        branch: {
          select: {
            id: true,
            name: true
          }
        },
        orderItems: true,
        tracking: true
      }
    });

    // Step 4: Notify managers and admins about received confirmation
    try {
      const adminUsers = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
      const mgrs = await prisma.managerBranch.findMany({ where: { branchId: order.branch.id }, select: { managerId: true } });
      const userIds = [...adminUsers.map(a => a.id), ...mgrs.map(m => m.managerId)];
      if (order.managerId) userIds.push(order.managerId);
      if (userIds.length > 0) await notifyUsers(userIds, order.id, 'ORDER_RECEIVED', 'Order Received Confirmed', `Order ${order.orderNumber} has been confirmed as received`);
    } catch (notifyErr) {
      console.error('Failed to notify managers/admins about received confirmation:', notifyErr);
    }

    // Step 5: Send email / WhatsApp notification for CONFIRM_ORDER_RECEIVED status (using RECEIVED templates)
    try {
      console.log(`🔍 [DEBUG] About to send CONFIRM_ORDER_RECEIVED status notifications for order ${order.orderNumber}`);
      
      // Send branch user notification (using RECEIVED template)
      await sendOrderStatusUpdateNotification(completeOrder, 'RECEIVED');
      console.log(`🔍 [DEBUG] Branch user CONFIRM_ORDER_RECEIVED notification sent.`);
      
      // Send notification to manager
      if (completeOrder.managerId) {
        const manager = await prisma.user.findUnique({
          where: { id: completeOrder.managerId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true
          }
        });
        if (manager) {
          console.log(`🔍 [DEBUG] Sending received notification to manager...`);
          await sendReceivedNotificationToManager(completeOrder, manager);
          console.log(`🔍 [DEBUG] Received notification sent to manager.`);
        }
      }
      
      // Send notification to dispatcher (if exists)
      try {
        // TODO: Get assigned dispatcher from order or branch configuration
        // For now, we'll skip dispatcher notification as we need to determine who the dispatcher is
        console.log(`🔍 [DEBUG] CONFIRM_ORDER_RECEIVED: Would send to dispatcher if assigned`);
      } catch (dispatcherError) {
        console.error('Failed to send dispatcher notification:', dispatcherError);
      }
      
    } catch (notificationError) {
      console.error('Failed to send order received notifications:', notificationError);
    }

    return {
      success: true,
      data: order,
      message: 'Order received confirmation sent successfully',
    };
  } catch (error) {
    console.error('Confirm order received error:', error);
    return {
      success: false,
      message: error.message || 'Failed to confirm order received',
      error: error.message,
    };
  }
};

/**
 * Report received item-wise issues and attach per-item media paths
 * @param {string} orderId
 * @param {string} userId
 * @param {Array} issues - [{ itemId, reason }]
 * @param {Object} groupedMedia - { itemId: ["/uploads/..", ...] }
 */
const reportReceivedIssues = async (orderId, userId, issues = [], groupedMedia = {}) => {
  try {
    // Basic validation
    if (!Array.isArray(issues) || issues.length === 0) {
      return { success: false, message: 'Issues array required' };
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return { success: false, message: 'Order not found' };
    if (order.requesterId !== userId) return { success: false, message: 'Access denied' };

    // Persist issues and update order in transaction
    const receivedAt = new Date();
    const autoCloseAt = addWorkingHours(receivedAt, 56);

    const createdIssues = [];

    await prisma.$transaction(async (tx) => {
      // create each OrderReceivedIssue
      for (const it of issues) {
        if (!it.itemId || !it.reason) continue;
        const mediaForItem = groupedMedia[it.itemId] || [];

        const created = await tx.orderReceivedIssue.create({
          data: {
            orderId,
            itemId: it.itemId,
            reason: it.reason,
            media: mediaForItem.length > 0 ? mediaForItem : undefined
          }
        });

        createdIssues.push(created);
      }

      // Update order: set CONFIRM_ORDER_RECEIVED, receivedAt, autoCloseAt
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'CONFIRM_ORDER_RECEIVED',
          receivedAt,
          autoCloseAt
        }
      });
    });

    // Notify managers assigned to branch (or fallback to order.managerId)
    try {
      const { getBranchManagers } = require('./managerBranchService');
      const managersRes = await getBranchManagers(order.branchId);
      const userIds = [];
      if (managersRes.success && Array.isArray(managersRes.data)) {
        userIds.push(...managersRes.data.map(m => m.id));
      } else if (order.managerId) {
        userIds.push(order.managerId);
      }
      if (userIds.length > 0) await notifyUsers(userIds, order.id, 'ORDER_ISSUE_RAISED', 'Received Issues Reported', `Branch reported received issues for order ${order.orderNumber}`);
    } catch (notifyErr) {
      console.error('Failed to notify branch managers about received issues:', notifyErr);
    }

    return { success: true, message: 'Received issues reported successfully', data: createdIssues };
  } catch (error) {
    console.error('Report received issues error:', error);
    return { success: false, message: error.message || 'Failed to report received issues' };
  }
};


/**
 * Branch user confirms manager's reply to raised issue
 * @param {string} orderId - ID of the order
 * @param {string} userId - ID of the user confirming
 * @returns {Object} Updated order details
 */
const confirmManagerReply = async (orderId, userId) => {
  try {
    // ✅ Validate the order exists and belongs to the requester
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        status: 'MANAGER_REPLIED',
        requesterId: userId, // Ensure user can only confirm their own orders
      },
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
        orderItems: true
      },
    });

    if (!order) {
      throw new Error('Order not found or not in manager replied status');
    }

    // ✅ Update order status to APPROVED_ORDER in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'APPROVED_ORDER',
          approvedAt: new Date(),
        },
      });

      return updatedOrder;
    });

    // ✅ Create notification(s) for manager reply confirmation (notify managers + admins)
    try {
      const adminUsers = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
      const mgrs = await prisma.managerBranch.findMany({ where: { branchId: order.branch.id }, select: { managerId: true } });
      const userIds = [...(adminUsers.map(a => a.id)), ...(mgrs.map(m => m.managerId))];
      if (order.managerId) userIds.push(order.managerId);
      await notifyUsers(userIds, order.id, 'ORDER_CONFIRMED', 'Manager Reply Confirmed', `Branch user has confirmed the manager's reply for order ${order.orderNumber}`);
    } catch (notifyErr) {
      console.error('Failed to create manager reply confirmation notifications:', notifyErr);
    }

    // ✅ Send optional email / WhatsApp notification
    try {
      await sendManagerReplyConfirmationNotification(order);
    } catch (notificationError) {
      console.error(
        'Failed to send manager reply confirmation notifications:',
        notificationError
      );
    }

    return {
      success: true,
      data: order,
      message: 'Manager reply confirmed successfully',
    };
  } catch (error) {
    console.error('Confirm manager reply error:', error);
    return {
      success: false,
      message: error.message || 'Failed to confirm manager reply',
      error: error.message,
    };
  }
};

/**
 * Manager closes the order
 * @param {string} orderId - ID of the order
 * @param {string} managerId - ID of the manager closing
 * @returns {Object} Updated order details
 */
const closeOrder = async (orderId, actorId) => {
  try {
    // Step 1: Validate the order exists and is in CONFIRM_ORDER_RECEIVED status
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        status: 'CONFIRM_ORDER_RECEIVED'
      },
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        branch: {
          select: {
            id: true,
            name: true
          }
        },
        // ✅ Just fetch orderItems directly (no 'item' relation anymore)
        orderItems: true
      }
    });

    if (!order) {
      throw new Error('Order not found or not in confirm order received status');
    }

    // Step 2: Update order status to CLOSED_ORDER
    const updatedOrder = await prisma.$transaction(async (tx) => {
      return await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'CLOSED_ORDER',
          closedAt: new Date()
        }
      });
    });

    // Step 3: Notify everyone about order closure (admins, managers and branch users)
    try {
      // Notify all active users in the system
      const activeUsers = await prisma.user.findMany({ where: { isActive: true }, select: { id: true } });
      const userIds = activeUsers.map(u => u.id);
      if (userIds.length > 0) await notifyUsers(userIds, order.id, 'ORDER_CLOSED', 'Order Closed', `Order ${order.orderNumber} has been closed`);
    } catch (notifyErr) {
      console.error('Failed to notify users about order closure:', notifyErr);
    }

    // Step 4: Send email and WhatsApp notifications
    try {
      await sendOrderClosedNotification(order);
    } catch (notificationError) {
      console.error('Failed to send order closed notifications:', notificationError);
    }

    // Step 5: Return result
    return {
      success: true,
      data: order,
      message: 'Order closed successfully'
    };

  } catch (error) {
    console.error('Close order error:', error);
    return {
      success: false,
      message: error.message || 'Failed to close order',
      error: error.message
    };
  }
};


/**
 * Update arranging remarks for an order
 * @param {string} orderId - ID of the order
 * @param {string} userId - ID of the user updating remarks
 * @param {string} remarks - The remarks to add
 * @returns {Object} Updated order details
 */
const updateArrangingRemarks = async (orderId, userId, remarks) => {
  try {
    // Step 1: Validate the order exists and user has permission
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
      },
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // Step 2: Update order with arranging remarks
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        remarks: remarks,
      },
    });

    // Step 3: Fetch complete order for response
    const completeOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
        orderItems: true,
      },
    });

    return {
      success: true,
      message: 'Arranging remarks updated successfully',
      data: completeOrder,
    };
  } catch (error) {
    console.error('Update arranging remarks error:', error);
    return {
      success: false,
      message: error.message || 'Failed to update arranging remarks',
      error: error.message,
    };
  }
};

module.exports = {
  createOrder,
  getUserOrders,
  getBranchOrdersService,
  getOrderById,
  getManagerPendingOrders,
  approveOrder,
  dispatchOrder,
  confirmOrder,
  raiseOrderIssue,
  getOrderIssues,
  postDeliveryIssue,
  managerReplyToIssue,
  confirmManagerReply,
  updateOrderStatus,
  confirmOrderReceived,
  reportReceivedIssues,
  closeOrder,
  updateArrangingStage,
  updateArrangingRemarks
};
