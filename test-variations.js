const https = require('https');
const jwt = require('jsonwebtoken');

// Create a test token for branch user
const testUser = {
  userId: 'cml0x3v900ge8kqv9j2ykewys',
  email: 'mk8905050@gmail.com',
  role: 'BRANCH_USER'
};

const token = jwt.sign(testUser, 'your-super-secret-jwt-key-here-change-in-production', { expiresIn: '1h' });

// Test different variations of the endpoint
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

async function testVariations() {
  try {
    const baseUrl = 'https://demo.mysteryrooms.work/api/orders';
    
    console.log('=== Testing different endpoint variations ===');
    
    const variations = [
      '/branch-orders',
      '/branch-orders/',
      '/branch-orders?page=1&limit=10',
      '/my-orders' // This should work
    ];
    
    for (const variation of variations) {
      const url = baseUrl + variation;
      console.log(`\nTesting: ${url}`);
      
      const result = await testEndpoint(url, token);
      console.log(`Status: ${result.statusCode}`);
      
      if (result.statusCode === 200) {
        console.log('✅ SUCCESS');
      } else {
        console.log('❌ FAILED:', result.data.substring(0, 100));
      }
    }

  } catch (error) {
    console.error('Error testing variations:', error.message);
  }
}

testVariations();
