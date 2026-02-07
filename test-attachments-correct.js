const jwt = require('jsonwebtoken');

// Create a test token for the actual branch user who created the order
const testUser = {
  id: 'cmk57lrumcvv1kqosqpztcryj', // Correct requester ID
  email: 'harshits.mysteryrooms@gmail.com',
  role: 'BRANCH_USER'
};

const token = jwt.sign(testUser, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '1h' });
console.log('Test Token for Branch User:', token);

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
