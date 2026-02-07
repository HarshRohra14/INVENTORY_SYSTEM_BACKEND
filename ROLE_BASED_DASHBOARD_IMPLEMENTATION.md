# Role-Based Dashboard Implementation

## Overview
Implemented role-based dashboard views where different user roles see different content on their dashboard.

## User Roles

### 1. **MANAGER Role**
**Dashboard Content:** Branch Management Dashboard
- Displays all branches the manager is managing
- Shows branch cards with:
  - Branch name
  - Address and location details
  - Contact information (phone, email)
  - Active status badge
- Each branch card has a "Manage Orders" button that links to `/dashboard/manage-orders?branchId={branchId}`
- Branches are fetched from `/api/branches/manager` endpoint

### 2. **BRANCH_USER Role**
**Dashboard Content:** Item List Page
- Shows the full item list with all filters
- Users can browse, search, and add items to cart
- Access to product categories, target locations, stock status
- Can select quantities and add items to cart

### 3. **ADMIN Role**
**Dashboard Content:** Item List Page
- Same as BRANCH_USER
- Full access to item management

## Implementation Details

### Backend Changes

#### New API Endpoint: `/api/branches/manager`
**File:** `src/routes/branchRoutes.js`

```javascript
GET /api/branches/manager
Headers: { Authorization: Bearer <token> }

Response:
{
  "success": true,
  "data": [
    {
      "id": "branch_123",
      "name": "Main Branch",
      "address": "123 Main Street",
      "city": "Seoul",
      "state": "Seoul",
      "zipCode": "12345",
      "phone": "+82-2-1234-5678",
      "email": "main@company.com"
    }
  ]
}
```

**Service:** Uses `getManagerBranches()` from `src/services/managerBranchService.js`

### Frontend Changes

#### File Structure
```
frontend/src/app/dashboard/
  ├── page.tsx                 # Main dashboard router (checks user role)
  ├── DashboardPage.tsx        # Manager's branch view
  └── ItemListPage.tsx         # Item list for BRANCH_USER/ADMIN
```

#### Dashboard Routing Logic
```typescript
// In page.tsx
if (user?.role === 'MANAGER') {
  return <DashboardPageComponent />;  // Shows branches
}

if (user?.role === 'BRANCH_USER' || user?.role === 'ADMIN') {
  return <ItemListPage />;  // Shows item list
}
```

## Branch Card Component

Each branch card shows:
- Branch name
- Address with location icon
- City, State, ZipCode
- Phone number (if available)
- Email (if available)
- Active status badge
- "Manage Orders" button linking to manage-orders page

## Features

### Manager Dashboard
- **Grid Layout**: Responsive grid (1 column mobile, 2 tablet, 3 desktop)
- **Hover Effects**: Cards have hover shadow effects
- **Error Handling**: Shows error message if branches can't be loaded
- **Empty State**: Shows friendly message if no branches assigned
- **Loading State**: Shows spinner while fetching branches

### Item List Dashboard
- Full item browsing experience
- Search and filters
- Cart integration
- Pagination
- Category and location filtering

## Database Schema

Managers are linked to branches via the `manager_branches` table:
```prisma
model ManagerBranch {
  id        String   @id @default(cuid())
  managerId String
  branchId  String
  isActive  Boolean  @default(true)
  manager   User     @relation("ManagerAssignments", fields: [managerId], references: [id])
  branch    Branch   @relation("BranchAssignments", fields: [branchId], references: [id])
  @@unique([managerId, branchId])
}
```

## Testing

### Test Manager Dashboard:
1. Login as manager (`manager@company.com` / `manager123`)
2. Dashboard should show assigned branches
3. Click "Manage Orders" to view orders for that branch

### Test Branch User Dashboard:
1. Login as branch user (`user@company.com` / `user123`)
2. Dashboard should show item list
3. Can browse, filter, and add items to cart

### Test Admin Dashboard:
1. Login as admin (`admin@company.com` / `admin123`)
2. Dashboard should show item list
3. Full access to all features

## Files Modified

### Backend:
- `src/routes/branchRoutes.js` - New file for branch routes
- `src/server.js` - Added branch routes
- `src/services/managerBranchService.js` - Already existed, used for fetching

### Frontend:
- `frontend/src/app/dashboard/page.tsx` - Role-based router
- `frontend/src/app/dashboard/DashboardPage.tsx` - Manager dashboard
- `frontend/src/app/dashboard/ItemListPage.tsx` - Item list component (renamed from page.tsx)

## Next Steps

1. **Manager can assign themselves to branches** (if needed)
2. **Add branch statistics** (order counts, pending items, etc.)
3. **Add notifications** for pending orders per branch
4. **Add search/filter** for branches on manager dashboard

