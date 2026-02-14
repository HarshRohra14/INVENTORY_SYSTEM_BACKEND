const https = require('https');
const jwt = require('jsonwebtoken');

// Create a test token for branch user
const testUser = {
  userId: 'cml0x3v900ge8kqv9j2ykewys',
  email: 'mk8905050@gmail.com',
  role: 'BRANCH_USER'
};

const token = jwt.sign(testUser, 'your-super-secret-jwt-key-here-change-in-production', { expiresIn: '1h' });

// Test both endpoints for comparison
const testEndpoint = (url, token) => {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.end();
  });
};

async function testEndpoints() {
  try {
    console.log('=== Testing my-orders endpoint (should work) ===');
    const myOrdersResult = await testEndpoint('https://demo.mysteryrooms.work/api/orders/my-orders?page=1&limit=5', token);
    console.log(`Status Code: ${myOrdersResult.statusCode}`);
    if (myOrdersResult.statusCode === 200) {
      console.log('✅ my-orders works');
    } else {
      console.log('❌ my-orders failed:', myOrdersResult.data);
    }

    console.log('\n=== Testing branch-orders endpoint (currently failing) ===');
    const branchOrdersResult = await testEndpoint('https://demo.mysteryrooms.work/api/orders/branch-orders?page=1&limit=5', token);
    console.log(`Status Code: ${branchOrdersResult.statusCode}`);
    if (branchOrdersResult.statusCode === 200) {
      console.log('✅ branch-orders works');
    } else {
      console.log('❌ branch-orders failed:', branchOrdersResult.data);
    }

    console.log('\n=== Testing a non-existent endpoint (should be 404) ===');
    const nonExistentResult = await testEndpoint('https://demo.mysteryrooms.work/api/orders/non-existent', token);
    console.log(`Status Code: ${nonExistentResult.statusCode}`);
    console.log('Response:', nonExistentResult.data);

  } catch (error) {
    console.error('Error testing endpoints:', error.message);
  }
}

testEndpoints();
