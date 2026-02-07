# Updated Phase 3: Manager Experience - Multiple Branch Management

## Business Logic Changes

Based on your requirements, I've updated the Manager Experience to implement the following business logic:

### **Manager Role Structure**
- **Managers don't see "Item List" and "My Orders"** - they only see "Manage Orders"
- **1 branch = 1 manager** (one-to-one relationship at branch level)
- **1 manager can manage multiple branches** (one-to-many relationship)
- **Managers manage orders from all their assigned branches**

## Database Schema Updates

### **New ManagerBranch Model**
```prisma
model ManagerBranch {
  id        String   @id @default(cuid())
  managerId String   // MANAGER user ID
  branchId  String   // Branch ID
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  manager User   @relation("ManagerAssignments", fields: [managerId], references: [id], onDelete: Cascade)
  branch  Branch @relation("BranchAssignments", fields: [branchId], references: [id], onDelete: Cascade)

  // Ensure unique manager-branch combinations
  @@unique([managerId, branchId])
  @@map("manager_branches")
}
```

### **Updated User Model**
```prisma
model User {
  // ... existing fields ...
  
  // Relations
  branch              Branch?              @relation("UserBranch", fields: [branchId], references: [id])
  orders              Order[]              @relation("OrderRequester")
  notifications       Notification[]       @relation("UserNotifications")
  managedBranches     ManagerBranch[]      @relation("ManagerAssignments") // For MANAGER - branches they manage
  managedOrders       Order[]              @relation("ManagerOrders") // Orders managed by this manager
}
```

### **Updated Order Model**
```prisma
model Order {
  // ... existing fields ...
  
  // Foreign keys
  requesterId String
  branchId    String
  managerId   String? // MANAGER who approved/dispatched this order

  // Relations
  requester     User           @relation("OrderRequester", fields: [requesterId], references: [id])
  branch        Branch         @relation(fields: [branchId], references: [id])
  manager       User?          @relation("ManagerOrders", fields: [managerId], references: [id])
  orderItems    OrderItem[]
  tracking      Tracking?
  notifications Notification[] @relation("OrderNotifications")
}
```

## Frontend Updates

### **Role-Based Navigation**
```typescript
// Manager-specific navigation (no Item List or My Orders)
if (user?.role === 'MANAGER') {
  return [
    { name: 'Manage Orders', href: '/dashboard/manage-orders', icon: '⚡' },
  ];
}

// Admin navigation (can see everything)
if (user?.role === 'ADMIN') {
  return [
    { name: 'Item List', href: '/dashboard', icon: '📦' },
    { name: 'My Orders', href: '/dashboard/orders', icon: '📋' },
    { name: 'Manage Orders', href: '/dashboard/manage-orders', icon: '⚡' },
  ];
}

// Branch User navigation (default)
return [
  { name: 'Item List', href: '/dashboard', icon: '📦' },
  { name: 'My Orders', href: '/dashboard/orders', icon: '📋' },
];
```

### **Manager Dashboard Updates**
- **Header Description**: Shows different text for Admin vs Manager
- **Auto-redirect**: Managers are automatically redirected to manage-orders if they try to access other pages
- **Order Filtering**: Shows orders from all assigned branches

## Backend Service Updates

### **Updated Order Service**
```javascript
const getManagerPendingOrders = async (managerId, options = {}) => {
  // Get manager's assigned branches
  const manager = await prisma.user.findUnique({
    where: { id: managerId },
    select: { 
      role: true,
      managedBranches: {
        select: {
          branchId: true,
          branch: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    }
  });

  // Build where clause - managers can see orders from their assigned branches
  const where = { status: 'UNDER_REVIEW' };
  if (manager.role !== 'ADMIN') {
    const managedBranchIds = manager.managedBranches.map(mb => mb.branchId);
    where.branchId = { in: managedBranchIds };
  }
  
  // ... rest of the function
};
```

### **New Manager Branch Service**
Created `src/services/managerBranchService.js` with functions:
- `assignManagerToBranch(managerId, branchId)` - Assign manager to branch
- `removeManagerFromBranch(managerId, branchId)` - Remove manager from branch
- `getManagerBranches(managerId)` - Get all branches assigned to manager
- `getBranchManagers(branchId)` - Get all managers assigned to branch
- `getAllManagerBranchAssignments(options)` - Get all assignments with pagination

## Order Management Flow

### **Manager Assignment Process**
1. **Admin assigns managers to branches** using the ManagerBranch service
2. **Manager logs in** and sees only "Manage Orders" in navigation
3. **Manager views orders** from all their assigned branches
4. **Manager approves/dispatches** orders, which sets the `managerId` field

### **Order Status Updates**
- **Approval**: Sets `managerId` and `approvedAt` timestamp
- **Dispatch**: Ensures `managerId` is set and adds `dispatchedAt` timestamp

## Security & Access Control

### **Role-Based Access**
- **MANAGER**: Can only access orders from assigned branches
- **ADMIN**: Can access orders from all branches
- **BRANCH_USER**: Cannot access manager functions

### **Navigation Protection**
- Managers are automatically redirected to manage-orders
- Role-based navigation prevents access to unauthorized pages

## Database Migration Required

To implement these changes, you'll need to run a database migration:

```sql
-- Create manager_branches table
CREATE TABLE manager_branches (
  id VARCHAR(191) NOT NULL PRIMARY KEY,
  managerId VARCHAR(191) NOT NULL,
  branchId VARCHAR(191) NOT NULL,
  isActive BOOLEAN NOT NULL DEFAULT true,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL,
  
  FOREIGN KEY (managerId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (branchId) REFERENCES branches(id) ON DELETE CASCADE,
  UNIQUE KEY manager_branches_managerId_branchId_key (managerId, branchId)
);

-- Add managerId column to orders table
ALTER TABLE orders ADD COLUMN managerId VARCHAR(191) NULL;
ALTER TABLE orders ADD FOREIGN KEY (managerId) REFERENCES users(id) ON DELETE SET NULL;

-- Update foreign key constraints
ALTER TABLE users DROP FOREIGN KEY users_branchId_fkey;
ALTER TABLE users ADD CONSTRAINT users_branchId_fkey FOREIGN KEY (branchId) REFERENCES branches(id) ON DELETE SET NULL;
```

## Usage Examples

### **Assign Manager to Branch**
```javascript
const { assignManagerToBranch } = require('./services/managerBranchService');

// Assign manager to branch
const result = await assignManagerToBranch('manager_id', 'branch_id');
if (result.success) {
  console.log('Manager assigned successfully');
}
```

### **Get Manager's Branches**
```javascript
const { getManagerBranches } = require('./services/managerBranchService');

// Get all branches assigned to a manager
const result = await getManagerBranches('manager_id');
if (result.success) {
  console.log('Assigned branches:', result.data);
}
```

## Benefits of This Implementation

1. **Clear Separation**: Managers only see order management, not item browsing
2. **Scalable**: One manager can handle multiple branches efficiently
3. **Traceable**: Every order tracks which manager approved/dispatched it
4. **Flexible**: Easy to reassign managers to different branches
5. **Secure**: Role-based access prevents unauthorized access

## Next Steps

1. **Run Database Migration**: Apply the schema changes
2. **Assign Managers to Branches**: Use the new service to set up manager-branch relationships
3. **Test Manager Workflow**: Verify managers can see orders from all assigned branches
4. **Train Managers**: Show them the new streamlined interface

The system now properly implements the business logic where managers focus solely on order management across their assigned branches! 🎯

