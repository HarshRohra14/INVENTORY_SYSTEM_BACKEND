# BoxHero Product Sync Enhancement

This enhancement adds comprehensive BoxHero product synchronization functionality to the Next.js + Prisma inventory management system.

## 🚀 Features Added

### Backend API Routes
- **POST /api/products/refresh** - Sync products from BoxHero API with pagination and filtering (All authenticated users)
- **GET /api/products** - Get all products with pagination and search
- **GET /api/products/categories** - Get unique product categories

### Frontend Dashboard Enhancement
- **Refresh Products Button** - Manual sync trigger with loading states
- **Success/Error Messages** - Real-time feedback for sync operations
- **Auto-refresh** - Automatically updates product list after sync

### Advanced Features
- **Pagination Support** - Handles large product catalogs efficiently
- **Visibility Filtering** - Only syncs products with `Visibility = "Listed"`
- **Rate Limiting** - Respects BoxHero API rate limits with retry logic
- **Error Handling** - Comprehensive error handling with user notifications
- **Database Upserts** - Efficiently updates existing products or creates new ones

## 📋 Database Schema Changes

### New Product Table
```prisma
model Product {
  id           String   @id @default(cuid())
  boxHeroId    String   @unique // BoxHero's product ID
  name         String
  sku          String?
  category     String?
  unit         String?
  currentStock Int      @default(0)
  visibility   String   @default("Listed") // Filter for Visibility = "Listed"
  lastSyncedAt DateTime @default(now())
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@map("products")
}
```

## 🔧 Configuration

### Environment Variables
Update your `.env` file with:
```env
# BoxHero API Configuration
BOXHERO_API_TOKEN="your-boxhero-api-token-here"
BOXHERO_BASE_URL="https://api.boxhero.com"
```

### Database Migration
Run the following commands to apply schema changes:
```bash
# Generate Prisma client
npm run db:generate

# Push schema changes to database
npm run db:push
```

## 🛠️ API Endpoints

### Refresh Products
```http
POST /api/products/refresh
Authorization: Bearer <token>
Content-Type: application/json
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully synced 150 products",
  "data": {
    "syncedProducts": 150,
    "totalProducts": 150,
    "errors": 0,
    "pages": 2,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### Get Products
```http
GET /api/products?page=1&limit=20&search=laptop&category=Electronics
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "prod_123",
        "boxHeroId": "boxhero_prod_456",
        "name": "Laptop Computer",
        "sku": "LAP001",
        "category": "Electronics",
        "unit": "pcs",
        "currentStock": 25,
        "visibility": "Listed",
        "lastSyncedAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalCount": 100,
      "hasNextPage": true,
      "hasPrevPage": false,
      "limit": 20
    }
  }
}
```

### Get Product Categories
```http
GET /api/products/categories
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": ["Electronics", "Office Supplies", "Furniture"]
}
```

## 🔄 Sync Process

### How It Works
1. **API Call** - Makes paginated requests to BoxHero API
2. **Filtering** - Filters products with `Visibility = "Listed"`
3. **Rate Limiting** - Implements delays between requests to respect API limits
4. **Retry Logic** - Automatically retries failed requests up to 3 times
5. **Database Upsert** - Updates existing products or creates new ones
6. **Notifications** - Creates system notifications for sync results

### Rate Limiting Configuration
- **Request Delay**: 1 second between API calls
- **Retry Delay**: 2 seconds between retry attempts
- **Max Retries**: 3 attempts per request
- **Rate Limit Handling**: Automatic retry with exponential backoff

## 🎨 Frontend Integration

### Dashboard Button
The "Refresh Products" button is added to the dashboard header with:
- **Loading State** - Shows spinner and "Refreshing..." text
- **Success Message** - Displays number of synced products
- **Error Handling** - Shows error messages if sync fails
- **Auto-refresh** - Automatically updates the product list

### User Experience
- **Real-time Feedback** - Immediate visual feedback during sync
- **Non-blocking** - Users can continue using the app during sync
- **Error Recovery** - Clear error messages with retry options
- **Progress Indication** - Loading states and progress messages

## 🧪 Testing

### Test Script
Run the comprehensive test suite:
```bash
node test-boxhero-product-sync.js
```

### Test Coverage
- ✅ Authentication and authorization
- ✅ Product refresh functionality
- ✅ Product listing with pagination
- ✅ Category retrieval
- ✅ Error handling and unauthorized access
- ✅ Rate limiting and retry logic

## 🔒 Security Features

### Access Control
- **Authentication Required** - All endpoints require valid JWT token
- **Universal Access** - All authenticated users (Admin, Manager, Branch User) can refresh products
- **Input Validation** - Comprehensive input validation and sanitization

### Error Handling
- **Graceful Degradation** - System continues to work even if sync fails
- **User Notifications** - Clear error messages for users
- **Logging** - Comprehensive server-side logging for debugging

## 📊 Monitoring

### System Notifications
The system creates notifications for:
- **Sync Success** - Number of products synced
- **Sync Failures** - Error details and troubleshooting info
- **System Alerts** - General system health and status

### Logging
Comprehensive logging includes:
- **API Requests** - All BoxHero API calls and responses
- **Rate Limiting** - Rate limit hits and retry attempts
- **Database Operations** - Product upsert operations
- **Error Tracking** - Detailed error logs for debugging

## 🚀 Usage

### Manual Sync
1. Navigate to the dashboard
2. Click the "Refresh Products" button
3. Wait for the sync to complete
4. View the success message with sync statistics

### Automatic Sync
The system also includes scheduled sync (every 10 minutes) via cron job for automatic updates.

## 🔧 Troubleshooting

### Common Issues

#### API Token Issues
```bash
# Check if token is set
echo $BOXHERO_API_TOKEN

# Verify token format
# Should be a valid Bearer token string
```

#### Database Connection
```bash
# Test database connection
npm run db:studio

# Check schema sync
npm run db:push
```

#### Rate Limiting
- If you see rate limit errors, the system will automatically retry
- Check BoxHero API documentation for current rate limits
- Consider reducing sync frequency if needed

### Debug Mode
Enable debug logging by setting:
```env
NODE_ENV=development
```

## 📈 Performance

### Optimization Features
- **Pagination** - Handles large product catalogs efficiently
- **Batch Processing** - Processes products in batches
- **Database Indexing** - Optimized database queries
- **Caching** - Efficient data caching strategies

### Scalability
- **Horizontal Scaling** - Supports multiple server instances
- **Database Optimization** - Efficient database operations
- **API Rate Management** - Respects external API limits
- **Memory Management** - Optimized memory usage

## 🎯 Future Enhancements

### Planned Features
- **Incremental Sync** - Only sync changed products
- **Webhook Support** - Real-time updates from BoxHero
- **Advanced Filtering** - More sophisticated product filtering
- **Bulk Operations** - Batch product operations
- **Analytics Dashboard** - Sync statistics and monitoring

### Integration Opportunities
- **Email Notifications** - Email alerts for sync results
- **WhatsApp Integration** - Mobile notifications
- **Advanced Reporting** - Detailed sync reports
- **API Documentation** - Interactive API documentation

---

## 📝 Summary

This enhancement provides a robust, scalable, and user-friendly solution for synchronizing products from the BoxHero API. The implementation includes comprehensive error handling, rate limiting, pagination support, and a modern React frontend interface.

The system is production-ready with proper security, monitoring, and testing capabilities.
