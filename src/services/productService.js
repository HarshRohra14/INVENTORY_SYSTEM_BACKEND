const prisma = require('../lib/prisma'); // reuse shared prisma client

/**
 * Fetch item details using SKU.
 * Works even if the item ID was deleted from other relations.
 */
const getItemBySku = async (sku) => {
  try {
    if (!sku || typeof sku !== "string") {
      return { success: false, message: "Invalid SKU provided." };
    }

    const item = await prisma.item.findUnique({
      where: { sku },
      select: {
        id: true,
        sku: true,
        name: true,
        category: true,
        unit: true,
        // stock: true,
        // unitPrice: true,
        // description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!item) {
      return { success: false, message: "Item not found for given SKU." };
    }

    return { success: true, data: item };
  } catch (error) {
    console.error("❌ Error fetching item by SKU:", error);
    return {
      success: false,
      message: "Error fetching item by SKU.",
      error: error.message,
    };
  }
};

module.exports = { getItemBySku };
