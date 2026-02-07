/**
 * Test script for the new BoxHero direct fetch endpoint
 * 
 * This script tests the new GET /api/products/fetch-boxhero endpoint
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
 * Test the new direct BoxHero fetch endpoint
 */
async function testDirectBoxHeroFetch() {
  try {
    console.log('\n🌐 Testing direct BoxHero fetch endpoint...');
    
    const response = await axios.get(`${API_BASE_URL}/api/products/fetch-boxhero`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.data.success) {
      console.log('✅ Direct BoxHero fetch successful');
      console.log(`   - Items fetched: ${response.data.data.totalCount}`);
      console.log(`   - API attempts: ${response.data.data.attempts}`);
      console.log(`   - Timestamp: ${response.data.data.timestamp}`);
      
      if (response.data.data.items.length > 0) {
        const firstItem = response.data.data.items[0];
        console.log(`   - Sample item: ${firstItem.name || 'Unknown'}`);
        console.log(`   - Item ID: ${firstItem.id}`);
        console.log(`   - Has attrs: ${Array.isArray(firstItem.attrs) ? 'Yes' : 'No'}`);
      }
      
      return true;
    } else {
      console.error('❌ Direct BoxHero fetch failed:', response.data.message);
      return false;
    }
  } catch (error) {
    console.error('❌ Direct BoxHero fetch error:', error.message);
    if (error.response) {
      console.error(`   - Status: ${error.response.status}`);
      console.error(`   - Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🧪 Testing BoxHero Direct Fetch Endpoint');
  console.log('========================================');
  
  const results = {
    login: false,
    directFetch: false
  };

  // Test login
  results.login = await login();
  if (!results.login) {
    console.log('\n❌ Cannot proceed without authentication');
    return;
  }

  // Test direct BoxHero fetch
  results.directFetch = await testDirectBoxHeroFetch();

  // Summary
  console.log('\n📊 Test Results Summary');
  console.log('======================');
  console.log(`Login: ${results.login ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Direct BoxHero Fetch: ${results.directFetch ? '✅ PASS' : '❌ FAIL'}`);

  const passedTests = Object.values(results).filter(result => result).length;
  const totalTests = Object.keys(results).length;

  console.log(`\n🎯 Overall Result: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Direct BoxHero fetch endpoint is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Please check:');
    console.log('   - BOXHERO_API_TOKEN is set correctly');
    console.log('   - BoxHero API endpoint is accessible');
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
  testDirectBoxHeroFetch
};



