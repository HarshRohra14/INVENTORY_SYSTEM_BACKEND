const Joi = require('joi');

const {
  createOrder,
  getUserOrders,
  getOrderById,
  getManagerPendingOrders,
  approveOrder,
  dispatchOrder,
  confirmOrder,
  raiseOrderIssue,
  managerReplyToIssue,
  confirmManagerReply,
  updateOrderStatus,
  updateArrangingStage,
  updateArrangingRemarks,
  confirmOrderReceived,
  closeOrder,
  getOrderIssues,
  reportReceivedIssues
} = require('../services/orderService');

/**
 * Create a new order
 * POST /api/orders
 */
const createOrderController = async (req, res) => {
  try {
    const schema = Joi.object({
      // Backwards compatible: `items` (treated as in-stock)
      items: Joi.array()
        .items(
          Joi.object({
            sku: Joi.string().trim().required(),
            quantity: Joi.number().integer().min(1).required(),
          })
        )
        .optional(),
      inStockItems: Joi.array().items(
        Joi.object({ sku: Joi.string().trim().required(), quantity: Joi.number().integer().min(1).required() })
      ).optional(),
      outOfStockItems: Joi.array().items(
        Joi.object({ sku: Joi.string().trim().required(), quantity: Joi.number().integer().min(1).required() })
      ).optional(),
      remarks: Joi.string().max(500).optional().allow("")
    }).or('items', 'inStockItems', 'outOfStockItems');

    const { error, value } = schema.validate(req.body);
    if (error)
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message),
      });

    const { items, inStockItems, outOfStockItems, remarks } = value;
    const orderData = {
      requesterId: req.user.id,
      branchId: req.user.branchId,
      remarks,
      // pass both arrays to service (service handles legacy `items`)
      items: items || undefined,
      inStockItems: inStockItems || undefined,
      outOfStockItems: outOfStockItems || undefined
    };

    const result = await createOrder(orderData);
    if (!result.success)
      return res.status(400).json({
        success: false,
        message: result.message,
        error: result.error,
      });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: result.data,
    });
  } catch (error) {
    console.error('❌ Create order controller error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while creating order.',
      error: error.message,
    });
  }
};

/**
 * Get current user's orders
 * GET /api/orders/my-orders
 */
const getMyOrders = async (req, res) => {
  try {
    const schema = Joi.object({
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().integer().min(1).max(100).optional(),
      status: Joi.string()
        .valid(
          'UNDER_REVIEW',
          'ACCEPTED_ORDER',
          'UNDER_PACKAGING',
          'IN_TRANSIT',
          'RECEIVED',
          'CLOSED',
          'ARRANGING',
          'ARRANGED',
          'SENT_FOR_PACKAGING'
        )
        .optional(),
    });

    const { error, value } = schema.validate(req.query);
    if (error)
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message),
      });

    const { page = 1, limit = 20, status } = value;
    const result = await getUserOrders(req.user.id, { page, limit, status });

    if (!result.success)
      return res.status(400).json({
        success: false,
        message: result.message,
      });

    res.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Get my orders controller error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching orders.',
    });
  }
};

/**
 * Get a specific order by ID
 * GET /api/orders/:id
 */
const getOrderByIdController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await getOrderById(id, req.user.id);

    if (!result.success)
      return res.status(404).json({
        success: false,
        message: result.message,
      });

    res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error('❌ Get order by ID controller error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching order.',
    });
  }
};

/**
 * Get pending orders for managers
 * GET /api/orders/manager/pending
 */
const getManagerPendingOrdersController = async (req, res) => {
  try {
    const schema = Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      branchId: Joi.string().optional(),
      status: Joi.string().optional()
    });

    const { error, value } = schema.validate(req.query);
    if (error)
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message),
      });

    const { page, limit, branchId, status } = value;
    const result = await getManagerPendingOrders(req.user.id, {
      page,
      limit,
      branchId,
      status,
    }, req.user.role);

    if (!result?.success)
      return res.status(400).json({
        success: false,
        message: result?.message || 'Failed to fetch pending orders',
      });

    res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('❌ Get manager pending orders controller error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching pending orders.',
    });
  }
};


/**
 * PUT /api/orders/arranging-stage/:orderId
 * Body: { arrangingStage: 'ARRANGING' | 'ARRANGED' | 'SENT_FOR_PACKAGING' }
 */
const updateArrangingStageController = async (req, res) => {
  try {
    console.log("🔥 Arranging update request:", req.params.orderId, req.body);

    const { orderId } = req.params;
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const schema = Joi.object({
      arrangingStage: Joi.string().valid('ARRANGING', 'ARRANGED', 'SENT_FOR_PACKAGING').required()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      });
    }

    // build media paths from uploaded files (if any)
    const files = req.files || [];
    const mediaPaths = files.map(f => `/uploads/${(f.filename || require('path').basename(f.path))}`);

    // For ARRANGED and SENT_FOR_PACKAGING require at least one media file
    if (['ARRANGED', 'SENT_FOR_PACKAGING'].includes(value.arrangingStage) && mediaPaths.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one photo/video is required to change to this arranging stage.' });
    }

    const result = await updateArrangingStage(orderId, req.user.id, value.arrangingStage, mediaPaths);

    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        success: false,
        message: result.message
      });
    }

    return res.json({ success: true, message: 'Arranging stage updated', data: result.data });

  } catch (err) {
    console.error('Arranging controller error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};



/**
 * Approve an order with modified quantities
 * Managers can INCREASE quantities during approval ✅
 * PUT /api/orders/approve/:orderId
 */
const approveOrderController = async (req, res) => {
  try {
    const { orderId } = req.params;

    const schema = Joi.object({
      approvedItems: Joi.array()
        .items(
          Joi.object({
            sku: Joi.string().required(),
            qtyApproved: Joi.number().integer().min(0).required(),
          })
        )
        .min(1)
        .required(),
    });

    const { error, value } = schema.validate(req.body);
    if (error)
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message),
      });

    const { approvedItems } = value;
    const result = await approveOrder(orderId, req.user.id, approvedItems);

    if (!result.success)
      return res.status(400).json({
        success: false,
        message: result.message,
      });

    res.json({
      success: true,
      message: result.message,
      data: result.data,
      quantityChanges: result.quantityChanges,  // ✅ Include quantity change details
    });
  } catch (error) {
    console.error('Approve order controller error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while approving order.',
    });
  }
};


/**
 * Dispatch an approved order
 * PUT /api/orders/dispatch/:orderId
 */
const dispatchOrderController = async (req, res) => {
  try {
    const { orderId } = req.params;
    const schema = Joi.object({
      trackingId: Joi.string().min(1).max(100).required(),
      courierLink: Joi.string().uri().optional().allow(''),
    });

    const { error, value } = schema.validate(req.body);
    if (error)
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message),
      });

    const { trackingId, courierLink } = value;

    // build media paths from uploaded files
    const files = req.files || [];
    const mediaPaths = files.map(f => `/uploads/${(f.filename || require('path').basename(f.path))}`);

    // Require at least one media for dispatching (IN_TRANSIT)
    if (mediaPaths.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one photo/video is required to dispatch the order.' });
    }

    const result = await dispatchOrder(orderId, req.user.id, {
      trackingId,
      courierLink,
    }, mediaPaths);

    if (!result.success)
      return res.status(400).json({
        success: false,
        message: result.message,
      });

    res.json({
      success: true,
      message: result.message,
      data: result.data,
      stockUpdateResult: result.stockUpdateResult,
    });
  } catch (error) {
    console.error('Dispatch order controller error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while dispatching order.',
    });
  }
};

/**
 * Confirm an order (branch user accepts approved order)
 * PUT /api/orders/confirm/:orderId
 */
const confirmOrderController = async (req, res) => {
  try {
    const { orderId } = req.params;
    const result = await confirmOrder(orderId, req.user.id);

    if (!result.success)
      return res.status(400).json({
        success: false,
        message: result.message,
      });

    res.json({ success: true, message: result.message, data: result.data });
  } catch (error) {
    console.error('Confirm order controller error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while confirming order.',
    });
  }
};

