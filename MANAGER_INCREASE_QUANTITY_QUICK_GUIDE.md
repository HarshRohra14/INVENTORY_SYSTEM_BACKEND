# Manager Increase Quantity - Quick Reference

## What's New? ✨
Managers can now **increase order quantities** when approving orders, not just decrease or approve as-is.

## How to Use (For Managers)

### Step 1: Review Pending Order
Navigate to pending orders and select an order to review.

### Step 2: View Original Quantities
Each item shows:
- **SKU**: Product code
- **Requested Qty**: What branch user originally asked for
- **Current Approved Qty**: Your approval quantity (start with requested)

### Step 3: Modify Quantity (Optional)
You can:
- ✅ **Keep same**: Keep exactly what was requested
- ✅ **Decrease**: Partial approval for less quantity
- ✅ **INCREASE**: Approve MORE than requested (NEW!)

### Step 4: Update Price (Auto-Calculated)
Total price updates automatically based on:
```
New Total = Approved Qty × Unit Price
```

### Step 5: Submit Approval
Click "Approve Order" button. System will:
1. ✅ Validate all quantities
2. ✅ Update order status to CONFIRM_PENDING
3. ✅ Calculate new total prices
4. ✅ Notify branch user to confirm

## Example Scenarios

### Scenario 1: Increase to Bulk Order
**Manager thinking:** "They asked for 50 units, but buying 100 is more cost-effective"

**Before Approval:**
```
SKU: ITEM_001
Requested: 50 units
Unit Price: $50
```

**Manager Approves:**
```
Approved Qty: 100 units ← Increased from 50!
New Total: 100 × $50 = $5,000
```

**System Response:**
```json
{
  "quantityChanges": {
    "ITEM_001": {
      "requested": 50,
      "approved": 100,
      "change": 50,
      "isIncreased": true
    }
  }
}
```

### Scenario 2: Mixed Approval
Multiple items with different changes:

```
Item A: Requested 30 → Approved 20 (Decrease) ❌
Item B: Requested 40 → Approved 40 (Same) ✓
Item C: Requested 50 → Approved 75 (Increase) ✅
```

## API Request Example

```javascript
// When approving an order, send:
{
  "approvedItems": [
    {
      "sku": "SKU_001",
      "qtyApproved": 100  // Increase from 50
    },
    {
      "sku": "SKU_002",
      "qtyApproved": 40   // Keep same as requested
    }
  ]
}
```

## API Response Example

```json
{
  "success": true,
  "message": "Order approved successfully",
  "data": {
    "id": "ord_123",
    "orderNumber": "ORD-2025-001",
    "status": "CONFIRM_PENDING",
    "orderItems": [
      {
        "sku": "SKU_001",
        "qtyRequested": 50,
        "qtyApproved": 100,
        "unitPrice": 50,
        "totalPrice": 5000
      }
    ]
  },
  "quantityChanges": {
    "SKU_001": {
      "requested": 50,
      "approved": 100,
      "change": 50,
      "isIncreased": true,
      "isDecreased": false
    }
  }
}
```

## Rules & Limitations

✅ **What's Allowed:**
- Increase any item to any quantity
- Decrease any item to 0 (reject item)
- Keep requested quantity as-is
- Mix of increases and decreases in one order

❌ **What's NOT Allowed:**
- Negative quantities (system prevents)
- Empty orders (must approve at least 1 item)
- Orders not in UNDER_REVIEW status

## Branch User Experience

After you increase quantities:
1. Branch user receives notification
2. They see the updated quantities
3. They can confirm the changes
4. Or raise issues if quantities seem wrong
5. Order proceeds to fulfillment

## Change Tracking

Every quantity change is tracked with:
- **Requested Qty**: Original request
- **Approved Qty**: Your approval
- **Change Amount**: Difference (positive = increase, negative = decrease)
- **isIncreased Flag**: Easy to spot increases
- **isDecreased Flag**: Easy to spot decreases

## Display Suggestions for Frontend

### Show Change Summary:
```
✅ Order Approved

Item: PRODUCT_A
  Requested: 50 units
  Approved: 100 units
  Change: +50 units (↑ 100% increase)
  Total: $5,000

Item: PRODUCT_B
  Requested: 30 units
  Approved: 30 units
  Change: No change
  Total: $2,100

Item: PRODUCT_C
  Requested: 100 units
  Approved: 75 units
  Change: -25 units (↓ 25% decrease)
  Total: $3,750

Order Total: $10,850
Status: Awaiting Branch Confirmation
```

### Show Warnings for Large Increases:
```
⚠️ Large Quantity Increase
Item PRODUCT_A increased by +50 units (100% increase)
Branch user will be notified for confirmation
```

## Frequently Asked Questions

**Q: Can I increase quantities after approval?**
A: No, only during the approval process. If you need to change later, create a modification request.

**Q: Will branch user be notified of increases?**
A: Yes, they receive a notification with updated quantities.

**Q: What if I increase too much by mistake?**
A: Branch user can reject in confirmation stage or raise an issue.

**Q: Is there a maximum increase limit?**
A: No, you can increase to any quantity (subject to available inventory if implemented).

**Q: Do prices update automatically?**
A: Yes, total price = approved qty × unit price (auto-calculated).

---

**Last Updated:** December 30, 2025
**Feature Status:** ✅ Production Ready
