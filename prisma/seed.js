const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

/**
 * Database seed file
 * Creates initial data for development and testing
 */

async function main() {
  console.log('🌱 Starting database seeding...');

  try {
    // Create default branches
    const branch1 = await prisma.branch.upsert({
      where: { id: 'branch_main' },
      update: {},
      create: {
        id: 'branch_main',
        name: 'Main Branch',
        address: '123 Main Street',
        city: 'Seoul',
        state: 'Seoul',
        zipCode: '12345',
        phone: '+82-2-1234-5678',
        email: 'main@company.com'
      }
    });

    const branch2 = await prisma.branch.upsert({
      where: { id: 'branch_warehouse' },
      update: {},
      create: {
        id: 'branch_warehouse',
        name: 'Warehouse Branch',
        address: '456 Warehouse Road',
        city: 'Busan',
        state: 'Busan',
        zipCode: '54321',
        phone: '+82-51-9876-5432',
        email: 'warehouse@company.com'
      }
    });

    console.log('✅ Created branches');

    // Create default admin user
    const adminPassword = await bcrypt.hash('admin123', 12);
    const admin = await prisma.user.upsert({
      where: { email: 'admin@company.com' },
      update: {},
      create: {
        email: 'admin@company.com',
        password: adminPassword,
        firstName: 'System',
        lastName: 'Administrator',
        role: 'ADMIN',
        branchId: branch1.id,
        phoneNumber: '+82 01012345678'
      }
    });

    // Create default manager user
    const managerPassword = await bcrypt.hash('manager123', 12);
    const manager = await prisma.user.upsert({
      where: { email: 'manager@company.com' },
      update: {},
      create: {
        email: 'manager@company.com',
        password: managerPassword,
        firstName: 'John',
        lastName: 'Manager',
        role: 'MANAGER',
        branchId: branch1.id,
        phoneNumber: '+82 01023456789'
      }
    });

    // Create default branch user
    const branchUserPassword = await bcrypt.hash('user123', 12);
    const branchUser = await prisma.user.upsert({
      where: { email: 'user@company.com' },
      update: {},
      create: {
        email: 'user@company.com',
        password: branchUserPassword,
        firstName: 'Jane',
        lastName: 'User',
        role: 'BRANCH_USER',
        branchId: branch2.id,
        phoneNumber: '+82 01034567890'
      }
    });

    // Create default accounts user
    const accountsPassword = await bcrypt.hash('accounts123', 12);
    const accounts = await prisma.user.upsert({
      where: { email: 'accounts@company.com' },
      update: {},
      create: {
        email: 'accounts@company.com',
        password: accountsPassword,
        firstName: 'Bob',
        lastName: 'Accountant',
        role: 'ACCOUNTS',
        branchId: branch1.id,
        phoneNumber: '+82 01045678901'
      }
    });

    // Create default packager user
    const packagerPassword = await bcrypt.hash('packager123', 12);
    const packager = await prisma.user.upsert({
      where: { email: 'packager@company.com' },
      update: {},
      create: {
        email: 'packager@company.com',
        password: packagerPassword,
        firstName: 'Paula',
        lastName: 'Packager',
        role: 'PACKAGER',
        branchId: branch2.id,
        phoneNumber: '+82 01056789012'
      }
    });

    // Create default dispatcher user
    const dispatcherPassword = await bcrypt.hash('dispatcher123', 12);
    const dispatcher = await prisma.user.upsert({
      where: { email: 'dispatcher@company.com' },
      update: {},
      create: {
        email: 'dispatcher@company.com',
        password: dispatcherPassword,
        firstName: 'Derek',
        lastName: 'Dispatcher',
        role: 'DISPATCHER',
        branchId: branch2.id,
        phoneNumber: '+82 01067890123'
      }
    });

    console.log('✅ Created default users');

    // Create sample items (these would normally come from BoxHero sync)
    const sampleItems = [
      {
        boxHeroId: 'sample_item_001',
        name: 'Laptop Computer',
        category: 'Electronics',
        sku: 'LAP001',
        barcode: '1234567890123',
        unit: 'pcs',
        currentStock: 25,
        cost: 800.00,
        price: 1200.00,
        safetyStock: 5,
        targetLocation: 'Warehouse A',
        storageLocation: 'Shelf 01',
        branchId: branch1.id
      },
      {
        boxHeroId: 'sample_item_002',
        name: 'Office Chair',
        category: 'Furniture',
        sku: 'CHAIR001',
        barcode: '1234567890124',
        unit: 'pcs',
        currentStock: 15,
        cost: 150.00,
        price: 250.00,
        safetyStock: 3,
        targetLocation: 'Warehouse B',
        storageLocation: 'Shelf 02',
        branchId: branch1.id
      },
      {
        boxHeroId: 'sample_item_003',
        name: 'A4 Paper',
        category: 'Office Supplies',
        sku: 'PAPER001',
        barcode: '1234567890125',
        unit: 'ream',
        currentStock: 100,
        cost: 5.00,
        price: 8.00,
        safetyStock: 20,
        targetLocation: 'Warehouse C',
        storageLocation: 'Shelf 03',
        branchId: branch2.id
      }
    ];

    for (const itemData of sampleItems) {
      await prisma.item.upsert({
        where: { boxHeroId: itemData.boxHeroId },
        update: {},
        create: itemData
      });
    }

    console.log('✅ Created sample items');

    // Create a sample notification
    await prisma.notification.create({
      data: {
        type: 'SYSTEM_ALERT',
        title: 'System Initialized',
        message: 'Inventory Management System has been successfully initialized with sample data.',
        isRead: false
      }
    });

    console.log('✅ Created sample notification');

  console.log('\n🎉 Database seeding completed successfully!');
  console.log('\n📋 Default users created:');
  console.log('  Admin: admin@company.com / admin123');
  console.log('  Manager: manager@company.com / manager123');
  console.log('  Branch User: user@company.com / user123');
  console.log('  Accounts: accounts@company.com / accounts123');
  console.log('  Packager: packager@company.com / packager123');
  console.log('  Dispatcher: dispatcher@company.com / dispatcher123');
    console.log('\n⚠️  Please change these passwords in production!');

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