/**
 * Raise issue(s) (branch user)
 * Accepts either a single string `issueReason` or an array `issues: [{ itemId, reason }]`
 */
const raiseOrderIssueController = async (req, res) => {
  try {
    const { orderId } = req.params;

    console.log("🔥 Received raise issue body:", req.body);

    const schema = Joi.object({
      issueReason: Joi.alternatives().try(
        Joi.string().min(1).max(500),
        Joi.object().pattern(
          Joi.string(),
          Joi.string().min(1).max(500)
        ), // handle object form
        Joi.array().items(
          Joi.object({
            itemId: Joi.string().optional(),
            reason: Joi.string().min(1).max(500).required(),
          })
        )
      ).optional(),
      issues: Joi.array()
        .items(
          Joi.object({
            itemId: Joi.string().optional(),
            reason: Joi.string().min(1).max(500).required(),
          })
        )
        .optional(),
    }).or('issueReason', 'issues');

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message),
      });
    }

    let payload;

    // ✅ Handle object-to-array conversion
    if (value.issueReason && typeof value.issueReason === 'object' && !Array.isArray(value.issueReason)) {
      payload = Object.entries(value.issueReason).map(([itemId, reason]) => ({
        itemId,
        reason,
      }));
    } else {
      payload = value.issues || value.issueReason;
    }

    const result = await raiseOrderIssue(orderId, req.user.id, payload);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
      });
    }

    res.json({ success: true, message: result.message, data: result.data });
  } catch (error) {
    console.error('Raise order issue controller error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while raising order issue.',
    });
  }
};




/**
 * Get all issues for an order
 * GET /api/orders/:orderId/issues
 */
const getOrderIssuesController = async (req, res) => {
  try {
    const { orderId } = req.params;
    const result = await getOrderIssues(orderId, req.user.id, req.user.role);

    if (!result.success) {
      return res
        .status(400)
        .json({ success: false, message: result.message });
    }

    res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error('Get order issues controller error:', error);
    res.status(500).json({
      success: false,
      message:
        'Internal server error while fetching order issues.',
    });
  }
};

/**
 * Manager replies to raised issue
 */


const managerReplyController = async (req, res) => {
  try {
    const { orderId } = req.params;
    console.log("🔥 Manager reply body:", req.body);

    const schema = Joi.object({
  replies: Joi.array()
    .items(
      Joi.object({
        itemId: Joi.string().trim().required(),
        reply: Joi.string().min(1).max(500).required(),
        qtyApproved: Joi.number().integer().min(0).optional(),
        issueIds: Joi.array().items(Joi.string().trim()).optional(),
      })
    )
    .min(1)
    .required(),
});


    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.details.map((d) => d.message),
      });
    }

    const result = await managerReplyToIssue(
      orderId,
      req.user.id,
      req.user.role,
      value.replies
    );

    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message });
    }

    return res.json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    console.error("❌ Manager reply controller error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while sending manager reply.",
    });
  }
};




/**
 * Update order status
 */
