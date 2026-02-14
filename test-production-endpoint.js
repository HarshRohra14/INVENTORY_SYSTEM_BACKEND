const https = require('https');

// Test the branch-orders endpoint
const testEndpoint = (url) => {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
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
  });
};

async function testBranchOrders() {
  try {
    console.log('Testing branch-orders endpoint...');
    const result = await testEndpoint('https://demo.mysteryrooms.work/api/orders/branch-orders?page=1&limit=10');
    
    console.log(`Status Code: ${result.statusCode}`);
    console.log('Headers:', result.headers);
    
    if (result.statusCode === 200) {
      console.log('✅ Endpoint is working!');
      console.log('Response:', result.data.substring(0, 200) + '...');
    } else {
      console.log('❌ Endpoint returned error');
      console.log('Response:', result.data);
    }
  } catch (error) {
    console.error('Error testing endpoint:', error.message);
  }
}

testBranchOrders();
