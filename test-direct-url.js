const https = require('https');

// Test the specific deployment URL
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

async function testDirectDeployment() {
  try {
    console.log('Testing direct deployment URL...');
    
    // Test the specific deployment URL from Vercel
    const directUrl = 'https://demo-mysteryrooms-work-7df9geggw-harshs-projects-805d4737.vercel.app/api/orders/branch-orders';
    const result = await testEndpoint(directUrl);
    console.log(`Direct URL Status: ${result.statusCode}`);
    console.log('Direct URL Response:', result.data);
    
    // Also test the aliased URL
    const aliasedUrl = 'https://demo.mysteryrooms-work.vercel.app/api/orders/branch-orders';
    const aliasedResult = await testEndpoint(aliasedUrl);
    console.log(`Aliased URL Status: ${aliasedResult.statusCode}`);
    console.log('Aliased URL Response:', aliasedResult.data);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testDirectDeployment();
