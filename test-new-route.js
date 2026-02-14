const https = require('https');

// Test the new branch-orders-list route
const testEndpoint = (url) => {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
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

async function testNewRoute() {
  try {
    console.log('Testing new branch-orders-list route...');
    
    const result = await testEndpoint('https://demo.mysteryrooms.work/api/orders/branch-orders-list');
    console.log(`Status: ${result.statusCode}`);
    console.log('Response:', result.data);
    
    if (result.statusCode === 200) {
      console.log('✅ NEW ROUTE WORKS! The issue was with route name');
    } else {
      console.log('❌ New route also failed');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testNewRoute();
