# Manager Email Notifications - Integration Checklist

## ✅ Implementation Status

### Email Templates Created
- [x] **sendOrderUpdatedToRequesterNotification()** - Email when manager updates order
- [x] **sendBranchIssuePendingManagerActionNotification()** - Email when branch raises issue
- [x] Both functions exported from `notificationService.js`
- [x] Comprehensive implementation guide created

### Next Steps: Integration Points

---

## 🔌 Integration Points

### 1️⃣ **After Manager Approves with Quantity Changes**

**File:** `src/services/orderService.js` (in `approveOrder()` function)

**Current Code Location:** Around line 680-790 (approveOrder function)

**Add After:** Order status is updated to `CONFIRM_PENDING`

```javascript
// ✅ 3. Transaction — update order & items
const result = await prisma.$transaction(async (tx) => {
  // ... existing code ...
});

// ✅ 4. Create notification for requester
try {
  await notifyUsers([order.requesterId], order.id, 'ORDER_CONFIRM_PENDING', ...);
} catch (err) {
  console.error('Failed to notify requester for confirm pending:', err);
}

// ✅ NEW: Send manager notification about update
try {
  const manager = await prisma.user.findUnique({
    where: { id: approverId },
    select: { id: true, firstName: true, lastName: true, email: true }
  });
  
  if (manager && manager.email) {
    const { sendOrderUpdatedToRequesterNotification } = require('./notificationService');
    await sendOrderUpdatedToRequesterNotification(completeOrder, manager, quantityChanges);
  }
} catch (err) {
  console.error('Failed to send manager update notification:', err);
}
```

**When:** After an order is approved with any quantity changes (increases, decreases, or same)

---

### 2️⃣ **When Branch User Raises Issue**

**File:** `src/services/orderService.js` (in issue-raising function)

**Current Code Location:** Look for `raiseOrderIssue()` function

**Add After:** Issue is created and order status changes to `RAISED_ISSUE`

```javascript
// Example in raiseOrderIssue function or similar
const issueResult = await issueHandling();

// ✅ NEW: Send manager notification about issue
if (issueResult.success && order.managerId) {
  try {
    const manager = await prisma.user.findUnique({
      where: { id: order.managerId },
      select: { id: true, firstName: true, lastName: true, email: true }
    });
    
    if (manager && manager.email) {
      const { sendBranchIssuePendingManagerActionNotification } = require('./notificationService');
      const issue = {
        remarks: remarks,  // The issue remarks from branch user
        createdAt: new Date()
      };
      await sendBranchIssuePendingManagerActionNotification(order, manager, issue);
    }
  } catch (err) {
    console.error('Failed to send manager issue notification:', err);
  }
}
```

**When:** After branch user raises an issue on an approved/updated order

---

## 📋 Implementation Checklist

### Phase 1: Prepare (Now)
- [x] Email templates created
- [x] Functions exported
- [x] Documentation provided
- [ ] Code review scheduled

### Phase 2: Integrate (Next)
- [ ] Add import statement in orderService.js
- [ ] Find exact location in approveOrder() function
- [ ] Add manager notification call after order approval
- [ ] Test with sample order

### Phase 3: Testing
- [ ] Unit test: Manager update email sends
- [ ] Unit test: Branch issue email sends
- [ ] Integration test: Full workflow
- [ ] Email content validation
- [ ] SMTP configuration verification

### Phase 4: Deploy
- [ ] Code review approved
- [ ] QA testing completed
- [ ] Deployed to staging
- [ ] Production deployment

---

## 🔍 How to Find Integration Points

### To Find `approveOrder()` Function

```bash
# In your terminal, search for the function
grep -n "const approveOrder" src/services/orderService.js
```

**Expected location:** Around line 627-790

### To Find `raiseOrderIssue()` Function

```bash
# Search for issue-raising function
grep -n "raiseOrderIssue\|raise.*[Ii]ssue" src/services/orderService.js
```

---

## 📝 Code Snippets for Integration

### Import Statement (Add at top of orderService.js)

```javascript
const {
  // ... existing imports
  sendOrderUpdatedToRequesterNotification,
  sendBranchIssuePendingManagerActionNotification
} = require('./notificationService');
```

### Call After Order Approval

```javascript
// After order is successfully approved
const manager = await prisma.user.findUnique({
  where: { id: approverId },
  select: { id: true, firstName: true, lastName: true, email: true }
});

if (manager && manager.email) {
  try {
    await sendOrderUpdatedToRequesterNotification(
      completeOrder,
      manager,
      quantityChanges || null  // From approveOrder response
    );
  } catch (err) {
    console.error('⚠️ Failed to send manager update notification:', err);
    // Don't fail the order approval if email fails
  }
}
```

