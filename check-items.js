const prisma = require('./src/lib/prisma');

async function checkItems() {
  try {
    const items = await prisma.item.findMany({
      where: { isActive: true },
      select: {
        sku: true,
        name: true,
        currentStock: true,
        price: true,
        isActive: true
      },
      take: 20
    });

    console.log(`\n✅ Found ${items.length} active items in database:\n`);
    items.forEach((item, index) => {
      console.log(`${index + 1}. SKU: ${item.sku}, Name: ${item.name}, Stock: ${item.currentStock}, Price: ${item.price}`);
    });

    // Also count total
    const total = await prisma.item.count();
    console.log(`\n📊 Total items in database: ${total}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkItems();
