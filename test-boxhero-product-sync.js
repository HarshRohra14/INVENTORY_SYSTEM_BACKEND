/**
 * Test script for BoxHero Product Sync API
 * 
 * This script tests the new product synchronization functionality:
 * - POST /api/products/refresh - Refresh products from BoxHero API
 * - GET /api/products - Get all products with pagination
 * - GET /api/products/categories - Get product categories
 */

const fetch = require('node-fetch');

const API_BASE_URL = process.env.API_URL || 'http://localhost:3001';
const TEST_USER_EMAIL = 'admin@example.com';
const TEST_USER_PASSWORD = 'admin123';

let authToken = '';

/**
 * Login to get authentication token
 */
async function login() {
  try {
    console.log('🔐 Logging in...');
    
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD
      })
    });

    const data = await response.json();

    if (data.success && data.token) {
      authToken = data.token;
      console.log('✅ Login successful');
      return true;
    } else {
      console.error('❌ Login failed:', data.message);
      return false;
    }
  } catch (error) {
    console.error('❌ Login error:', error.message);
    return false;
  }
}

/**
 * Test refresh products endpoint
 */
async function testRefreshProducts() {
  try {
    console.log('\n🔄 Testing refresh products endpoint...');
    
    const response = await fetch(`${API_BASE_URL}/api/products/refresh`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      }
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ Refresh products successful');
      console.log(`   - Synced products: ${data.data.syncedProducts}`);
      console.log(`   - Total products: ${data.data.totalProducts}`);
      console.log(`   - Errors: ${data.data.errors}`);
      console.log(`   - Pages processed: ${data.data.pages}`);
      return true;
    } else {
      console.error('❌ Refresh products failed:', data.message);
      return false;
    }
  } catch (error) {
    console.error('❌ Refresh products error:', error.message);
    return false;
  }
}

/**
 * Test get products endpoint
 */
async function testGetProducts() {
  try {
    console.log('\n📦 Testing get products endpoint...');
    
    const response = await fetch(`${API_BASE_URL}/api/products?page=1&limit=5`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      }
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ Get products successful');
      console.log(`   - Products returned: ${data.data.products.length}`);
      console.log(`   - Total products: ${data.data.pagination.totalCount}`);
      console.log(`   - Current page: ${data.data.pagination.currentPage}`);
      console.log(`   - Total pages: ${data.data.pagination.totalPages}`);
      
      if (data.data.products.length > 0) {
        const firstProduct = data.data.products[0];
        console.log(`   - Sample product: ${firstProduct.name} (SKU: ${firstProduct.sku})`);
      }
      
      return true;
    } else {
      console.error('❌ Get products failed:', data.message);
      return false;
    }
  } catch (error) {
    console.error('❌ Get products error:', error.message);
    return false;
  }
}

/**
 * Test get product categories endpoint
 */
async function testGetProductCategories() {
  try {
    console.log('\n📂 Testing get product categories endpoint...');
    
    const response = await fetch(`${API_BASE_URL}/api/products/categories`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      }
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ Get product categories successful');
      console.log(`   - Categories found: ${data.data.length}`);
      console.log(`   - Categories: ${data.data.join(', ')}`);
      return true;
    } else {
      console.error('❌ Get product categories failed:', data.message);
      return false;
    }
  } catch (error) {
    console.error('❌ Get product categories error:', error.message);
    return false;
  }
}

/**
 * Test error handling for unauthorized access
 */
async function testUnauthorizedAccess() {
  try {
    console.log('\n🚫 Testing unauthorized access...');
    
    const response = await fetch(`${API_BASE_URL}/api/products/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const data = await response.json();

    if (!data.success && response.status === 401) {
      console.log('✅ Unauthorized access properly blocked (authentication required)');
      return true;
    } else {
      console.error('❌ Unauthorized access not properly blocked');
      return false;
    }
  } catch (error) {
    console.error('❌ Unauthorized access test error:', error.message);
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🧪 Starting BoxHero Product Sync API Tests');
  console.log('==========================================');
  
  const results = {
    login: false,
    refreshProducts: false,
    getProducts: false,
    getProductCategories: false,
    unauthorizedAccess: false
  };

  // Test login
  results.login = await login();
  if (!results.login) {
    console.log('\n❌ Cannot proceed without authentication');
    return;
  }

  // Test refresh products
  results.refreshProducts = await testRefreshProducts();

  // Test get products
  results.getProducts = await testGetProducts();

  // Test get product categories
  results.getProductCategories = await testGetProductCategories();

  // Test unauthorized access
  results.unauthorizedAccess = await testUnauthorizedAccess();

  // Summary
  console.log('\n📊 Test Results Summary');
  console.log('======================');
  console.log(`Login: ${results.login ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Refresh Products: ${results.refreshProducts ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Get Products: ${results.getProducts ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Get Product Categories: ${results.getProductCategories ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Unauthorized Access: ${results.unauthorizedAccess ? '✅ PASS' : '❌ FAIL'}`);

  const passedTests = Object.values(results).filter(result => result).length;
  const totalTests = Object.keys(results).length;

  console.log(`\n🎯 Overall Result: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! The BoxHero Product Sync API is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Please check the implementation.');
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  runTests,
  login,
  testRefreshProducts,
  testGetProducts,
  testGetProductCategories,
  testUnauthorizedAccess
};
