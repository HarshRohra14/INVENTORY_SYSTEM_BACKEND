# Manager Increase Quantity - Code Examples & Integration Guide

## Backend Code Examples

### 1. Using the Approval Endpoint

#### JavaScript/Fetch API
```javascript
// Manager approves order with increased quantities
const approvePendingOrder = async (orderId, approvedItems) => {
  try {
    const response = await fetch(`/api/orders/approve/${orderId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ approvedItems })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Order approved successfully');
      console.log('Quantity changes:', result.quantityChanges);
      
      // Log increases for tracking
      Object.entries(result.quantityChanges).forEach(([sku, change]) => {
        if (change.isIncreased) {
          console.log(`🔼 ${sku}: Increased by ${change.change} units`);
        }
      });
      
      return result;
    } else {
      console.error('❌ Approval failed:', result.message);
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('❌ Error approving order:', error);
    throw error;
  }
};

// Usage
const approvingItems = [
  { sku: 'PRODUCT_A', qtyApproved: 100 },  // Increase from 50
  { sku: 'PRODUCT_B', qtyApproved: 75 }    // Increase from 50
];

const result = await approvePendingOrder('order_123', approvingItems);
```

#### Axios Example
```javascript
import axios from 'axios';

const approveOrderWithIncreases = async (orderId, approvedItems) => {
  try {
    const { data } = await axios.put(
      `/api/orders/approve/${orderId}`,
      { approvedItems },
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );

    // Process quantity changes
    const increases = Object.entries(data.quantityChanges)
      .filter(([_, change]) => change.isIncreased)
      .reduce((acc, [sku, change]) => {
        acc[sku] = change.change;
        return acc;
      }, {});

    console.log('Items increased:', increases);
    return data;
  } catch (error) {
    console.error('Approval error:', error.response?.data || error.message);
    throw error;
  }
};
```

### 2. Service Layer (Backend)

#### Complete approveOrder Function
```javascript
const approveOrder = async (orderId, approverId, approvedItems) => {
  try {
    // Fetch order with items
    const order = await prisma.order.findFirst({
      where: { id: orderId, status: 'UNDER_REVIEW' },
      include: {
        orderItems: true,
        requester: { select: { id: true, firstName: true, lastName: true, email: true } },
        branch: { select: { id: true, name: true } }
      }
    });

    if (!order) throw new Error('Order not found or not in UNDER_REVIEW status');

    // Track quantity changes
    const quantityChanges = {};
    for (const approvedItem of approvedItems) {
      const orderItem = order.orderItems.find(oi => oi.sku === approvedItem.sku);
      if (!orderItem) throw new Error(`Item ${approvedItem.sku} not found`);
      
      if (approvedItem.qtyApproved < 0)
        throw new Error(`Negative quantity not allowed for ${approvedItem.sku}`);

      const change = approvedItem.qtyApproved - orderItem.qtyRequested;
      quantityChanges[approvedItem.sku] = {
        requested: orderItem.qtyRequested,
        approved: approvedItem.qtyApproved,
        change: change,
        isIncreased: change > 0,
        isDecreased: change < 0
      };

      if (change > 0) {
        console.log(`✅ MANAGER INCREASING: ${approvedItem.sku} from ${orderItem.qtyRequested} to ${approvedItem.qtyApproved} (+${change})`);
      }
    }

    // Update order and items in transaction
    const result = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'CONFIRM_PENDING',
          approvedAt: new Date(),
          managerId: approverId
        }
      });

      for (const approvedItem of approvedItems) {
        const orderItem = order.orderItems.find(oi => oi.sku === approvedItem.sku);
        await tx.orderItem.update({
          where: { id: orderItem.id },
          data: {
            qtyApproved: approvedItem.qtyApproved,
            totalPrice: approvedItem.qtyApproved * (Number(orderItem.unitPrice) || 0)
          }
        });
      }

      return updatedOrder;
    });

    // Fetch complete order
    const completeOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        requester: { select: { id: true, firstName: true, lastName: true, email: true } },
        branch: { select: { id: true, name: true } },
        orderItems: true
      }
    });

    // Send notifications
    try {
      await notifyUsers([order.requesterId], orderId, 'ORDER_CONFIRM_PENDING', 
        'Order Approval Pending', 
        `Your order ${order.orderNumber} has been approved. Please confirm.`);
    } catch (err) {
      console.error('Notification error:', err);
    }

    return {
      success: true,
      data: completeOrder,
      message: 'Order approved successfully',
      quantityChanges: quantityChanges
    };

  } catch (error) {
    console.error('Approve order error:', error);
    return {
      success: false,
      message: error.message,
      error: error.message
    };
  }
};

