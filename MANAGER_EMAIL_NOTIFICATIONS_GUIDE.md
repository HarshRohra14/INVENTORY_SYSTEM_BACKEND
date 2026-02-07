# Manager Update Order Email Notifications - Implementation Guide

## Overview

Two new email notification templates have been added to notify managers about order updates:

1. **Order Successfully Updated** - Sent when manager updates quantities and sends to requester
2. **Issue Raised by Branch** - Sent when branch user raises issue on updated order

---

## 📧 Email Template 1: Order Successfully Updated

### When to Send
**Trigger:** After manager updates/increases order quantities and the updated order is sent to branch user for confirmation

### Email Recipients
- **To:** Manager email (`manager.email`)

### Subject
```
Order Successfully Updated – Pending Requester Confirmation [Order #{{OrderID}}]
```

### Content Highlights
- ✅ Confirmation that order was successfully updated
- 📋 Order ID, request date, branch location
- 📝 Manager remarks/reason for update (if provided)
- 📊 Quantity changes (if available from manager quantity increase feature)
  - Shows original vs updated quantities
  - Displays increase/decrease with visual badges
- ⏳ Current status: Pending Requester Confirmation
- 📢 Explanation that requester will review and confirm or raise issues
- 🔔 Manager will be notified once requester responds

### Implementation Details

#### Function Name
```javascript
sendOrderUpdatedToRequesterNotification(order, manager, quantityChanges)
```

#### Parameters
```javascript
order: {
  id: string,
  orderNumber: string,
  requestedAt: Date,
  branch: { name: string },
  managerReply: string,      // Remarks/reason for update
  remarks: string,            // Alternative remarks field
  totalItems: number,
  orderItems: Array
}

manager: {
  firstName: string,
  lastName: string,
  email: string               // Required for sending email
}

quantityChanges: {            // Optional (from manager quantity increase feature)
  "SKU001": {
    requested: number,
    approved: number,
    change: number,
    isIncreased: boolean,
    isDecreased: boolean
  }
}
```

#### When to Call
After manager updates order and changes are sent to requester. This is typically called in:
- Order approval flow with quantity changes
- Order update endpoints
- Manager quantity increase workflows

#### Example Usage
```javascript
// When manager approves with quantity changes
const quantityChanges = {
  "SKU_A": {
    requested: 50,
    approved: 100,
    change: 50,
    isIncreased: true,
    isDecreased: false
  }
};

const result = await sendOrderUpdatedToRequesterNotification(
  order,
  manager,
  quantityChanges
);
```

---

## 📧 Email Template 2: Issue Raised by Branch

### When to Send
**Trigger:** When branch user raises an issue about the updated/approved order

### Email Recipients
- **To:** Manager email (`manager.email`)

### Subject
```
Issue Raised by Branch – Action Required [Order #{{OrderID}}]
```

### Content Highlights
- ⚠️ Alert that branch user raised an issue
- 📦 Order details (ID, request date, branch, status)
- 📋 Updated order items with quantities
- 💬 Issue/concern details from branch user
- 👤 Who raised it and when
- 📋 Action items for manager:
  1. Review the concern
  2. Analyze the updated order details
  3. Update/Resolve the order
  4. Notify the branch user
  5. Proceed with processing once resolved
- 📊 Current status and priority
- 💡 Recommendations for resolution

### Implementation Details

#### Function Name
```javascript
sendBranchIssuePendingManagerActionNotification(order, manager, issue)
```

#### Parameters
```javascript
order: {
  id: string,
  orderNumber: string,
  requestedAt: Date,
  branch: { name: string },
  requester: {
    firstName: string,
    lastName: string
  },
  totalItems: number,
  orderItems: Array,          // With item details
  managerReply: string        // Previous manager remarks
}

manager: {
  firstName: string,
  lastName: string,
  email: string               // Required for sending email
}

issue: {
  remarks: string,            // Issue description from branch user
  managerReply: string,       // Alternative field for issue details
  createdAt: Date             // When issue was raised (optional)
}
```

