const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3001';
const ORDER_ID = 'cmk583t35cxxrkqose9q6euof'; // Real order with attachments

async function testInvalidToken() {
  try {
    console.log('🔍 Testing with Invalid Token...\n');

    // Test with invalid token
    console.log('1. Testing Branch API with invalid token:');
    const branchResponse = await fetch(`${BASE_URL}/api/orders/${ORDER_ID}/attachments`, {
      headers: {
        'Authorization': 'Bearer invalid-token-123'
      }
    });
    
    console.log(`   Status: ${branchResponse.status}`);
    const branchResult = await branchResponse.json();
    console.log(`   Message: ${branchResult.message}`);
    console.log(`   Full Response:`, JSON.stringify(branchResult, null, 2));

    console.log('\n2. Testing Manager API with invalid token:');
    const managerResponse = await fetch(`${BASE_URL}/api/orders/${ORDER_ID}/attachments/manager`, {
      headers: {
        'Authorization': 'Bearer invalid-token-123'
      }
    });
    
    console.log(`   Status: ${managerResponse.status}`);
    const managerResult = await managerResponse.json();
    console.log(`   Message: ${managerResult.message}`);
    console.log(`   Full Response:`, JSON.stringify(managerResult, null, 2));

    console.log('\n3. Testing with valid token but wrong user:');
    // This would require a real login to test properly

    console.log('\n📋 DIAGNOSIS:');
    console.log('If you see 400 "Order not found or access denied" with invalid token:');
    console.log('→ The token validation is passing but user/order lookup is failing');
    console.log('→ Check if the user ID from token exists in database');
    console.log('→ Check if the order ID exists in database');
    console.log('→ Check if the user has permission to access that order');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testInvalidToken();
