# ✅ Issue Submission Email - Branch User Raises Issue

## Email Status: NEWLY IMPLEMENTED & ACTIVE ✅

A new email notification has been created and integrated to send to the **requester (branch user)** when they raise an issue on the manager's order updates.

---

## 📧 Email Details

### Template Name
`sendBranchIssueSubmittedNotification()`

### File Location
[src/services/notificationService.js](src/services/notificationService.js#L2950) (Lines 2950-3076)

### When It's Sent
✅ **Automatically** when branch user raises an issue about the manager's order updates

### Who Receives It
✅ **Requester/Branch User** (the person who created the order)

### Email Subject
```
Your Issue Submission Received – Manager Action in Progress (Order ID: {{OrderID}})
```

---

## 📨 Email Content

### Email Structure

```
Header: 📋 Your Issue Submission Received (Amber/Yellow banner)
        Manager Action in Progress

Greeting: Hi {{RequestedBy}},

Message: 
  "We have received your issue / concern regarding the updated stock / purchase 
   order request. The details have been shared with the Manager for review and 
   necessary action."

Order Details Box (Light Amber):
  - Order ID
  - Original Request Date
  - Branch / Location
  - Status: ISSUE RAISED badge

Updated Order Details Table:
  - Item(s): List of all items
  - Quantity: Approved quantity with unit

Issue Submitted Box (Light Amber):
  - "Your Concern:" section
  - Shows the exact issue remarks entered by user
  
Current Status Box (Light Gray):
  - Order Status: Issue Raised – Awaiting Manager Action
  - Action: Manager review in progress

Message: "You will receive another update once the Manager reviews and updates the request."

Footer: Company name & system reference
```

---

## 🔄 Workflow Integration

### Complete Flow

```
1. Branch User Creates Order
   ↓
2. Manager Reviews & Approves with Changes
   ↓
3. Email to Requester: "Order Successfully Updated"
   (sendOrderUpdatedToRequesterNotification)
   ↓
4. Branch User Reviews Changes
   ↓
5. Two Options:
   a. Confirm Changes:
      ├─ Email to Requester: "Your Confirmation Received" ✅
      ├─ Email to Manager: "Branch Confirmation Received" ✅
      └─ Order Status: APPROVED_ORDER
      
   b. Raise Issue: ← YOU ARE HERE
      ├─ Email to Requester: "Your Issue Submission Received" ✅ NEW
      ├─ Email to Manager: "Issue Raised by Branch – Action Required" ✅ (Already exists)
      ├─ System Notification: To admins and managers
      └─ Order Status: WAITING_FOR_MANAGER_REPLY
```

---

## 🔍 Implementation Details

### Files Modified

**1. src/services/notificationService.js**
- **Added:** New function `sendBranchIssueSubmittedNotification()` at line 2950
- **Updated:** module.exports to include new function

**2. src/services/orderService.js**
- **Updated:** Import statement to include new function
- **Updated:** `raiseOrderIssue()` function to call new notification at line 1322

### Code Integration Points

**Import in orderService.js:**
```javascript
const {
  ...
  sendBranchIssueSubmittedNotification,
  ...
} = require('./notificationService');
```

**Call in raiseOrderIssue() function:**
```javascript
// ✅ Send confirmation email to requester about issue submission
try {
  console.log(`📧 Sending issue submission email to requester for order ${order.orderNumber}`);
  const requesterIssueResult = await sendBranchIssueSubmittedNotification(order, combinedRemarks);
  console.log(`📧 Issue submission notification result:`, requesterIssueResult);
} catch (requesterIssueErr) {
  console.error('⚠️ Failed to send requester issue notification email:', requesterIssueErr);
}
```

---

## 📋 Email Template Content

### HTML Features
- ✅ Professional amber/yellow-themed design (indicates caution/issue)
- ✅ Responsive layout (600px max width)
- ✅ Color-coded status badges
- ✅ Order items table with quantities
- ✅ Issue details highlighted in warning box
- ✅ Current status showing manager action in progress
- ✅ Company branding footer
- ✅ Inline CSS for email client compatibility

### Dynamic Fields Populated
| Field | Source | Example |
|-------|--------|---------|
| Requester Name | order.requester.firstName | Jane |
| Order ID | order.orderNumber | ORD-2025-001 |
| Request Date | order.requestedAt | 12/30/2025 10:30 AM |
| Branch | order.branch.name | Downtown Branch |
| Items List | order.orderItems[] | Rice, Flour, Sugar |
| Quantities | orderItem.qtyApproved | 50 bags, 25 boxes, etc. |
| Issue Details | combinedRemarks | User's issue description |
| Company Name | hardcoded | Mystery Rooms |

---

## ✅ Verification Checklist

- [x] Email function created in notificationService.js
- [x] Function properly exported
- [x] Function imported in orderService.js
- [x] Function called in raiseOrderIssue() function
- [x] Error handling implemented
- [x] Console logging added for debugging
- [x] HTML template is complete
- [x] All dynamic fields are populated
- [x] Amber color scheme for issue indication

---

## 🧪 Testing Instructions

### Prerequisites
- Order must have manager approval with changes (status: CONFIRM_PENDING)
- Order must be assigned to branch user
- Manager must have made updates to order

### Test Steps
```
1. Log in as MANAGER
   - Create new order or find existing
   - Approve order with quantity changes
   - Order moves to CONFIRM_PENDING status

2. Check Requester's Email
   - Subject: "Order Successfully Updated"
   - Shows: Original → Updated quantities
   - Requester can confirm or raise issue

3. Log in as BRANCH_USER (same branch)
   - Find order in CONFIRM_PENDING status
   - Review the changes
   - Click "Raise Issue" button
   - Enter issue/concern details
   - Example: "Approved quantity is too low"

4. Check Requester's Email AGAIN
   - Should receive NEW email:
   - Subject: "Your Issue Submission Received – Manager Action in Progress"
   - Shows: Confirmed items and quantities
   - Shows: Issue/concern entered by user
   - Status: Issue Raised – Awaiting Manager Action
   - Message: Manager is reviewing

5. Manager Should Also Receive
   - Subject: "Issue Raised by Branch – Action Required [Order #ORD-2025-001]"
   - Shows: Detailed issue information
   - Shows: Action items for manager
```

### Expected Email Content
```
Subject: Your Issue Submission Received – Manager Action in Progress (Order ID: ORD-2025-001)

Body:
📋 Your Issue Submission Received
   Manager Action in Progress

Hi Jane,

We have received your issue / concern regarding the updated stock / purchase 
order request. The details have been shared with the Manager for review and 
necessary action.

[Order Details in Amber Box]
Order ID: ORD-2025-001
Original Request Date: 12/30/2025 10:30 AM
Branch / Location: Downtown Branch
Status: ISSUE RAISED

[Updated Order Details Table]
Item(s)    | Quantity | Unit
Rice       | 50       | bags
Flour      | 25       | boxes
Sugar      | 10       | kg

[Issue Submitted in Amber Box]
⚠️ Issue Submitted
Your Concern:
Approved quantity is too low. We need at least 75 bags of rice, not 50.

[Current Status in Gray Box]
Order Status: ⏳ Issue Raised – Awaiting Manager Action
Action: Manager review in progress

You will receive another update once the Manager reviews and updates the request.

Thank you,
Mystery Rooms
Inventory & Procurement System
```

### What to Verify
- [ ] Email received within 5-10 seconds of raising issue
- [ ] Sent to correct requester email
- [ ] Correct order ID in subject
- [ ] All items showing with correct quantities
- [ ] Issue description (concern) appears exactly as entered
- [ ] Amber "ISSUE RAISED" badge visible
- [ ] Status shows "Issue Raised – Awaiting Manager Action"
- [ ] Company footer present
- [ ] Professional formatting with no broken styling

---

## 📊 Console Logs to Watch

When branch user raises an issue, you should see:

```
📬 Sending issue raised notification for order ORD-2025-001
⚠️ Failed to send manager issue notification email: (if manager doesn't have email)
📧 Sending issue submission email to requester for order ORD-2025-001
📬 Sending issue submission notification to requester for order ORD-2025-001
✅ Issue submission email sent successfully to requester for order ORD-2025-001
📧 Issue submission notification result: { success: true, ... }
```

### If There's an Issue

```
⚠️ Email failed for requester on order ORD-2025-001
❌ sendBranchIssueSubmittedNotification failed: <error>
```

---

## 🚀 Deployment Status

**Status:** ✅ **FULLY IMPLEMENTED & READY**

The email notification is:
- ✅ Fully implemented with professional HTML template
- ✅ Properly integrated into raiseOrderIssue() function
- ✅ Error handled and logged for debugging
- ✅ Exported and accessible in orderService.js
- ✅ Called at the correct point in the workflow

**Deployment:** No additional code changes needed

---

## 📞 Troubleshooting

### Requester Not Receiving Email

**Check 1: Requester Has Email**
```sql
SELECT id, firstName, email FROM users 
WHERE id = '<requester_id>';
```

**Check 2: SMTP Configuration**
```bash
echo $SMTP_HOST
echo $SMTP_USER
```

**Check 3: Order Has Requester**
```sql
SELECT id, orderNumber, requesterId FROM orders 
WHERE id = '<order-id>';
```

**Check 4: Console Logs**
Look for console log lines when branch raises issue (see above).

**Check 5: Email Spam Folder**
- Check spam/promotions folder in email
- Check email filters

---

## 🎯 Summary

**What's New:**
This email is sent to the **branch user who created the order** when they raise an issue about the manager's changes. It:

1. ✅ Confirms their issue submission was received
2. ✅ Shows the updated order details under review
3. ✅ Displays their exact concern/issue
4. ✅ Indicates manager is reviewing it
5. ✅ Professional amber-themed design (warning indicator)
6. ✅ Sent automatically with no manual action required

**Workflow Status:**
- Requester confirms → Requester email sent ✅
- Requester raises issue → **Requester email sent** ✅ (NEW)
- Requester raises issue → Manager email sent (Already exists)
- Order moves to WAITING_FOR_MANAGER_REPLY status

**Complete Email Notification Coverage:**
1. ✅ Order Created → Email to Requester (Order Created)
2. ✅ Manager Updates → Email to Requester (Order Successfully Updated)
3. ✅ Requester Confirms → Email to Requester (Your Confirmation Received)
4. ✅ Requester Confirms → Email to Manager (Branch Confirmation Received)
5. ✅ Requester Raises Issue → **Email to Requester** ✅ (NEW)
6. ✅ Requester Raises Issue → Email to Manager (Issue Raised – Action Required)

**Ready to Deploy!** 🚀
