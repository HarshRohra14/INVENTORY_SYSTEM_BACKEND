const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  try {
    // First, let's check what users already exist
    console.log('🔍 Checking existing users...');
    const existingUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        branchId: true
      }
    });
    
    console.log('📋 Existing users:', existingUsers.length);
    existingUsers.forEach(user => {
      console.log(`   - ${user.email} (${user.role})`);
    });

    // Create test branches
    console.log('\n📍 Creating test branches...');
    
    const branch1 = await prisma.branch.upsert({
      where: { id: 'branch_1_test' },
      update: {},
      create: {
        id: 'branch_1_test',
        name: 'Downtown Branch',
        address: '123 Main Street',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        phone: '+1-555-0101',
        email: 'downtown@company.com',
        isActive: true
      }
    });

    const branch2 = await prisma.branch.upsert({
      where: { id: 'branch_2_test' },
      update: {},
      create: {
        id: 'branch_2_test',
        name: 'Uptown Branch',
        address: '456 Oak Avenue',
        city: 'New York',
        state: 'NY',
        zipCode: '10002',
        phone: '+1-555-0102',
        email: 'uptown@company.com',
        isActive: true
      }
    });

    console.log('✅ Branches created:', branch1.name, 'and', branch2.name);

    // Create test manager with unique email
    console.log('\n👨‍💼 Creating test manager...');
    
    const hashedPassword = await bcrypt.hash('manager123', 10);
    
    const manager = await prisma.user.upsert({
      where: { email: 'test.manager@company.com' },
      update: {},
      create: {
        email: 'test.manager@company.com',
        password: hashedPassword,
        firstName: 'John',
        lastName: 'Manager',
        role: 'MANAGER',
        branchId: null, // Managers don't have a single branch assignment
        isActive: true
      }
    });

    console.log('✅ Manager created:', manager.firstName, manager.lastName);

    // Create test branch users with unique emails
    console.log('\n👥 Creating test branch users...');
    
    const branchUser1Password = await bcrypt.hash('user123', 10);
    const branchUser2Password = await bcrypt.hash('user123', 10);

    const branchUser1 = await prisma.user.upsert({
      where: { email: 'test.downtown.user@company.com' },
      update: {},
      create: {
        email: 'test.downtown.user@company.com',
        password: branchUser1Password,
        firstName: 'Alice',
        lastName: 'Smith',
        role: 'BRANCH_USER',
        branchId: branch1.id,
        isActive: true
      }
    });

    const branchUser2 = await prisma.user.upsert({
      where: { email: 'test.uptown.user@company.com' },
      update: {},
      create: {
        email: 'test.uptown.user@company.com',
        password: branchUser2Password,
        firstName: 'Bob',
        lastName: 'Johnson',
        role: 'BRANCH_USER',
        branchId: branch2.id,
        isActive: true
      }
    });

    console.log('✅ Branch users created:', branchUser1.firstName, 'and', branchUser2.firstName);

    // Assign manager to both branches
    console.log('\n🔗 Assigning manager to branches...');
    
    const assignment1 = await prisma.managerBranch.upsert({
      where: {
        managerId_branchId: {
          managerId: manager.id,
          branchId: branch1.id
        }
      },
      update: { isActive: true },
      create: {
        managerId: manager.id,
        branchId: branch1.id,
        isActive: true
      }
    });

    const assignment2 = await prisma.managerBranch.upsert({
      where: {
        managerId_branchId: {
          managerId: manager.id,
          branchId: branch2.id
        }
      },
      update: { isActive: true },
      create: {
        managerId: manager.id,
        branchId: branch2.id,
        isActive: true
      }
    });

    console.log('✅ Manager assigned to both branches');

    // Create some test items
    console.log('\n📦 Creating test items...');
    
    const item1 = await prisma.item.upsert({
      where: { id: 'item_1_test' },
      update: {},
      create: {
        id: 'item_1_test',
        boxHeroId: `boxhero_test_001_${Date.now()}`,
        name: 'Office Chair',
        category: 'Furniture',
        sku: 'CHAIR001',
        barcode: '1234567890123',
        unit: 'pcs',
        currentStock: 50,
        safetyStock: 10,
        cost: 150.00,
        price: 200.00,
        branchId: null, // Available to all branches
        isActive: true
      }
    });

    const item2 = await prisma.item.upsert({
      where: { id: 'item_2_test' },
      update: {},
      create: {
        id: 'item_2_test',
        boxHeroId: `boxhero_test_002_${Date.now()}`,
        name: 'Laptop Stand',
        category: 'Electronics',
        sku: 'STAND001',
        barcode: '1234567890124',
        unit: 'pcs',
        currentStock: 25,
        safetyStock: 5,
        cost: 75.00,
        price: 100.00,
        branchId: null, // Available to all branches
        isActive: true
      }
    });

    console.log('✅ Test items created:', item1.name, 'and', item2.name);

    // Create test orders from both branch users
    console.log('\n📋 Creating test orders...');
    
    // Order from Branch User 1 (Downtown Branch)
    const order1 = await prisma.order.create({
      data: {
        orderNumber: `ORD-${Date.now()}-001`,
        status: 'UNDER_REVIEW',
        remarks: 'Need chairs for new office setup',
        totalItems: 2,
        totalValue: 400.00,
        requesterId: branchUser1.id,
        branchId: branch1.id
      }
    });

    // Order items for order 1
    await prisma.orderItem.createMany({
      data: [
        {
          orderId: order1.id,
          itemId: item1.id,
          qtyRequested: 2,
          unitPrice: 200.00,
          totalPrice: 400.00
        }
      ]
    });

    // Order from Branch User 2 (Uptown Branch)
    const order2 = await prisma.order.create({
      data: {
        orderNumber: `ORD-${Date.now()}-002`,
        status: 'UNDER_REVIEW',
        remarks: 'Need laptop stands for conference room',
        totalItems: 3,
        totalValue: 300.00,
        requesterId: branchUser2.id,
        branchId: branch2.id
      }
    });

    // Order items for order 2
    await prisma.orderItem.createMany({
      data: [
        {
          orderId: order2.id,
          itemId: item2.id,
          qtyRequested: 3,
          unitPrice: 100.00,
          totalPrice: 300.00
        }
      ]
    });

    console.log('✅ Test orders created from both branch users');

    // Create notifications for the orders
    await prisma.notification.createMany({
      data: [
        {
          type: 'ORDER_CREATED',
          title: 'New Order Created',
          message: `Order ${order1.orderNumber} has been created and is under review`,
          userId: branchUser1.id,
          orderId: order1.id
        },
        {
          type: 'ORDER_CREATED',
          title: 'New Order Created',
          message: `Order ${order2.orderNumber} has been created and is under review`,
          userId: branchUser2.id,
          orderId: order2.id
        }
      ]
    });

    console.log('✅ Notifications created');

    // Summary
    console.log('\n🎉 Test data setup complete!');
    console.log('\n📊 Summary:');
    console.log(`👨‍💼 Manager: ${manager.firstName} ${manager.lastName} (${manager.email})`);
    console.log(`👥 Branch Users:`);
    console.log(`   - ${branchUser1.firstName} ${branchUser1.lastName} (${branchUser1.email}) - ${branch1.name}`);
    console.log(`   - ${branchUser2.firstName} ${branchUser2.lastName} (${branchUser2.email}) - ${branch2.name}`);
    console.log(`📦 Items: ${item1.name}, ${item2.name}`);
    console.log(`📋 Orders: ${order1.orderNumber}, ${order2.orderNumber}`);
    console.log(`🔗 Manager assigned to: ${branch1.name}, ${branch2.name}`);
    
    console.log('\n🔑 Login Credentials:');
    console.log(`Manager: test.manager@company.com / manager123`);
    console.log(`Branch User 1: test.downtown.user@company.com / user123`);
    console.log(`Branch User 2: test.uptown.user@company.com / user123`);

    // Test the manager can see orders from both branches
    console.log('\n🧪 Testing manager access...');
    const managerOrders = await prisma.order.findMany({
      where: {
        status: 'UNDER_REVIEW',
        branchId: {
          in: [branch1.id, branch2.id]
        }
      },
      include: {
        requester: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        branch: {
          select: {
            name: true
          }
        },
        orderItems: {
          include: {
            item: {
              select: {
                name: true,
                sku: true
              }
            }
          }
        }
      }
    });

    console.log(`✅ Manager can see ${managerOrders.length} pending orders:`);
    managerOrders.forEach(order => {
      console.log(`   - ${order.orderNumber} from ${order.requester.firstName} ${order.requester.lastName} (${order.branch.name})`);
    });

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });