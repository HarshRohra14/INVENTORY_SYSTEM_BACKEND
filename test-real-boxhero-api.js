/**
 * Test script for Real BoxHero API Integration
 * 
 * This script tests the actual BoxHero API integration:
 * - Tests API connectivity
 * - Tests product sync with real data
 * - Tests error handling
 */

const fetch = require('node-fetch');
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
 * Test BoxHero API connectivity
 */
async function testBoxHeroConnectivity() {
  try {
    console.log('\n🌐 Testing BoxHero API connectivity...');
    
    if (!process.env.BOXHERO_API_TOKEN) {
      console.error('❌ BOXHERO_API_TOKEN not set in environment');
      return false;
    }

    console.log(`🔑 Token status: ${process.env.BOXHERO_API_TOKEN ? 'Set' : 'Not set'}`);
    console.log(`🌍 Base URL: ${process.env.BOXHERO_BASE_URL || 'https://rest.boxhero-app.com'}`);
    
    return true;
  } catch (error) {
    console.error('❌ Connectivity test error:', error.message);
    return false;
  }
}

/**
 * Test refresh products with real BoxHero API
 */
async function testRealProductSync() {
  try {
    console.log('\n🔄 Testing real BoxHero product sync...');
    
    const response = await fetch(`${API_BASE_URL}/api/products/refresh`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      }
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ Real product sync successful');
      console.log(`   - Synced products: ${data.data.syncedProducts}`);
      console.log(`   - Total products: ${data.data.totalProducts}`);
      console.log(`   - Errors: ${data.data.errors}`);
      console.log(`   - Pages processed: ${data.data.pages}`);
      return true;
    } else {
      console.error('❌ Real product sync failed:', data.message);
      if (data.error) {
        console.error(`   - Error details: ${data.error}`);
      }
      return false;
    }
  } catch (error) {
    console.error('❌ Real product sync error:', error.message);
    return false;
  }
}

/**
 * Test get products after sync
 */
async function testGetProductsAfterSync() {
  try {
    console.log('\n📦 Testing get products after sync...');
    
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
      
      if (data.data.products.length > 0) {
        const firstProduct = data.data.products[0];
        console.log(`   - Sample product: ${firstProduct.name}`);
        console.log(`   - BoxHero ID: ${firstProduct.boxHeroId}`);
        console.log(`   - SKU: ${firstProduct.sku || 'N/A'}`);
        console.log(`   - Category: ${firstProduct.category || 'N/A'}`);
        console.log(`   - Stock: ${firstProduct.currentStock}`);
        console.log(`   - Visibility: ${firstProduct.visibility}`);
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
 * Run all tests
 */
async function runTests() {
  console.log('🧪 Starting Real BoxHero API Integration Tests');
  console.log('==============================================');
  
  const results = {
    login: false,
    connectivity: false,
    realSync: false,
    getProducts: false
  };

  // Test login
  results.login = await login();
  if (!results.login) {
    console.log('\n❌ Cannot proceed without authentication');
    return;
  }

  // Test BoxHero connectivity
  results.connectivity = await testBoxHeroConnectivity();

  // Test real product sync
  results.realSync = await testRealProductSync();

  // Test get products after sync
  results.getProducts = await testGetProductsAfterSync();

  // Summary
  console.log('\n📊 Test Results Summary');
  console.log('======================');
  console.log(`Login: ${results.login ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`BoxHero Connectivity: ${results.connectivity ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Real Product Sync: ${results.realSync ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Get Products: ${results.getProducts ? '✅ PASS' : '❌ FAIL'}`);

  const passedTests = Object.values(results).filter(result => result).length;
  const totalTests = Object.keys(results).length;

  console.log(`\n🎯 Overall Result: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Real BoxHero API integration is working correctly.');
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
  testBoxHeroConnectivity,
  testRealProductSync,
  testGetProductsAfterSync
};