const updateOrderStatusController = async (req, res) => {
  console.log('🔍 DEBUG - updateOrderStatusController called!');
  console.log('🔍 DEBUG - Request method:', req.method);
  console.log('🔍 DEBUG - Request URL:', req.url);
  console.log('🔍 DEBUG - Request params:', req.params);
  
  try {
    const { orderId } = req.params;

    // ---------------------------------------------------------
    // 🔥 NORMALIZE BODY (form-data breaks req.body sometimes)
    // ---------------------------------------------------------
    let body = { ...req.body };

    // Convert multipart tracking fields → object
    if (
      body["trackingDetails[trackingId]"] ||
      body["trackingDetails[trackingLink]"]
    ) {
      body.trackingDetails = {
        trackingId: body["trackingDetails[trackingId]"] || "",
        trackingLink: body["trackingDetails[trackingLink]"] || "",
      };
    }

    // Normalize newStatus (must exist)
    if (!body.newStatus && req.body.newStatus) {
      body.newStatus = req.body.newStatus;
    }

    // Normalize expectedDeliveryTime if sent via form-data
    if (!body.expectedDeliveryTime && req.body.expectedDeliveryTime) {
      body.expectedDeliveryTime = req.body.expectedDeliveryTime;
    }

    // ---------------------------------------------------------
    // 🔥 DEBUG: Log what we're receiving
    // ---------------------------------------------------------
    console.log('🔍 DEBUG - Request body:', JSON.stringify(body, null, 2));
    console.log('🔍 DEBUG - Request files:', req.files);
    console.log('🔍 DEBUG - User:', req.user);

    // ---------------------------------------------------------
    // 🔥 JOI VALIDATION SCHEMA
    // ---------------------------------------------------------
    const schema = Joi.object({
      newStatus: Joi.string()
        .valid(
          "UNDER_PACKAGING",
          "PACKAGING_COMPLETED",
          "IN_TRANSIT",
          "ARRANGING",
          "ARRANGED",
          "SENT_FOR_PACKAGING"
        )
        .required(),

      trackingDetails: Joi.object({
        trackingId: Joi.string().optional(),
        trackingLink: Joi.string().uri().optional(),
      }).optional(),

      // ⭐ REQUIRED FOR YOUR FRONTEND
      expectedDeliveryTime: Joi.date().optional(),
      
      // 🔥 Allow remarks field (may come from FormData)
      remarks: Joi.string().optional().allow(''),
      
      // 🔥 Allow any additional fields that might come from FormData
      files: Joi.any().optional(),
    });

    // Validate normalized body
    const { error, value } = schema.validate(body);
    console.log('🔍 DEBUG - Validation error:', error);
    console.log('🔍 DEBUG - Validation value:', value);
    
    if (error) {
      console.log('🔍 DEBUG - Validation failed, returning error');
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.details.map((d) => d.message),
      });
    }

    const { newStatus, trackingDetails, expectedDeliveryTime } = value;

    // ---------------------------------------------------------
    // 🔥 FILES (images/videos)
    // ---------------------------------------------------------
    const files = req.files || [];
    const mediaPaths = files.map(
      (f) => `/uploads/${f.filename || require("path").basename(f.path)}`
    );

    // Require media for packaging + transit
    // 🔥 TEMPORARILY DISABLED FOR TESTING
    /*
    if (
      ["UNDER_PACKAGING", "PACKAGING_COMPLETED", "IN_TRANSIT"].includes(
        newStatus
      ) &&
      mediaPaths.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "At least one photo/video is required to change to this status.",
      });
    }
    */

    // ---------------------------------------------------------
    // 🔥 PROCESS expectedDeliveryTime (make it a Date object)
    // ---------------------------------------------------------
    let deliveryTime = undefined;
    if (expectedDeliveryTime) {
      const parsed = new Date(expectedDeliveryTime);
      if (!isNaN(parsed.getTime())) deliveryTime = parsed;
    }

    // ---------------------------------------------------------
    // 🔥 CALL SERVICE FUNCTION
    // ---------------------------------------------------------
    const result = await updateOrderStatus(
      orderId,
      req.user.id,
      req.user.role,
      newStatus,
      trackingDetails,
      mediaPaths,
      deliveryTime
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
      });
    }

    // ---------------------------------------------------------
    // 🔥 SUCCESS RESPONSE
    // ---------------------------------------------------------
    return res.json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    console.error("Update order status controller error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while updating order status.",
    });
  }
};



/**
 * Confirm order received
 */
const confirmOrderReceivedController = async (req, res) => {
  try {
    const { orderId } = req.params;
    const mediaFiles = req.files || [];
    const result = await confirmOrderReceived(orderId, req.user.id, mediaFiles);

    if (!result.success)
      return res.status(400).json({
        success: false,
        message: result.message,
      });

    res.json({ success: true, message: result.message, data: result.data });
  } catch (error) {
    console.error('Confirm order received controller error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while confirming order received.',
    });
  }
};


/**
 * Report received item-wise issues (FormData: issues JSON + files named media_<itemId>)
 */
