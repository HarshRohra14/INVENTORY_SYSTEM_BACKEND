const https = require('https');

// Test the health endpoint to verify deployment
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

async function testHealth() {
  try {
    console.log('Testing health endpoint...');
    
    const result = await testEndpoint('https://demo.mysteryrooms.work/health');
    console.log(`Status: ${result.statusCode}`);
    console.log('Response:', result.data);
    
    if (result.statusCode === 200) {
      console.log('✅ Health endpoint works - deployment is active');
    } else {
      console.log('❌ Health endpoint failed');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testHealth();
