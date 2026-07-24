/** Minimal RFC 4180 CSV parser (quoted fields, "" escapes, no external deps). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

const NUMERIC_FIELDS = new Set([
  'Amount',
  'Amount in grams',
  'Calories',
  'Carbs',
  'Carbs fiber',
  'Carbs sugar',
  'Fat',
  'Fat saturated',
  'Fat unsaturated',
  'Cholesterol',
  'Protein',
  'Potassium',
  'Sodium',
]);

/** Parses the Lifesum export CSV into an array of entry objects. */
export function parseNutritionCsv(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];

  const [header, ...dataRows] = rows;
  return dataRows.map((row) => {
    const entry = {};
    header.forEach((key, i) => {
      const raw = row[i] ?? '';
      entry[key] = NUMERIC_FIELDS.has(key) ? Number(raw) : raw;
    });
    return entry;
  });
}
