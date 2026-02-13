const jwt = require('jsonwebtoken');

// Create a test token
const testUser = {
  userId: 'cmk57lrumcvv1kqosqpztcryj',
  email: 'harshits.mysteryrooms@gmail.com',
  role: 'BRANCH_USER'
};

const token = jwt.sign(testUser, 'your-super-secret-jwt-key-here-change-in-production', { expiresIn: '1h' });
console.log('Test Token:', token);

// Test the stock stats endpoint
const testStockStats = async () => {
  const url = 'http://localhost:3001/api/products/stock-stats';
  
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

if (typeof fetch !== 'undefined') {
  testStockStats();
} else {
  console.log('To test the stock stats endpoint, use this curl command:');
  console.log(`curl -X GET "http://localhost:3001/api/products/stock-stats" \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json"`);
}
