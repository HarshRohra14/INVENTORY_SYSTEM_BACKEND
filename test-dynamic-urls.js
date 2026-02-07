const jwt = require('jsonwebtoken');

// Create a test token for branch user
const testUser = {
  userId: 'cml0x3v900ge8kqv9j2ykewys',
  email: 'mk8905050@gmail.com',
  role: 'BRANCH_USER'
};

const token = jwt.sign(testUser, 'your-super-secret-jwt-key-here-change-in-production', { expiresIn: '1h' });
console.log('Test Token:', token);

// Test the dynamic URL functionality
const testDynamicUrls = async () => {
  const orderId = 'cml0x6dtj0geakqv9w808gk7r';
  const url = `http://localhost:3001/api/orders/${orderId}/attachments`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Response Status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));
    
    // Check if URLs are using dynamic base URL
    if (result.success && result.data && result.data.length > 0) {
      console.log('\nChecking URL format:');
      result.data.forEach((attachment, index) => {
        console.log(`${index + 1}. ${attachment.url}`);
        
        // Test if the URL is accessible
        fetch(attachment.url, { method: 'HEAD' })
          .then(fileResponse => {
            console.log(`   Access Status: ${fileResponse.status}`);
          })
          .catch(error => {
            console.log(`   Access Error: ${error.message}`);
          });
      });
    }
  } catch (error) {
    console.error('Error:', error);
  }
};

if (typeof fetch !== 'undefined') {
  testDynamicUrls();
} else {
  console.log('Fetch not available');
}
