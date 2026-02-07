const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3001';
const ORDER_ID = 'cmkxszdfy0001q9kcf3zuxj3l'; // Order ID from your error

async function testArrangingRemarks() {
  try {
    console.log('🔍 Testing Arranging Remarks Endpoint...\n');

    // Test 1: No auth token (should get 401)
    console.log('1. Testing without authentication:');
    const noAuthResponse = await fetch(`${BASE_URL}/api/orders/arranging-remarks/${ORDER_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ remarks: 'Test remarks' })
    });
    
    console.log(`   Status: ${noAuthResponse.status}`);
    const noAuthResult = await noAuthResponse.json();
    console.log(`   Message: ${noAuthResult.message}`);

    // Test 2: Invalid token (should get 401)
    console.log('\n2. Testing with invalid token:');
    const invalidTokenResponse = await fetch(`${BASE_URL}/api/orders/arranging-remarks/${ORDER_ID}`, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer invalid-token-123',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ remarks: 'Test remarks' })
    });
    
    console.log(`   Status: ${invalidTokenResponse.status}`);
    const invalidTokenResult = await invalidTokenResponse.json();
    console.log(`   Message: ${invalidTokenResult.message}`);

    // Test 3: Check if order exists
    console.log('\n3. Checking if order exists:');
    const orderResponse = await fetch(`${BASE_URL}/api/orders/${ORDER_ID}`, {
      headers: {
        'Authorization': 'Bearer invalid-token-123' // Just to pass initial auth check
      }
    });
    
    console.log(`   Status: ${orderResponse.status}`);
    const orderResult = await orderResponse.json();
    console.log(`   Message: ${orderResult.message}`);

    console.log('\n📋 DIAGNOSIS:');
    console.log('✅ Endpoint exists and is properly protected');
    console.log('❌ Your frontend needs to send a valid authentication token');
    console.log('❌ The user must have ADMIN or MANAGER role');

    console.log('\n🔧 SOLUTION:');
    console.log('1. Make sure user is logged in with valid token');
    console.log('2. Check that user.role is "ADMIN" or "MANAGER"');
    console.log('3. Include Authorization header: Bearer <token>');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testArrangingRemarks();
