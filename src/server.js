const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/authRoutes');
const itemRoutes = require('./routes/itemRoutes');
const orderRoutes = require('./routes/orderRoutes');
const productRoutes = require('./routes/productRoutes');
const branchRoutes = require('./routes/branchRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
// Admin routes (to be created)
const adminUserRoutes = require('./routes/adminUserRoutes');
const adminBranchRoutes = require('./routes/adminBranchRoutes');
const adminAssignmentRoutes = require('./routes/adminAssignmentRoutes');
const adminStaffAssignmentRoutes = require('./routes/adminStaffAssignmentRoutes');

// Import services
const { syncProductsFromBoxHero } = require('./services/boxHeroService');

// Import cron for scheduled tasks
const cron = require('node-cron');
// Auto-close job
const { scheduleAutoClose } = require('./jobs/autoCloseOrders');

const app = express();
const PORT = process.env.PORT || 3003;

/**
 * Security Middleware
 */
app.use(helmet());

/**
 * FIXED CORS FOR AUTH COOKIE + PUT REQUESTS
 */
const allowedOrigins = [
  'http://localhost:3000',
  'https://demo2.mysteryrooms.work',
  'https://your-frontend.com',
  'https://admin.your-frontend.com'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

/**
 * Rate Limiting
 */

/**
 * Body Parsing Middleware
 */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * Request Logging Middleware
 */
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

/**
 * Health Check Endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Inventory Management System API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * API Routes
 */
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/products', productRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/notifications', notificationRoutes);
// File upload endpoint
app.use('/api/upload', uploadRoutes);
// Serve uploaded files
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
// Admin-only route mounts
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/branches', adminBranchRoutes);
app.use('/api/admin/assignments', adminAssignmentRoutes);
app.use('/api/admin/staff-assignments', adminStaffAssignmentRoutes);

// TODO: Add more route modules as they are created
// app.use('/api/branches', branchRoutes);
// app.use('/api/notifications', notificationRoutes);

/**
 * 404 Handler - Only for API routes
 */
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    path: req.originalUrl
  });
});

/**
 * Global Error Handler
 */
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    ...(isDevelopment && { stack: error.stack })
  });
});

/**
 * Scheduled Tasks (Cron Jobs)
 */
// Sync products from BoxHero every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  console.log('🕐 Running scheduled BoxHero products sync...');
  try {
    const result = await syncProductsFromBoxHero();
    if (result.success) {
      console.log(`✅ Scheduled sync completed: ${result.message}`);
    } else {
      console.error(`❌ Scheduled sync failed: ${result.message}`);
    }
  } catch (error) {
    console.error('❌ Scheduled sync error:', error);
  }
}, {
  scheduled: true,
  timezone: "UTC"
});

// Log cron job status
console.log('⏰ Scheduled tasks initialized:');
console.log('  - BoxHero products sync: Every 5 minutes');

// Start auto-close scheduler
scheduleAutoClose();

/**
 * Graceful Shutdown Handler
 */
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

/**
 * Start Server
 */
// SMTP configuration check - helps with diagnosing Gmail auth errors (EAUTH)
const smtpConfigured = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
if (!smtpConfigured) {
  console.log('⚠️ SMTP not configured: email sends will be mocked. Set SMTP_HOST, SMTP_USER and SMTP_PASS to enable real emails.');
} else {
  console.log('✅ SMTP configured. If you see "Invalid login" (EAUTH) from Gmail, generate an App Password or use OAuth2: https://support.google.com/mail/?p=BadCredentials');
}

app.listen(PORT, () => {
  console.log('🚀 Inventory Management System API Server Started');
  console.log(`📍 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth`);
  console.log('');
  console.log('📋 Available endpoints:');
  console.log('  POST /api/auth/register - Register new user (Admin/Manager only)');
  console.log('  POST /api/auth/login - Login user');
  console.log('  GET  /api/auth/profile - Get user profile (Auth required)');
  console.log('  PUT  /api/auth/profile - Update user profile (Auth required)');
  console.log('  PUT  /api/auth/change-password - Change password (Auth required)');
  console.log('  POST /api/auth/logout - Logout user (Auth required)');
  console.log('  GET  /api/items - Get all items (Auth required)');
  console.log('  GET  /api/items/categories - Get item categories (Auth required)');
  console.log('  POST /api/products/refresh - Refresh products from BoxHero (All authenticated users)');
  console.log('  GET  /api/products - Get all products (Auth required)');
  console.log('  GET  /api/products/categories - Get product categories (Auth required)');
  console.log('  GET  /api/products/fetch-boxhero - Fetch products directly from BoxHero API (Auth required)');
  console.log('  POST /api/orders - Create new order (BRANCH_USER only)');
  console.log('  GET  /api/orders/my-orders - Get user orders (Auth required)');
  console.log('  GET  /api/orders/:id - Get specific order (Auth required)');
  console.log('  GET  /api/orders/manager/pending - Get pending orders (MANAGER only)');
  console.log('  PUT  /api/orders/approve/:orderId - Approve order (MANAGER only)');
  console.log('  PUT  /api/orders/dispatch/:orderId - Dispatch order (MANAGER only)');
  console.log('  PUT  /api/orders/confirm/:orderId - Confirm order (BRANCH_USER only)');
  console.log('  PUT  /api/orders/raise-issue/:orderId - Raise issue (BRANCH_USER only)');
  console.log('  PUT  /api/orders/reply/:orderId - Manager reply (MANAGER only)');
  console.log('  PUT  /api/orders/update-status/:orderId - Update status (MANAGER only)');
  console.log('  PUT  /api/orders/confirm-received/:orderId - Confirm received (BRANCH_USER only)');
  // manual close route removed: auto-close handles order finalization
  console.log('');
  console.log('⏰ Scheduled tasks are running...');
});

module.exports = app;