module.exports = { approveOrder };
```

### 3. Controller with Enhanced Response

```javascript
const approveOrderController = async (req, res) => {
  try {
    const { orderId } = req.params;
    const schema = Joi.object({
      approvedItems: Joi.array()
        .items(Joi.object({
          sku: Joi.string().required(),
          qtyApproved: Joi.number().integer().min(0).required()
        }))
        .min(1)
        .required()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(d => d.message)
      });
    }

    const { approvedItems } = value;
    const result = await approveOrder(orderId, req.user.id, approvedItems);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    // Return with quantity change details
    return res.json({
      success: true,
      message: result.message,
      data: result.data,
      quantityChanges: result.quantityChanges,
      summary: {
        totalIncreases: Object.values(result.quantityChanges).filter(c => c.isIncreased).length,
        totalDecreases: Object.values(result.quantityChanges).filter(c => c.isDecreased).length,
        totalUnchanged: Object.values(result.quantityChanges).filter(c => c.change === 0).length
      }
    });

  } catch (error) {
    console.error('Approve order error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
```

## Frontend Component Examples

### React Component: Manager Approval Form

```jsx
import React, { useState, useEffect } from 'react';

const OrderApprovalForm = ({ orderId, orderItems }) => {
  const [approvedItems, setApprovedItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    // Initialize with requested quantities
    setApprovedItems(orderItems.map(item => ({
      sku: item.sku,
      qtyRequested: item.qtyRequested,
      qtyApproved: item.qtyRequested
    })));
  }, [orderItems]);

  const handleQuantityChange = (sku, newQty) => {
    setApprovedItems(prev => prev.map(item =>
      item.sku === sku ? { ...item, qtyApproved: newQty } : item
    ));
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      const payload = {
        approvedItems: approvedItems.map(item => ({
          sku: item.sku,
          qtyApproved: item.qtyApproved
        }))
      };

      const response = await fetch(`/api/orders/approve/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      setResult(data);

      if (data.success) {
        showSuccessNotification(data.quantityChanges);
      }
    } catch (error) {
      console.error('Error:', error);
      setResult({ success: false, message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const showSuccessNotification = (quantityChanges) => {
    const increases = Object.entries(quantityChanges)
      .filter(([_, change]) => change.isIncreased)
      .map(([sku, change]) => `${sku}: +${change.change} units`)
      .join(', ');

    if (increases) {
      alert(`✅ Order approved!\nIncreases: ${increases}`);
    }
  };

  return (
    <div className="approval-form">
      <h2>Approve Order #{orderId}</h2>
      
      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>Requested Qty</th>
            <th>Approve Qty</th>
            <th>Change</th>
            <th>Unit Price</th>
            <th>Total Price</th>
          </tr>
        </thead>
        <tbody>
          {approvedItems.map(item => {
            const change = item.qtyApproved - item.qtyRequested;
            const isIncrease = change > 0;
            const unitPrice = orderItems.find(oi => oi.sku === item.sku)?.unitPrice || 0;
            const totalPrice = item.qtyApproved * unitPrice;

            return (
              <tr key={item.sku} className={isIncrease ? 'increase-row' : ''}>
                <td>{item.sku}</td>
                <td>{item.qtyRequested}</td>
                <td>
                  <input
                    type="number"
                    value={item.qtyApproved}
                    onChange={(e) => handleQuantityChange(item.sku, parseInt(e.target.value))}
                    min="0"
                  />
                </td>
                <td className={isIncrease ? 'increase' : change < 0 ? 'decrease' : 'unchanged'}>
                  {change > 0 ? `+${change}` : change}
                </td>
                <td>${unitPrice.toFixed(2)}</td>
                <td>${totalPrice.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <button onClick={handleApprove} disabled={loading}>
        {loading ? 'Approving...' : 'Approve Order'}
      </button>

      {result && (
        <div className={`result-message ${result.success ? 'success' : 'error'}`}>
          {result.success && (
            <div>
              <h3>✅ Order Approved Successfully</h3>
              <div className="summary">
                <p>Total Items Increased: {result.summary?.totalIncreases || 0}</p>
                <p>Total Items Decreased: {result.summary?.totalDecreases || 0}</p>
                <p>Unchanged Items: {result.summary?.totalUnchanged || 0}</p>
              </div>
              {result.quantityChanges && (
                <div className="changes-detail">
                  {Object.entries(result.quantityChanges).map(([sku, change]) => (
                    change.change !== 0 && (
                      <div key={sku} className={`change-row ${change.isIncreased ? 'increase' : 'decrease'}`}>
                        {sku}: {change.requested} → {change.approved} ({change.isIncreased ? '+' : ''}{change.change})
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          )}
          {!result.success && (
            <p>Error: {result.message}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default OrderApprovalForm;
```

### Styles for Increase Highlighting

```css
/* Highlight rows where quantity is increased */
.increase-row {
  background-color: #e8f5e9;
  font-weight: 500;
}

.increase {
  color: #4caf50;
  font-weight: bold;
}

.decrease {
  color: #f44336;
  font-weight: bold;
}

.unchanged {
  color: #9e9e9e;
}

.changes-detail {
  margin-top: 15px;
  padding: 10px;
  background-color: #f5f5f5;
  border-radius: 4px;
}

.change-row.increase {
  color: #4caf50;
  padding: 5px;
  margin: 5px 0;
  border-left: 3px solid #4caf50;
  padding-left: 10px;
}

.change-row.decrease {
  color: #f44336;
  padding: 5px;
  margin: 5px 0;
  border-left: 3px solid #f44336;
  padding-left: 10px;
}
```

## Testing Examples

### Unit Test (Jest)

```javascript
describe('Order Approval with Quantity Increases', () => {
  
  it('should allow manager to increase quantities', async () => {
    const orderId = 'order_123';
    const managerId = 'manager_456';
    
    const approvedItems = [
      { sku: 'ITEM_001', qtyApproved: 100 }
    ];

    const result = await approveOrder(orderId, managerId, approvedItems);

    expect(result.success).toBe(true);
    expect(result.quantityChanges['ITEM_001'].isIncreased).toBe(true);
    expect(result.quantityChanges['ITEM_001'].change).toBe(50); // 100 - 50
  });

  it('should track mixed quantity changes', async () => {
    const orderId = 'order_789';
    const managerId = 'manager_456';
    
    const approvedItems = [
      { sku: 'ITEM_A', qtyApproved: 100 },  // Increase
      { sku: 'ITEM_B', qtyApproved: 20 }    // Decrease
    ];

    const result = await approveOrder(orderId, managerId, approvedItems);

    expect(result.quantityChanges['ITEM_A'].isIncreased).toBe(true);
    expect(result.quantityChanges['ITEM_B'].isDecreased).toBe(true);
  });

  it('should update order status to CONFIRM_PENDING', async () => {
    const result = await approveOrder('order_123', 'manager_456', [
      { sku: 'ITEM_001', qtyApproved: 100 }
    ]);

    expect(result.data.status).toBe('CONFIRM_PENDING');
    expect(result.data.managerId).toBe('manager_456');
    expect(result.data.approvedAt).toBeDefined();
  });

  it('should recalculate total price based on approved quantity', async () => {
    const result = await approveOrder('order_123', 'manager_456', [
      { sku: 'ITEM_001', qtyApproved: 100 }
    ]);

    const item = result.data.orderItems[0];
    expect(item.totalPrice).toBe(100 * item.unitPrice);
  });
});
```

### Integration Test

```javascript
describe('Manager Approval Integration', () => {
  
  it('should handle complete approval workflow', async () => {
    // 1. Create order
    const orderResult = await createOrder({
      requesterId: 'user_123',
      branchId: 'branch_456',
      items: [{ sku: 'ITEM_001', quantity: 50 }]
    });

    const orderId = orderResult.data.id;

    // 2. Manager approves with increase
    const approvalResult = await approveOrder(orderId, 'manager_789', [
      { sku: 'ITEM_001', qtyApproved: 100 }
    ]);

    expect(approvalResult.success).toBe(true);
    expect(approvalResult.quantityChanges['ITEM_001'].isIncreased).toBe(true);

    // 3. Verify order status
    const updatedOrder = await getOrderById(orderId);
    expect(updatedOrder.status).toBe('CONFIRM_PENDING');
    expect(updatedOrder.orderItems[0].qtyApproved).toBe(100);

    // 4. Verify branch user receives notification
    const notifications = await getUserNotifications('user_123');
    expect(notifications.some(n => n.type === 'ORDER_CONFIRM_PENDING')).toBe(true);
  });
});
```

## Debugging Tips

```javascript
// 1. Enable detailed logging
console.log('Quantity changes:', result.quantityChanges);

// 2. Check specific increase
const increasedItems = Object.entries(result.quantityChanges)
  .filter(([_, change]) => change.isIncreased)
  .reduce((acc, [sku, change]) => {
    acc[sku] = change;
    return acc;
  }, {});

console.log('Increased items:', increasedItems);

// 3. Calculate total impact
const totalIncreaseAmount = Object.values(result.quantityChanges)
  .reduce((sum, change) => sum + Math.max(0, change.change), 0);

console.log(`Total quantity increase: ${totalIncreaseAmount} units`);

// 4. Verify price calculation
result.data.orderItems.forEach(item => {
  const expectedPrice = item.qtyApproved * item.unitPrice;
  console.assert(item.totalPrice === expectedPrice, 
    `Price mismatch for ${item.sku}`);
});
```

---

**Last Updated:** December 30, 2025
