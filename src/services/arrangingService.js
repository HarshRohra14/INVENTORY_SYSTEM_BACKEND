// Deprecated: arrangingService replaced by OrderService.updateArrangingStage
// Keep a stub so any accidental imports fail fast and indicate migration path.
module.exports = {
  updateArrangingStage: async () => {
    return { success: false, statusCode: 410, message: 'Deprecated. Use updateArrangingStage in orderService.' };
  }
};