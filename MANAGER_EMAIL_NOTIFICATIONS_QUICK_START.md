# Manager Email Notifications - Quick Reference

## ⚡ Quick Start

Two new email functions have been added to `notificationService.js`:

### Function 1: Order Updated Email
```javascript
sendOrderUpdatedToRequesterNotification(order, manager, quantityChanges)
```
**When:** After manager approves order  
**To:** Manager's email  
**Content:** Confirms update sent to requester, shows quantity changes

### Function 2: Issue Alert Email
```javascript
sendBranchIssuePendingManagerActionNotification(order, manager, issue)
```
**When:** After branch raises issue  
**To:** Manager's email  
**Content:** Alerts manager to review and resolve issue

---

## 📋 Copy-Paste Integration Code

### Step 1: Add Import
Add to top of `src/services/orderService.js`:

```javascript
const {
  sendOrderUpdatedToRequesterNotification,
  sendBranchIssuePendingManagerActionNotification
} = require('./notificationService');
```

### Step 2: Add After Order Approval
In `approveOrder()` function, after order is moved to CONFIRM_PENDING:

```javascript
// Send manager notification
try {
  const manager = await prisma.user.findUnique({
    where: { id: approverId },
    select: { id: true, firstName: true, lastName: true, email: true }
  });
  
  if (manager && manager.email) {
    await sendOrderUpdatedToRequesterNotification(completeOrder, manager, quantityChanges);
  }
} catch (err) {
  console.error('⚠️ Failed to send manager update notification:', err);
}
```

### Step 3: Add After Issue Raised
In issue-raising function, after issue is created:

```javascript
// Send manager notification about issue
try {
  if (order.managerId) {
    const manager = await prisma.user.findUnique({
      where: { id: order.managerId },
      select: { id: true, firstName: true, lastName: true, email: true }
    });
    
    if (manager && manager.email) {
      await sendBranchIssuePendingManagerActionNotification(
        order,
        manager,
        { remarks: issueRemarks, createdAt: new Date() }
      );
    }
  }
} catch (err) {
  console.error('⚠️ Failed to send issue notification:', err);
}
```

---

## 📧 Email Subjects

### Email 1 (Order Updated)
```
Order Successfully Updated – Pending Requester Confirmation [Order #{{OrderID}}]
```

### Email 2 (Issue Raised)
```
Issue Raised by Branch – Action Required [Order #{{OrderID}}]
```

---

## 🎨 Email Features

**Email 1:**
- ✅ Green success badge
- ✅ Order details table
- ✅ Manager remarks
- ✅ Quantity changes table (if applicable)
- ✅ Status: Pending Requester Confirmation
- ✅ Next steps explanation

**Email 2:**
- ⚠️ Red alert badge
- ✅ Order details table
- ✅ Order items table
- ✅ Issue details highlighted
- ✅ Who raised it & when
- ✅ Action items (5 steps)
- ✅ Priority: HIGH

---

## 🧪 Quick Test

```javascript
// Test Email 1
const order = {
  id: 'test_ord',
  orderNumber: 'TEST-001',
  requestedAt: new Date(),
  branch: { name: 'Test Branch' },
  managerReply: 'Test update',
  totalItems: 1,
  orderItems: []
};

const manager = {
  firstName: 'John',
  lastName: 'Manager',
  email: 'john@example.com'
};

const result = await sendOrderUpdatedToRequesterNotification(order, manager);
console.log(result);  // Should show success: true
```

---

## 📁 Files

### Code
- **Location:** `src/services/notificationService.js`
- **Function 1:** Line 2504
- **Function 2:** Line 2664
- **Exports:** Line 2834-2835

### Documentation
- **Full Guide:** `MANAGER_EMAIL_NOTIFICATIONS_GUIDE.md`
- **Integration:** `MANAGER_EMAIL_NOTIFICATIONS_INTEGRATION.md`
- **Summary:** `MANAGER_EMAIL_NOTIFICATIONS_SUMMARY.md`

---

## ✅ Checklist

- [ ] Add import statement to orderService.js
- [ ] Add Email 1 call in approveOrder() function
- [ ] Add Email 2 call in issue-raising function
- [ ] Test Email 1 with sample order
- [ ] Test Email 2 with sample issue
- [ ] Check console for errors
- [ ] Verify email received in test inbox
- [ ] Deploy to production

---

## 💡 Tips

1. **Always use try-catch** - Don't let email failures break order flow
2. **Check manager.email exists** - Some managers might not have emails
3. **Log failures** - Log errors for debugging
4. **Test SMTP first** - Ensure SMTP is configured before deploying
5. **Use quantityChanges** - Only pass if available (from manager quantity increase feature)

---

## 📞 Need Help?

- **For detailed specs:** See `MANAGER_EMAIL_NOTIFICATIONS_GUIDE.md`
- **For step-by-step:** See `MANAGER_EMAIL_NOTIFICATIONS_INTEGRATION.md`
- **For overview:** See `MANAGER_EMAIL_NOTIFICATIONS_SUMMARY.md`

---

**Status:** Ready to Deploy ✅  
**Estimated Integration Time:** 30 minutes  
**Difficulty:** Easy
