# BoxHero API Integration - Troubleshooting Guide

## 🚨 Common Issues and Solutions

### 1. **"fetch is not a function" Error**

**Problem**: `TypeError: fetch is not a function`

**Causes**:
- Using Node.js version < 18 (fetch is not globally available)
- Using `node-fetch` v3+ with CommonJS (ES module incompatibility)
- Missing or incorrect import

**Solutions**:

#### Option A: Install node-fetch v2 (Recommended)
```bash
npm install node-fetch@2.7.0
```

#### Option B: Use axios instead
```bash
npm install axios
```
Then update `boxHeroService.js`:
```javascript
const axios = require('axios');

// Replace fetch calls with axios
const response = await axios.get(url, {
  headers: {
    'Authorization': `Bearer ${process.env.BOXHERO_API_TOKEN}`,
    'Content-Type': 'application/json'
  }
});
```

#### Option C: Upgrade to Node.js 18+
```bash
# Check current version
node -v

# If < 18, upgrade Node.js to 18+ for native fetch support
```

### 2. **Module Import Errors**

**Problem**: `Error: Cannot find module 'node-fetch'`

**Solution**:
```bash
# Reinstall dependencies
npm install

# Or specifically install node-fetch
npm install node-fetch@2.7.0
```

### 3. **BoxHero API Token Issues**

**Problem**: `BOXHERO_API_TOKEN environment variable is not set`

**Solutions**:
1. **Check .env file exists**:
   ```bash
   ls -la .env
   ```

2. **Create .env from example**:
   ```bash
   cp env.example .env
   ```

3. **Update .env file**:
   ```env
   BOXHERO_API_TOKEN="your-actual-boxhero-api-token"
   BOXHERO_BASE_URL="https://api.boxhero.com"
   ```

4. **Restart server** after updating .env

### 4. **Database Connection Issues**

**Problem**: Database connection errors during sync

**Solutions**:
1. **Check DATABASE_URL in .env**:
   ```env
   DATABASE_URL="mysql://username:password@localhost:3306/inventory_management"
   ```

2. **Generate Prisma client**:
   ```bash
   npm run db:generate
   ```

3. **Push schema changes**:
   ```bash
   npm run db:push
   ```

4. **Test database connection**:
   ```bash
   npm run db:studio
   ```

### 5. **API Response Format Issues**

**Problem**: Unexpected response format from BoxHero API

**Debug Steps**:
1. **Check API response**:
   ```javascript
   console.log('API Response:', JSON.stringify(response, null, 2));
   ```

2. **Verify API endpoint**:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        "https://api.boxhero.com/products?limit=10"
   ```

3. **Check BoxHero API documentation** for correct endpoint format

### 6. **Rate Limiting Issues**

**Problem**: 429 Too Many Requests errors

**Solutions**:
1. **Increase delays** in `boxHeroService.js`:
   ```javascript
   const RATE_LIMIT_DELAY = 2000; // Increase to 2 seconds
   const RETRY_DELAY = 5000; // Increase to 5 seconds
   ```

2. **Reduce batch size**:
   ```javascript
   limit: '50', // Reduce from 100 to 50
   ```

3. **Check BoxHero API rate limits** in their documentation

### 7. **Authentication Issues**

**Problem**: 401 Unauthorized errors

**Solutions**:
1. **Verify token format**:
   ```javascript
   console.log('Token:', process.env.BOXHERO_API_TOKEN);
   ```

2. **Check token expiration**:
   - Generate new token from BoxHero dashboard
   - Update .env file with new token

3. **Verify token permissions**:
   - Ensure token has product read permissions
   - Check token scope in BoxHero settings

### 8. **Memory Issues with Large Datasets**

**Problem**: Out of memory errors during sync

**Solutions**:
1. **Process in smaller batches**:
   ```javascript
   limit: '25', // Reduce batch size
   ```

2. **Add memory monitoring**:
   ```javascript
   console.log('Memory usage:', process.memoryUsage());
   ```

3. **Increase Node.js memory**:
   ```bash
   node --max-old-space-size=4096 src/server.js
   ```

## 🔧 Quick Fix Commands

### Complete Reset
```bash
# Stop server
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Install correct node-fetch version
npm install node-fetch@2.7.0

# Regenerate Prisma client
npm run db:generate

# Push database schema
npm run db:push

# Start server
npm run dev
```

### Windows Reset
```cmd
REM Stop server
REM Delete node_modules and reinstall
rmdir /s node_modules
del package-lock.json
npm install

REM Install correct node-fetch version
npm install node-fetch@2.7.0

REM Regenerate Prisma client
npm run db:generate

REM Push database schema
npm run db:push

REM Start server
npm run dev
```

## 🧪 Testing Commands

### Test API Integration
```bash
# Test real BoxHero API
node test-real-boxhero-api.js

# Test product sync
node test-boxhero-product-sync.js
```

### Manual API Test
```bash
# Test BoxHero API directly
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     "https://rest.boxhero-app.com/v1/items?limit=5"
```

## 📊 Debugging Tips

### Enable Debug Logging
```javascript
// In boxHeroService.js, add more logging
console.log('🌐 Making API request to:', url);
console.log('🔑 Token status:', process.env.BOXHERO_API_TOKEN ? 'Set' : 'Not set');
console.log('📡 Response status:', response.status);
console.log('📦 Response data:', JSON.stringify(responseData, null, 2));
```

### Check Environment Variables
```bash
# Check if variables are loaded
node -e "require('dotenv').config(); console.log('Token:', process.env.BOXHERO_API_TOKEN ? 'Set' : 'Not set');"
```

### Monitor Server Logs
```bash
# Start server with verbose logging
DEBUG=* npm run dev

# Or just start normally and watch logs
npm run dev
```

## 🆘 Still Having Issues?

1. **Check Node.js version**: `node -v` (should be 14+)
2. **Check npm version**: `npm -v`
3. **Verify all dependencies**: `npm list`
4. **Check server logs** for specific error messages
5. **Test API endpoint manually** with curl or Postman
6. **Verify BoxHero API token** is valid and has correct permissions

## 📞 Support

If you're still experiencing issues:
1. Check the server console logs for specific error messages
2. Verify your BoxHero API token and permissions
3. Test the API endpoint manually
4. Check Node.js and npm versions
5. Ensure all dependencies are properly installed