### Call When Issue is Raised

```javascript
// After issue is created/raised
if (order.managerId) {
  const manager = await prisma.user.findUnique({
    where: { id: order.managerId },
    select: { id: true, firstName: true, lastName: true, email: true }
  });

  if (manager && manager.email) {
    try {
      await sendBranchIssuePendingManagerActionNotification(
        order,
        manager,
        { remarks: issueRemarks, createdAt: new Date() }
      );
    } catch (err) {
      console.error('⚠️ Failed to send issue notification:', err);
      // Don't fail the issue creation if email fails
    }
  }
}
```

---

## 🧪 Quick Test

After integration, test with:

```javascript
// Test Email 1
const testOrder = {
  id: 'test_123',
  orderNumber: 'TEST-001',
  requestedAt: new Date(),
  branch: { name: 'Test Branch' },
  managerReply: 'Test update',
  totalItems: 1,
  orderItems: []
};

const testManager = {
  firstName: 'Test',
  lastName: 'Manager',
  email: 'test@example.com'
};

const quantityChanges = {
  'TEST_SKU': {
    requested: 10,
    approved: 20,
    change: 10,
    isIncreased: true
  }
};

await sendOrderUpdatedToRequesterNotification(testOrder, testManager, quantityChanges);
// Should send email without errors
```

---

## 📊 Expected Email Recipients

### Email 1: Order Successfully Updated
- **To:** `manager.email`
- **When:** After order approval
- **Count:** 1 per order approved

### Email 2: Issue Raised by Branch
- **To:** `manager.email`
- **When:** After branch raises issue
- **Count:** 1 per issue raised

---

## ⚠️ Error Handling

Both functions handle errors gracefully:

```javascript
// Returns on success
{
  success: true,
  managerEmail: { success: true, messageId: '...' },
  message: 'Order update confirmation notification sent to manager'
}

// Returns on failure
{
  success: false,
  message: 'error message',
  error: { /* error object */ }
}
```

**Important:** Email failures should NOT block order processing. Always use try-catch and log errors without throwing.

---

## 📞 Troubleshooting

### Email Not Sending?

1. **Check SMTP configuration**
   ```bash
   # Verify environment variables
   echo $SMTP_HOST
   echo $SMTP_PORT
   echo $SMTP_USER
   ```

2. **Verify manager has email**
   ```javascript
   // In database
   SELECT email FROM users WHERE id = 'manager_id' AND role = 'MANAGER';
   ```

3. **Check logs for errors**
   ```bash
   # Look for email error messages
   grep -i "email failed\|smtp" logs/*.log
   ```

### Email Content Issues?

1. **Check manager name**
   - Ensure `manager.firstName` is set
   - Falls back to empty string if not

2. **Check order details**
   - Verify `order.branch.name` exists
   - Check `order.orderNumber` is populated

3. **Test template rendering**
   - HTML might have parsing errors
   - Check browser console for malformed HTML

---

## 📚 Reference Files

### Main Implementation
- **Location:** `src/services/notificationService.js`
- **Functions:** Lines 2504 & 2664

### Guide Documentation
- **Location:** `MANAGER_EMAIL_NOTIFICATIONS_GUIDE.md`
- **Contains:** Complete specifications & examples

### This Checklist
- **Location:** `MANAGER_EMAIL_NOTIFICATIONS_INTEGRATION.md`
- **Contains:** Integration steps & code samples

---

## ✅ Success Criteria

Integration is successful when:

1. ✅ Manager receives email after approving order with quantity changes
2. ✅ Email shows correct order ID and manager name
3. ✅ Quantity changes are displayed in table format
4. ✅ Manager receives email when branch raises issue
5. ✅ Issue details are clearly shown in email
6. ✅ No errors in console logs
7. ✅ Order processing not affected by email failures

---

## 🚀 Next Steps

1. **Review** - Review the email templates in `notificationService.js`
2. **Locate** - Find the integration points in your code
3. **Implement** - Add the function calls at integration points
4. **Test** - Send test emails to verify templates
5. **Deploy** - Deploy to production

---

**Status:** Ready for Integration ✅  
**Estimated Integration Time:** 30-45 minutes  
**Testing Time:** 15-30 minutes  
**Total:** ~1 hour to full deployment
