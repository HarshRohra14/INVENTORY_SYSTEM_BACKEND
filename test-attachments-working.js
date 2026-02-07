const jwt = require('jsonwebtoken');

// Create a test token for the branch user
const testUser = {
  userId: 'cmk57lrumcvv1kqosqpztcryj', // Must be userId not id
  email: 'harshits.mysteryrooms@gmail.com',
  role: 'BRANCH_USER'
};

const token = jwt.sign(testUser, 'your-super-secret-jwt-key-here-change-in-production', { expiresIn: '1h' });
console.log('Test Token:', token);

// Test the attachment endpoint
const testAttachmentEndpoint = async () => {
  const orderId = 'cmk583t35cxxrkqose9q6euof';
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
    
    // Test accessing one of the attachment URLs
    if (result.success && result.data && result.data.length > 0) {
      console.log('\nTesting file access:');
      const firstFileUrl = result.data[0].url;
      console.log('File URL:', firstFileUrl);
      
      try {
        const fileResponse = await fetch(firstFileUrl, { method: 'HEAD' });
        console.log('File access status:', fileResponse.status);
      } catch (error) {
        console.log('File access error:', error.message);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
};

// Test with node-fetch if available, otherwise provide curl command
if (typeof fetch !== 'undefined') {
  testAttachmentEndpoint();
} else {
  console.log('\nTo test the attachment endpoint, use this curl command:');
  console.log(`curl -X GET "http://localhost:3001/api/orders/cmk583t35cxxrkqose9q6euof/attachments" \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json"`);
}
