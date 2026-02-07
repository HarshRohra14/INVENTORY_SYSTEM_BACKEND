// This file is deprecated. Arranging logic moved into OrderController/OrderService.
// Kept as a stub for compatibility but recommend removing import references.
const updateArrangingStageController = async (req, res) => {
  return res.status(410).json({ success: false, message: 'Arranging controller removed. Use /api/orders/arranging-stage via OrderController.' });
};

module.exports = { updateArrangingStageController };
