const https = require('https');

// Test the branch-test route (no auth required)
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

async function testNoAuthRoutes() {
  try {
    console.log('Testing routes without authentication...');
    
    // Test branch-test (should work without auth)
    const branchTestResult = await testEndpoint('https://demo.mysteryrooms.work/api/orders/branch-test');
    console.log(`branch-test Status: ${branchTestResult.statusCode}`);
    if (branchTestResult.statusCode === 200) {
      console.log('✅ branch-test works');
    } else {
      console.log('❌ branch-test failed:', branchTestResult.data);
    }
    
    // Test branch-orders (currently failing even without auth)
    const branchOrdersResult = await testEndpoint('https://demo.mysteryrooms.work/api/orders/branch-orders');
    console.log(`branch-orders Status: ${branchOrdersResult.statusCode}`);
    if (branchOrdersResult.statusCode === 200) {
      console.log('✅ branch-orders works');
    } else {
      console.log('❌ branch-orders failed:', branchOrdersResult.data);
    }
    
    // Test test endpoint (should work without auth)
    const testResult = await testEndpoint('https://demo.mysteryrooms.work/api/orders/test');
    console.log(`test Status: ${testResult.statusCode}`);
    if (testResult.statusCode === 200) {
      console.log('✅ test works');
    } else {
      console.log('❌ test failed:', testResult.data);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testNoAuthRoutes();