const reportReceivedIssuesController = async (req, res) => {
  try {
    const { orderId } = req.params;
    // `issues` expected as JSON string in form-data
    const issuesRaw = req.body.issues;
    if (!issuesRaw) {
      return res.status(400).json({ success: false, message: 'Missing issues payload' });
    }

    let issues;
    try {
      issues = typeof issuesRaw === 'string' ? JSON.parse(issuesRaw) : issuesRaw;
      if (!Array.isArray(issues)) throw new Error('Invalid issues payload');
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Invalid issues JSON' });
    }

    // collect files grouped by itemId
    const files = req.files || [];

    const grouped = {};
    for (const f of files) {
      // fieldname expected like 'media_<itemId>' or 'media-itemId'
      const m = f.fieldname.match(/media[_-](.+)$/);
      const itemId = m ? m[1] : null;
      if (!itemId) continue;
      if (!grouped[itemId]) grouped[itemId] = [];
      grouped[itemId].push(`/uploads/${f.filename}`);
    }

    const userId = req.user.id;
    const result = await reportReceivedIssues(orderId, userId, issues, grouped);

    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message });
    }

    return res.json({ success: true, message: result.message, data: result.data });
  } catch (error) {
    console.error('Report received issues controller error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Confirm manager reply
 */
const confirmManagerReplyController = async (req, res) => {
  try {
    const { orderId } = req.params;
    const result = await confirmManagerReply(orderId, req.user.id);

    if (!result.success)
      return res.status(400).json({
        success: false,
        message: result.message,
      });

    res.json({ success: true, message: result.message, data: result.data });
  } catch (error) {
    console.error('Confirm manager reply controller error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while confirming manager reply.',
    });
  }
};

/**
 * PUT /api/orders/post-delivery-issue/:orderId
 * Branch user opens a post-delivery issue thread (multipart)
 */
const postDeliveryIssueController = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!req.user || req.user.role !== 'BRANCH_USER') {
      return res.status(403).json({ success: false, message: 'Only branch users can raise post-delivery issues' });
    }

    let issues = [];
    if (req.body.issues) {
      if (typeof req.body.issues === 'string') {
        try { issues = JSON.parse(req.body.issues); } catch (e) { issues = []; }
      } else {
        issues = req.body.issues;
      }
    }

    const files = req.files || [];
    const mediaPaths = files.map(f => `/uploads/${(f.filename || require('path').basename(f.path))}`);

    const result = await require('../services/orderService').postDeliveryIssue(orderId, req.user.id, issues, mediaPaths);
    if (!result.success) return res.status(400).json({ success: false, message: result.message });

    return res.json({ success: true, message: result.message, data: result.data });
  } catch (err) {
    console.error('Post delivery issue controller error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};


/**
 * Close order (manual) — disabled. Auto-close scheduler handles closures.
 */
const closeOrderController = async (req, res) => {
  try {
    return res.status(403).json({ success: false, message: 'Manual close has been disabled. Orders will be auto-closed by the system.' });
  } catch (error) {
    console.error('Close order controller error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while closing order.',
    });
  }
};

/**
 * Update arranging remarks for an order
 */
const updateArrangingRemarksController = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { remarks } = req.body;

    if (!remarks || remarks.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Remarks cannot be empty',
      });
    }

    const result = await updateArrangingRemarks(orderId, req.user.id, remarks.trim());

    if (!result.success)
      return res.status(400).json({
        success: false,
        message: result.message,
      });

    res.json({ success: true, message: result.message, data: result.data });
  } catch (error) {
    console.error('Update arranging remarks controller error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while updating arranging remarks.',
    });
  }
};


module.exports = {
  createOrderController,
  getMyOrders,
  getOrderByIdController,
  getManagerPendingOrdersController,
  approveOrderController,
  dispatchOrderController,
  confirmOrderController,
  raiseOrderIssueController,
  managerReplyController,
  getOrderIssuesController,
  confirmManagerReplyController,
  updateOrderStatusController,
  confirmOrderReceivedController,
  closeOrderController,
  postDeliveryIssueController,
  reportReceivedIssuesController,   // ✅ ADD THIS
  updateArrangingStageController,
  updateArrangingRemarksController,
};


