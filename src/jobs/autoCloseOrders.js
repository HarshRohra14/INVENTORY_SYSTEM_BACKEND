const { PrismaClient } = require('@prisma/client');
const cron = require('node-cron');
const prisma = require('../lib/prisma'); // reuse shared prisma client
const { closeOrder } = require('../services/orderService');

/**
 * Calculate working hours between two Date objects.
 * Business hours: 09:00 - 17:00 (8 hours/day). Weekends are skipped.
 * Returns hours as a floating number.
 */
function calculateWorkingHours(from, to) {
  if (!from || !to) return 0;
  const start = new Date(from);
  const end = new Date(to);
  if (end <= start) return 0;

  const workStartH = 9;
  const workEndH = 17;
  let totalMs = 0;

  // iterate day-by-day
  const cur = new Date(start);
  while (cur < end) {
    const day = cur.getDay(); // 0 Sun .. 6 Sat
    if (day !== 0 && day !== 6) {
      // business window for this day
      const windowStart = new Date(cur);
      windowStart.setHours(workStartH, 0, 0, 0);
      const windowEnd = new Date(cur);
      windowEnd.setHours(workEndH, 0, 0, 0);

      const sliceStart = start > windowStart ? start : windowStart;
      const sliceEnd = end < windowEnd ? end : windowEnd;

      if (sliceEnd > sliceStart) {
        totalMs += sliceEnd - sliceStart;
      }
    }

    // move to next day 00:00
    cur.setDate(cur.getDate() + 1);
    cur.setHours(0, 0, 0, 0);
  }

  return totalMs / (1000 * 60 * 60);
}

/**
 * Cron job that runs daily and closes orders in CONFIRM_ORDER_RECEIVED
 * after 56 working hours (7 working days of 8h each) since `receivedAt`.
 */
function scheduleAutoClose() {
  // Run once daily (server local time) to close orders that reached autoCloseAt
  cron.schedule('5 2 * * *', async () => {
    console.log('🕐 Running auto-close orders job (daily)...');
    try {
      const now = new Date();
      const candidates = await prisma.order.findMany({
        where: {
          status: 'CONFIRM_ORDER_RECEIVED',
          autoCloseAt: { lte: now }
        },
        select: { id: true, orderNumber: true, autoCloseAt: true }
      });

      for (const o of candidates) {
        console.log(`Auto-closing order ${o.orderNumber} (${o.id}) scheduled at ${o.autoCloseAt}`);
        try {
          await closeOrder(o.id, 'SYSTEM_AUTO');
        } catch (err) {
          console.error(`Failed to auto-close order ${o.id}:`, err);
        }
      }
    } catch (err) {
      console.error('Auto-close job error:', err);
    }
  }, { scheduled: true });

  console.log('⏰ Auto-close job scheduled: every 30 minutes');
}

module.exports = { calculateWorkingHours, scheduleAutoClose };
