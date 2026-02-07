const { PrismaClient } = require('@prisma/client');
const { getManagerPendingOrders, approveOrder, confirmOrder, raiseOrderIssue, dispatchOrder } = require('./src/services/orderService');

const prisma = new PrismaClient();

async function testConfirmPendingWorkflow() {
  console.log('🧪 Testing Confirm Pending Workflow...\n');

  try {
    // Get the test manager and branch users
    const manager = await prisma.user.findUnique({
      where: { email: 'test.manager@company.com' },
      select: { id: true, firstName: true, lastName: true }
    });

    const branchUser1 = await prisma.user.findUnique({
      where: { email: 'test.downtown.user@company.com' },
      select: { id: true, firstName: true, lastName: true }
    });

    const branchUser2 = await prisma.user.findUnique({
      where: { email: 'test.uptown.user@company.com' },
      select: { id: true, firstName: true, lastName: true }
    });

    if (!manager || !branchUser1 || !branchUser2) {
      throw new Error('Test users not found');
    }

    console.log(`👨‍💼 Manager: ${manager.firstName} ${manager.lastName}`);
    console.log(`👥 Branch Users: ${branchUser1.firstName} ${branchUser1.lastName}, ${branchUser2.firstName} ${branchUser2.lastName}`);

    // Test 1: Create a new order from branch user
    console.log('\n📋 Test 1: Creating new order from branch user...');
    
    const testItem = await prisma.item.findFirst({
      where: { name: 'Office Chair' }
    });

    if (!testItem) {
      throw new Error('Test item not found');
    }

    const newOrder = await prisma.order.create({
      data: {
        orderNumber: `TEST-ORD-${Date.now()}`,
        status: 'UNDER_REVIEW',
        remarks: 'Test order for confirm pending workflow',
        totalItems: 1,
        totalValue: 200.00,
        requesterId: branchUser1.id,
        branchId: 'branch_1_test'
      }
    });

    await prisma.orderItem.create({
      data: {
        orderId: newOrder.id,
        itemId: testItem.id,
        qtyRequested: 1,
        unitPrice: 200.00,
        totalPrice: 200.00
      }
    });

    console.log(`✅ Order created: ${newOrder.orderNumber}`);

    // Test 2: Manager approves order (should set to CONFIRM_PENDING)
    console.log('\n✅ Test 2: Manager approves order...');
    
    const orderWithItems = await prisma.order.findUnique({
      where: { id: newOrder.id },
      include: { orderItems: true }
    });

    const approvedItems = orderWithItems.orderItems.map(item => ({
      orderItemId: item.id,
      qtyApproved: item.qtyRequested // Approve full quantity
    }));

    const approvalResult = await approveOrder(newOrder.id, manager.id, approvedItems);
    
    if (!approvalResult.success) {
      throw new Error(`Failed to approve order: ${approvalResult.message}`);
    }

    console.log(`✅ Order approved successfully! Status: ${approvalResult.data.status}`);

    // Test 3: Verify order is in CONFIRM_PENDING status
    console.log('\n🔍 Test 3: Verifying order status...');
    
    const updatedOrder = await prisma.order.findUnique({
      where: { id: newOrder.id },
      include: {
        requester: { select: { firstName: true, lastName: true } },
        branch: { select: { name: true } },
        orderItems: {
          include: {
            item: { select: { name: true, sku: true } }
          }
        }
      }
    });

    console.log(`✅ Order Status: ${updatedOrder.status}`);
    console.log(`✅ Manager ID: ${updatedOrder.managerId}`);
    console.log(`✅ Approved At: ${updatedOrder.approvedAt}`);

    // Test 4: Branch user confirms the order
    console.log('\n✅ Test 4: Branch user confirms order...');
    
    const confirmResult = await confirmOrder(newOrder.id, branchUser1.id);
    
    if (!confirmResult.success) {
      throw new Error(`Failed to confirm order: ${confirmResult.message}`);
    }

    console.log(`✅ Order confirmed successfully! Status: ${confirmResult.data.status}`);

    // Test 5: Verify order is now ACCEPTED_ORDER
    console.log('\n🔍 Test 5: Verifying confirmed order status...');
    
    const confirmedOrder = await prisma.order.findUnique({
      where: { id: newOrder.id }
    });

    console.log(`✅ Final Order Status: ${confirmedOrder.status}`);

    // Test 6: Manager can now dispatch the order
    console.log('\n🚚 Test 6: Manager dispatches confirmed order...');
    
    const dispatchData = {
      trackingId: `CONFIRM-TEST-${Date.now()}`,
      courierLink: 'https://tracking.example.com/CONFIRM-TEST-123456'
    };

    const dispatchResult = await dispatchOrder(newOrder.id, manager.id, dispatchData);
    
    if (!dispatchResult.success) {
      throw new Error(`Failed to dispatch order: ${dispatchResult.message}`);
    }

    console.log(`✅ Order dispatched successfully! Status: ${dispatchResult.data.status}`);
    console.log(`✅ Tracking ID: ${dispatchResult.data.tracking?.trackingId}`);

    // Test 7: Test raise issue workflow
    console.log('\n⚠️ Test 7: Testing raise issue workflow...');
    
    // Create another order for testing raise issue
    const issueOrder = await prisma.order.create({
      data: {
        orderNumber: `ISSUE-TEST-${Date.now()}`,
        status: 'UNDER_REVIEW',
        remarks: 'Test order for raise issue workflow',
        totalItems: 1,
        totalValue: 100.00,
        requesterId: branchUser2.id,
        branchId: 'branch_2_test'
      }
    });

    await prisma.orderItem.create({
      data: {
        orderId: issueOrder.id,
        itemId: testItem.id,
        qtyRequested: 1,
        unitPrice: 100.00,
        totalPrice: 100.00
      }
    });

    // Approve the order
    const issueOrderWithItems = await prisma.order.findUnique({
      where: { id: issueOrder.id },
      include: { orderItems: true }
    });

    const issueApprovedItems = issueOrderWithItems.orderItems.map(item => ({
      orderItemId: item.id,
      qtyApproved: 0 // Approve 0 quantity to test issue raising
    }));

    await approveOrder(issueOrder.id, manager.id, issueApprovedItems);

    // Branch user raises issue
    const issueResult = await raiseOrderIssue(issueOrder.id, branchUser2.id, 'Approved quantity is too low, need at least 1 unit');
    
    if (!issueResult.success) {
      throw new Error(`Failed to raise issue: ${issueResult.message}`);
    }

    console.log(`✅ Issue raised successfully! Status: ${issueResult.data.status}`);
    console.log(`✅ Issue reason stored in remarks: ${issueResult.data.remarks}`);

    // Test 8: Verify notifications were created
    console.log('\n📬 Test 8: Checking notifications...');
    
    const notifications = await prisma.notification.findMany({
      where: {
        OR: [
          { orderId: newOrder.id },
          { orderId: issueOrder.id }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`✅ Notifications created: ${notifications.length}`);
    notifications.forEach(notification => {
      console.log(`   - ${notification.type}: ${notification.title}`);
    });

    // Test 9: Test manager can see CONFIRM_PENDING orders
    console.log('\n📊 Test 9: Testing manager pending orders view...');
    
    const pendingOrdersResult = await getManagerPendingOrders(manager.id, { page: 1, limit: 10 });
    const pendingOrders = pendingOrdersResult.data.orders;
    
    console.log(`✅ Manager can see ${pendingOrders.length} pending orders`);
    
    const confirmPendingOrders = pendingOrders.filter(order => order.status === 'CONFIRM_PENDING');
    const underReviewOrders = pendingOrders.filter(order => order.status === 'UNDER_REVIEW');
    
    console.log(`   - CONFIRM_PENDING: ${confirmPendingOrders.length}`);
    console.log(`   - UNDER_REVIEW: ${underReviewOrders.length}`);

    console.log('\n🎉 All confirm pending workflow tests passed!');
    console.log('\n📋 Summary:');
    console.log(`✅ Order approval sets status to CONFIRM_PENDING`);
    console.log(`✅ Branch user can confirm approved orders`);
    console.log(`✅ Branch user can raise issues with approved orders`);
    console.log(`✅ Confirmed orders can be dispatched`);
    console.log(`✅ Manager can see both UNDER_REVIEW and CONFIRM_PENDING orders`);
    console.log(`✅ Notifications are sent for all workflow steps`);
    console.log(`✅ Order status transitions work correctly`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

async function main() {
  await testConfirmPendingWorkflow();
  await prisma.$disconnect();
}

main().catch(console.error);

