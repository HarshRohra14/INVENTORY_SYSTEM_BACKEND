const jwt = require('jsonwebtoken');

// Create a test token for branch user
const testUser = {
  userId: 'cml0x3v900ge8kqv9j2ykewys', // Branch user ID
  email: 'mk8905050@gmail.com',
  role: 'BRANCH_USER'
};

const token = jwt.sign(testUser, 'your-super-secret-jwt-key-here-change-in-production', { expiresIn: '1h' });
console.log('Test Token:', token);

// Test the branch orders endpoint
const testBranchOrders = async () => {
  const url = 'http://localhost:3001/api/orders/branch-orders';
  
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
    
    // Check if we got orders
    if (result.success && result.data && result.data.orders) {
      console.log(`\n✅ Found ${result.data.orders.length} orders for branch`);
      console.log('Pagination:', result.data.pagination);
    }
  } catch (error) {
    console.error('Error:', error);
  }
};

if (typeof fetch !== 'undefined') {
  testBranchOrders();
} else {
  console.log('To test branch orders endpoint, use this curl command:');
  console.log(`curl -X GET "http://localhost:3001/api/orders/branch-orders" \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json"`);
}
