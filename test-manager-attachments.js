const fetch = require('node-fetch');

// Test configuration
const BASE_URL = 'http://localhost:3001';
const ORDER_ID = 'cmk583t35cxxrkqose9q6euof'; // Use a real order ID from database

// Manager credentials (real manager from database)
const MANAGER_CREDENTIALS = {
  email: 'info@mysteryrooms.in',
  password: 'password123' // You'll need to provide the actual password
};

async function testManagerAttachments() {
  try {
    console.log('🔍 Testing Manager Attachments API...\n');

    // Step 1: Login as manager
    console.log('1. Logging in as manager...');
    const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(MANAGER_CREDENTIALS)
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status} ${await loginResponse.text()}`);
    }

    const loginData = await loginResponse.json();
    const token = loginData.data.token;
    console.log('✅ Manager login successful');

    // Step 2: Test regular attachments endpoint (should fail for non-requester)
    console.log('\n2. Testing regular attachments endpoint (should fail for manager)...');
    const regularResponse = await fetch(`${BASE_URL}/api/orders/${ORDER_ID}/attachments`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log(`Status: ${regularResponse.status}`);
    const regularResult = await regularResponse.json();
    console.log('Response:', regularResult);

    // Step 3: Test manager attachments endpoint (should work)
    console.log('\n3. Testing manager attachments endpoint...');
    const managerResponse = await fetch(`${BASE_URL}/api/orders/${ORDER_ID}/attachments/manager`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log(`Status: ${managerResponse.status}`);
    const managerResult = await managerResponse.json();
    console.log('Response:', managerResult);

    if (managerResult.success) {
      console.log('\n✅ Manager attachments API working correctly!');
      console.log(`Found ${managerResult.data.length} attachments`);
    } else {
      console.log('\n❌ Manager attachments API failed:', managerResult.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testManagerAttachments();
