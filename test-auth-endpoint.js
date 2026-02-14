const https = require('https');
const jwt = require('jsonwebtoken');

// Create a test token for branch user
const testUser = {
  userId: 'cml0x3v900ge8kqv9j2ykewys',
  email: 'mk8905050@gmail.com',
  role: 'BRANCH_USER'
};

const token = jwt.sign(testUser, 'your-super-secret-jwt-key-here-change-in-production', { expiresIn: '1h' });

// Test the branch-orders endpoint with authentication
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

async function testBranchOrders() {
  try {
    console.log('Testing branch-orders endpoint with authentication...');
    console.log('Token:', token.substring(0, 50) + '...');
    
    const result = await testEndpoint('https://demo.mysteryrooms.work/api/orders/branch-orders?page=1&limit=10', token);
    
    console.log(`Status Code: ${result.statusCode}`);
    
    if (result.statusCode === 200) {
      console.log('✅ Endpoint is working!');
      try {
        const response = JSON.parse(result.data);
        console.log(`Found ${response.data?.orders?.length || 0} orders`);
        console.log('Pagination:', response.data?.pagination);
      } catch (e) {
        console.log('Response:', result.data.substring(0, 500));
      }
    } else {
      console.log('❌ Endpoint returned error');
      console.log('Response:', result.data);
    }
  } catch (error) {
    console.error('Error testing endpoint:', error.message);
  }
}

testBranchOrders();
