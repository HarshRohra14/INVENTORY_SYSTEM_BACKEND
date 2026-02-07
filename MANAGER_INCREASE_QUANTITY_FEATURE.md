# Manager Quantity Increase Feature - Implementation Guide

## Overview
Managers can now **increase order quantities during the approval process**. This allows managers to approve orders with higher quantities than originally requested, without needing separate order modifications.

## ✅ Feature Capabilities

### What Managers Can Do:
- ✅ **Keep same quantity** - Approve exactly as requested
- ✅ **Decrease quantity** - Approve partial orders
- ✅ **INCREASE quantity** - Approve MORE than requested (NEW)

### When:
- During order approval in `UNDER_REVIEW` status
- Before order moves to `CONFIRM_PENDING` status

## 📊 How It Works

### Flow Diagram:
```
Branch User Creates Order (with items & quantities)
              ↓
    Manager Reviews Order
              ↓
    ┌─────────────────────────────────────┐
    │ Manager Can:                        │
    │ - Keep requested qty               │
    │ - Reduce to partial qty            │
    │ - INCREASE to higher qty ✨        │
    └─────────────────────────────────────┘
              ↓
   Set approved quantities for each item
              ↓
   Order moves to CONFIRM_PENDING
              ↓
  Branch user confirms manager's approval
```

## 🔌 API Endpoint

### Approve Order with Quantity Changes
```
PUT /api/orders/approve/:orderId
```

### Request Body:
```json
{
  "approvedItems": [
    {
      "sku": "SKU001",
      "qtyApproved": 50
    },
    {
      "sku": "SKU002", 
      "qtyApproved": 75
    }
  ]
}
```

### Example: Manager Increases Quantity

**Original Order:**
```json
{
  "approvedItems": [
    {
      "sku": "PRODUCT_A",
      "qtyApproved": 100  // Originally requested 50 → Manager increases to 100
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Order approved successfully",
  "data": {
    "id": "order_123",
    "orderNumber": "ORD-2025-001",
    "status": "CONFIRM_PENDING",
    "orderItems": [
      {
        "sku": "PRODUCT_A",
        "qtyRequested": 50,
        "qtyApproved": 100,
        "totalPrice": 5000
      }
    ]
  },
  "quantityChanges": {
    "PRODUCT_A": {
      "requested": 50,
      "approved": 100,
      "change": 50,
      "isIncreased": true,
      "isDecreased": false
    }
  }
}
```

## 🔑 Key Implementation Details

### 1. Backend Changes Made:

**File:** `src/services/orderService.js`

#### Updated `approveOrder()` function:
- ✅ Added detailed logging when quantities increase
- ✅ Tracks quantity changes (requested vs approved)
- ✅ Returns `quantityChanges` object with increase details
- ✅ Validates non-negative quantities
- ✅ Allows any quantity >= 0 (no upper limit)

#### Change Tracking:
```javascript
const quantityChanges = {
  "SKU001": {
    requested: 50,
    approved: 100,
    change: 50,
    isIncreased: true,
    isDecreased: false
  }
};
```

### 2. No Database Migration Needed
- Existing `OrderItem` model already supports this
- `qtyApproved` field can store any value > `qtyRequested`
- No new fields or tables required

### 3. Validation Rules:
- ✅ Order must be in `UNDER_REVIEW` status
- ✅ All items in request must exist in order
- ✅ Approved quantity must be >= 0 (non-negative)
- ✅ No upper limit on increase amount
- ✅ Manager ID is captured in approval

## 📱 Frontend Integration

### Manager Approval Form:
When reviewing pending orders, managers should:

1. **View original quantities**
   ```
   Item: PRODUCT_A
   Requested Qty: 50
   ```

2. **Modify quantity field** (increase or decrease)
   ```
   Approved Qty: 100  ← Can be > requested qty
   ```

3. **Submit approval**
   ```javascript
   const approvalPayload = {
     approvedItems: [
       { sku: "PRODUCT_A", qtyApproved: 100 }
     ]
   };
   
   const response = await fetch('/api/orders/approve/order_123', {
     method: 'PUT',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify(approvalPayload)
   });
   ```

4. **Show confirmation** with change summary
   ```
   ✅ Order Approved
   
   Item: PRODUCT_A
   Change: 50 → 100 (+50 units) 📈
   Total Price Updated: $2,500 → $5,000
   ```

## 💼 Business Logic

### Why Managers Increase Quantities:

1. **Better Supply Management**
   - Batch ordering to reduce costs
   - Consolidate multiple requests

2. **Stock Optimization**
   - Use minimum order quantities from suppliers
   - Avoid under-ordering

3. **Efficiency**
   - One approval for larger quantities
   - Reduced procurement cycles

### Notification Flow:
```
Manager increases qty during approval
              ↓
Order moves to CONFIRM_PENDING
              ↓
Branch user notified to confirm
              ↓
Branch user reviews increased quantities
              ↓
Branch user confirms or raises issue
```

## 🧪 Testing Examples

### Test Case 1: Manager Increases Single Item
```javascript
// Original order
{
  sku: "ITEM_001",
  qtyRequested: 25,
  qtyApproved: 50  // Manager increases by 25 units
}

// Expected change tracking
{
  requested: 25,
  approved: 50,
  change: 25,
  isIncreased: true
}
```

### Test Case 2: Manager Partially Approves One, Increases Another
```javascript
// Mixed approval
{
  approvedItems: [
    { sku: "SKU_A", qtyApproved: 30 },  // Decrease from 50
    { sku: "SKU_B", qtyApproved: 200 }  // Increase from 100
  ]
}

// Expected changes
{
  "SKU_A": { requested: 50, approved: 30, change: -20, isDecreased: true },
  "SKU_B": { requested: 100, approved: 200, change: 100, isIncreased: true }
}
```

### Test Case 3: Manager Approves Zero Quantity
```javascript
{
  sku: "OUT_OF_STOCK_ITEM",
  qtyApproved: 0  // Reject by approving 0 units
}

// Valid - non-negative quantity accepted
```

## 📝 Changes Summary

### Modified Files:
- **`src/services/orderService.js`**
  - Enhanced `approveOrder()` function
  - Added quantity change tracking
  - Added detailed logging
  - Enhanced response with `quantityChanges` field

### No Changes Required:
- Database schema (uses existing fields)
- API routes (existing `/approve` endpoint)
- Order controller validation

## ⚠️ Important Notes

1. **No Stock Validation Required**
   - System allows managers to increase quantities
   - Assume managers have inventory visibility
   - Stock checks can be added later if needed

2. **Price Recalculation**
   - Total price automatically recalculated
   - Based on: `qtyApproved * unitPrice`
   - Updated in OrderItem table

3. **Audit Trail**
   - Manager ID captured via `managerId` field
   - `approvedAt` timestamp recorded
   - Quantity changes logged to console

4. **Branch User Confirmation**
   - After approval, branch user still needs to confirm
   - They see the updated quantities
   - They can raise issues if quantities seem wrong

## 🚀 Next Steps / Enhancements

### Optional Enhancements:
1. **Stock Validation** - Check available inventory before allowing increase
2. **Max Quantity Limits** - Set limits on how much can be increased
3. **Approval Notes** - Manager can add notes about why quantity was increased
4. **Email Alerts** - Notify branch users of significant increases
5. **Audit Report** - Generate reports of all quantity modifications

## 📞 Support

For questions about manager quantity increases during approval:
1. Check the quantity changes in the approval response
2. Review console logs (starts with "MANAGER INCREASING ORDER:")
3. Check OrderItem.qtyApproved vs qtyRequested fields
4. Verify manager's notes/comments field (if added)
