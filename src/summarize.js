const MACRO_FIELDS = ['Calories', 'Carbs', 'Fat', 'Protein', 'Sodium', 'Potassium'];

/** Groups nutrition entries by date and sums macro fields per day. */
export function summarizeByDay(entries) {
  const byDate = new Map();

  for (const entry of entries) {
    const date = entry.Date;
    if (!byDate.has(date)) {
      const totals = { date, entryCount: 0 };
      for (const field of MACRO_FIELDS) totals[field] = 0;
      byDate.set(date, totals);
    }
    const totals = byDate.get(date);
    totals.entryCount += 1;
    for (const field of MACRO_FIELDS) totals[field] += entry[field] ?? 0;
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
