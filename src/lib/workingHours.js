// Utilities to calculate and add working hours (business hours 09:00-17:00, Mon-Fri)
const BUSINESS_START_HOUR = 9;
const BUSINESS_END_HOUR = 17;

function isWeekend(date) {
  const d = new Date(date);
  const day = d.getDay();
  return day === 0 || day === 6;
}

function setTime(date, hour, minute = 0, second = 0, ms = 0) {
  const d = new Date(date);
  d.setHours(hour, minute, second, ms);
  return d;
}

// Calculate working hours elapsed between two Date objects (fractional hours)
function calculateWorkingHours(from, to) {
  let start = new Date(from);
  let end = new Date(to);
  if (start >= end) return 0;

  let totalMs = 0;
  // iterate days
  let cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);

  while (cursor <= end) {
    if (!isWeekend(cursor)) {
      const businessStart = setTime(cursor, BUSINESS_START_HOUR);
      const businessEnd = setTime(cursor, BUSINESS_END_HOUR);

      const sliceStart = start > businessStart ? start : businessStart;
      const sliceEnd = end < businessEnd ? end : businessEnd;

      if (sliceEnd > sliceStart) {
        totalMs += sliceEnd - sliceStart;
      }
    }
    // next day
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
  }

  return totalMs / (1000 * 60 * 60);
}

// Add working hours to a start date and return resulting Date
function addWorkingHours(startDate, hoursToAdd) {
  let remaining = hoursToAdd;
  let cursor = new Date(startDate);

  // if start is outside business hours, move to next business time
  if (isWeekend(cursor) || cursor.getHours() >= BUSINESS_END_HOUR) {
    // move to next business day start
    do {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(BUSINESS_START_HOUR, 0, 0, 0);
    } while (isWeekend(cursor));
  } else if (cursor.getHours() < BUSINESS_START_HOUR) {
    cursor.setHours(BUSINESS_START_HOUR, 0, 0, 0);
  }

  while (remaining > 0) {
    if (isWeekend(cursor)) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(BUSINESS_START_HOUR, 0, 0, 0);
      continue;
    }

    const businessEnd = setTime(cursor, BUSINESS_END_HOUR);
    const availableMs = businessEnd - cursor;
    const availableHours = availableMs / (1000 * 60 * 60);

    if (availableHours >= remaining) {
      // finish within current day
      cursor = new Date(cursor.getTime() + remaining * 60 * 60 * 1000);
      remaining = 0;
      break;
    } else {
      // consume the rest of the day then move to next business day
      remaining -= availableHours;
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(BUSINESS_START_HOUR, 0, 0, 0);
    }
  }

  return cursor;
}

module.exports = {
  calculateWorkingHours,
  addWorkingHours,
};