#### When to Call
When branch user raises an issue on the updated order. This should be called when:
- Branch user rejects updated order
- Branch user comments on approved order
- Order status changes to "RAISED_ISSUE"

#### Example Usage
```javascript
// When branch user raises issue
const issue = {
  remarks: "The quantity increase for SKU_A from 50 to 100 units exceeds our storage capacity. Please revert to 50 units or provide alternative storage arrangement.",
  createdAt: new Date()
};

const result = await sendBranchIssuePendingManagerActionNotification(
  order,
  manager,
  issue
);
```

---

## 🔄 Complete Workflow

### Scenario: Manager Increases Quantity → Branch Raises Issue

```
Step 1: Manager Approves Order with Quantity Increase
├─ Manager sets approval quantities
├─ SKU_A: 50 → 100 units (increased by manager)
└─ Order moves to CONFIRM_PENDING

Step 2: Send Email 1 - Order Successfully Updated
├─ Recipient: Manager
├─ Content: Confirms update sent to requester
├─ Shows: Quantity changes (50 → 100)
└─ Status: Pending Requester Confirmation

Step 3: Branch User Reviews Updated Order
├─ Sees: Quantities changed to 100 units
├─ Concern: Exceeds storage capacity
└─ Action: Raises Issue

Step 4: Send Email 2 - Issue Raised by Branch
├─ Recipient: Manager
├─ Content: Branch concern and issue details
├─ Shows: Original and updated quantities
├─ Action Items: Review, update, resolve, notify
└─ Priority: HIGH

Step 5: Manager Reviews Issue & Updates Order
├─ Manager reads issue details
├─ Reviews quantities again
├─ Updates order (reduce to 50 or negotiate)
└─ Sends response to branch user

Step 6: Process Continues
├─ Branch user confirms
└─ Order proceeds to fulfillment
```

---

## 📝 Integration Points

### Where to Add Email Triggers

#### 1. Order Approval Flow
**File:** `src/services/orderService.js` or `src/controllers/orderController.js`

**After:** Order is approved with quantity changes

```javascript
// After approveOrder() succeeds
const approvalResult = await approveOrder(orderId, managerId, approvedItems);

if (approvalResult.success) {
  // Send manager notification
  await sendOrderUpdatedToRequesterNotification(
    approvalResult.data,
    manager,
    approvalResult.quantityChanges  // from manager increase feature
  );
}
```

#### 2. Issue Raised Flow
**File:** `src/services/orderService.js` or `src/controllers/orderController.js`

**After:** Branch user raises issue on updated order

```javascript
// After issue is created/raised
const issueResult = await raiseOrderIssue(orderId, userId, remarks);

if (issueResult.success) {
  // Send manager notification
  const manager = await getManagerForOrder(order.managerId);
  await sendBranchIssuePendingManagerActionNotification(
    order,
    manager,
    issueResult.issue
  );
}
```

---

## 🎨 Email Features

### Visual Design
- ✅ Professional HTML styling
- ✅ Color-coded status badges (green for success, red for issues, yellow for pending)
- ✅ Clear information hierarchy
- ✅ Mobile-responsive layout
- ✅ Brand branding with company name

### Dynamic Content
- ✅ Manager name personalization
- ✅ Order details (ID, date, branch)
- ✅ Quantity change visualization with up/down arrows
- ✅ Issue details from branch user
- ✅ Timestamps and status information
- ✅ Action-oriented content with clear next steps

---

## 📋 Email Content Details

### Email 1 - Order Successfully Updated

