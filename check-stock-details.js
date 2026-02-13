const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkStockDetails() {
  try {
    const items = await prisma.item.findMany({
      take: 10,
      select: {
        name: true,
        sku: true,
        currentStock: true,
        safetyStock: true,
        isActive: true
      }
    });
    
    console.log('Stock details for sample items:');
    items.forEach((item, index) => {
      console.log(`${index + 1}. ${item.name}`);
      console.log(`   Current Stock: ${item.currentStock}`);
      console.log(`   Safety Stock: ${item.safetyStock}`);
      console.log(`   Is Null: ${item.safetyStock === null}`);
      console.log('---');
    });
    
    // Count items with null safety stock
    const nullSafetyStock = await prisma.item.count({
      where: {
        safetyStock: null,
        isActive: true
      }
    });
    
    const totalActive = await prisma.item.count({
      where: { isActive: true }
    });
    
    console.log(`\nItems with null safety stock: ${nullSafetyStock} out of ${totalActive} active items`);
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
  }
}

checkStockDetails();
