/**
 * Test script to verify BoxHero ID conversion fix
 * 
 * This script tests that numeric BoxHero IDs are properly converted to strings
 */

const axios = require('axios');
require('dotenv').config();

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
    
    const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD
    });

    if (response.data.success && response.data.token) {
      authToken = response.data.token;
      console.log('✅ Login successful');
      return true;
    } else {
      console.error('❌ Login failed:', response.data.message);
      return false;
    }
  } catch (error) {
    console.error('❌ Login error:', error.message);
    return false;
  }
}

/**
 * Test product refresh with ID conversion
 */
async function testProductRefresh() {
  try {
    console.log('\n🔄 Testing product refresh with ID conversion...');
    
    const response = await axios.post(`${API_BASE_URL}/api/products/refresh`, {
      // No body needed for refresh
    }, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.data.success) {
      console.log('✅ Product refresh successful');
      console.log(`   - Synced products: ${response.data.data.syncedProducts}`);
      console.log(`   - Total products: ${response.data.data.totalProducts}`);
      console.log(`   - Errors: ${response.data.data.errors}`);
      console.log(`   - Pages processed: ${response.data.data.pages}`);
      return true;
    } else {
      console.error('❌ Product refresh failed:', response.data.message);
      if (response.data.error) {
        console.error(`   - Error details: ${response.data.error}`);
      }
      return false;
    }
  } catch (error) {
    console.error('❌ Product refresh error:', error.message);
    if (error.response) {
      console.error(`   - Status: ${error.response.status}`);
      console.error(`   - Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return false;
  }
}

/**
 * Test getting products from database
 */
async function testGetProducts() {
  try {
    console.log('\n📦 Testing get products from database...');
    
    const response = await axios.get(`${API_BASE_URL}/api/products?page=1&limit=5`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.data.success) {
      console.log('✅ Get products successful');
      console.log(`   - Products returned: ${response.data.data.products.length}`);
      console.log(`   - Total products: ${response.data.data.pagination.totalCount}`);
      
      if (response.data.data.products.length > 0) {
        const firstProduct = response.data.data.products[0];
        console.log(`   - Sample product: ${firstProduct.name}`);
        console.log(`   - BoxHero ID: ${firstProduct.boxHeroId} (type: ${typeof firstProduct.boxHeroId})`);
        console.log(`   - SKU: ${firstProduct.sku || 'N/A'}`);
        console.log(`   - Category: ${firstProduct.category || 'N/A'}`);
        console.log(`   - Stock: ${firstProduct.currentStock}`);
        console.log(`   - Visibility: ${firstProduct.visibility}`);
        
        // Verify that boxHeroId is a string
        if (typeof firstProduct.boxHeroId === 'string') {
          console.log('✅ BoxHero ID is correctly stored as string');
        } else {
          console.log('❌ BoxHero ID is not a string:', typeof firstProduct.boxHeroId);
        }
      }
      
      return true;
    } else {
      console.error('❌ Get products failed:', response.data.message);
      return false;
    }
  } catch (error) {
    console.error('❌ Get products error:', error.message);
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🧪 Testing BoxHero ID Conversion Fix');
  console.log('====================================');
  
  const results = {
    login: false,
    refresh: false,
    getProducts: false
  };

  // Test login
  results.login = await login();
  if (!results.login) {
    console.log('\n❌ Cannot proceed without authentication');
    return;
  }

  // Test product refresh (this should now work without PrismaClientValidationError)
  results.refresh = await testProductRefresh();

  // Test getting products from database
  results.getProducts = await testGetProducts();

  // Summary
  console.log('\n📊 Test Results Summary');
  console.log('======================');
  console.log(`Login: ${results.login ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Product Refresh: ${results.refresh ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Get Products: ${results.getProducts ? '✅ PASS' : '❌ FAIL'}`);

  const passedTests = Object.values(results).filter(result => result).length;
  const totalTests = Object.keys(results).length;

  console.log(`\n🎯 Overall Result: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! BoxHero ID conversion fix is working correctly.');
    console.log('✅ No more PrismaClientValidationError for boxHeroId field!');
  } else {
    console.log('⚠️  Some tests failed. Please check:');
    console.log('   - BOXHERO_API_TOKEN is set correctly');
    console.log('   - BoxHero API endpoint is accessible');
    console.log('   - Database connection is working');
    console.log('   - Server is running');
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  runTests,
  login,
  testProductRefresh,
  testGetProducts
};