**Success Badge:**
- Background: Green (#10b981)
- Message: "✅ Order Successfully Updated"
- Subtext: "Requester has been notified for confirmation"

**Key Sections:**
1. **Greeting:** Personalized with manager name
2. **Summary:** What was done and status
3. **Order Details Box:** ID, dates, branch, status
4. **Remarks Section:** Why order was updated (from manager)
5. **Quantity Changes Table:** (if available)
   - Original quantity
   - Updated quantity
   - Change indicator (↑ increased, ↓ decreased, ↔️ same)
6. **Next Steps:** What happens now
7. **Current Status:** Order metrics
8. **Footer:** Company info and order reference

### Email 2 - Issue Raised by Branch

**Alert Badge:**
- Background: Red (#ef4444)
- Message: "⚠️ Issue Raised by Branch"
- Subtext: "Manager action required - Order review needed"

**Key Sections:**
1. **Greeting:** Personalized with manager name
2. **Alert:** Issue raised needs attention
3. **Order Details Box:** ID, dates, branch, status
4. **Items Table:** Current order items and quantities
5. **Issue Details Box:** (red background)
   - Issue/concern description
   - Who raised it and when
6. **Action Items:** Numbered list of what manager should do
7. **Current Status:** Order status, priority level (HIGH)
8. **Recommendation:** Suggestions for resolution
9. **Footer:** Company info and order reference

---

## ✉️ Email Function Exports

Both functions are exported from `notificationService.js`:

```javascript
module.exports = {
  // ... existing exports
  sendOrderUpdatedToRequesterNotification,      // NEW
  sendBranchIssuePendingManagerActionNotification,  // NEW
  // ... rest of exports
};
```

---

## 🧪 Testing Recommendations

### Test Case 1: Manager Updates with Quantity Increase
```javascript
const order = {
  id: 'ord_123',
  orderNumber: 'ORD-2025-001',
  requestedAt: new Date('2025-12-30'),
  branch: { name: 'Downtown Branch' },
  managerReply: 'Increased to optimize bulk ordering',
  totalItems: 2
};

const manager = {
  firstName: 'John',
  lastName: 'Manager',
  email: 'john.manager@example.com'
};

const quantityChanges = {
  'SKU_A': {
    requested: 50,
    approved: 100,
    change: 50,
    isIncreased: true
  }
};

const result = await sendOrderUpdatedToRequesterNotification(order, manager, quantityChanges);
// Should send email to manager with quantity changes table
```

### Test Case 2: Branch Raises Issue
```javascript
const issue = {
  remarks: 'The increased quantity exceeds our storage capacity',
  createdAt: new Date()
};

const result = await sendBranchIssuePendingManagerActionNotification(order, manager, issue);
// Should send email to manager with issue details and action items
```

---

## 💡 Best Practices

1. **Always include manager email** - Verify `manager.email` exists before sending
2. **Use appropriate timing** - Send immediately after update/issue creation
3. **Include order references** - Always include order ID and number for tracking
4. **Personalize greetings** - Use manager's first name
5. **Clear call-to-action** - Specify what manager needs to do
6. **Error handling** - Log failures and consider retries
7. **Quantity changes context** - Only show if changes actually exist

---

## 📊 Email Customization

### Company Name
Update the `companyName` variable in functions:
```javascript
const companyName = 'Mystery Rooms'; // Change to your company name
```

### Email Styling
Modify inline CSS styles for:
- Brand colors (currently using greens, reds, blues)
- Font sizes and families
- Spacing and padding
- Border colors and widths

### Content Language
All content is in English. To support other languages, create translated versions of the HTML templates.

---

## 🚀 Deployment Notes

1. **No database changes** - These functions only send emails
2. **SMTP configured** - System must have SMTP settings (existing)
3. **Manager email required** - Ensure manager records have email addresses
4. **Test mode** - System falls back to mock emails if SMTP not configured
5. **Error handling** - Failed emails are logged but don't break order flow

---

## 📌 Summary

These two email templates enhance the order management workflow by:
- ✅ Keeping managers informed of updates
- ✅ Providing clear status updates
- ✅ Showing quantity changes visually
- ✅ Alerting managers to issues needing resolution
- ✅ Providing actionable next steps
- ✅ Maintaining professional communication

---

**Last Updated:** December 30, 2025
**Status:** Ready for Implementation ✅
