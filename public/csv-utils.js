/**
 * Utilitare CSV fără dependențe externe, partajate între browser și testele Node.
 * Suportă diacritice românești (UTF-8 BOM la export), ghilimele RFC 4180,
 * validare per rând și detecție de duplicate.
 */

export const VALID_CURRENCIES = ['EUR', 'RON', 'USD'];

export const ENQUIRY_STATUSES = [
  'Nouă',
  'Ofertată',
  'În negociere',
  'Convertită',
  'Pierdută',
];

export function escapeCsvCell(value) {
  const str = String(value ?? '');
  if (/[",\r\n;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv(headers, rows) {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => headers.map((h) => escapeCsvCell(row[h] ?? '')).join(',')),
  ];
  return '\uFEFF' + lines.join('\r\n');
}

/**
 * Parsează text CSV cu delimitator `,` sau `;` (auto-detectat pe prima linie).
 */
export function parseCsvText(text) {
  const clean = String(text ?? '').replace(/^\uFEFF/, '').trim();
  if (!clean) return { headers: [], rows: [] };

  const firstLine = clean.split(/\r?\n/, 1)[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const delimiter = semiCount > commaCount ? ';' : ',';

  const matrix = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(cell.trim());
      matrix.push(row);
      row = [];
      cell = '';
      i += 1;
    } else if (ch === '\n' || ch === '\r') {
      row.push(cell.trim());
      matrix.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    matrix.push(row);
  }

  if (matrix.length === 0) return { headers: [], rows: [] };
  const headers = matrix[0].map((h) => h.trim());
  const rows = matrix
    .slice(1)
    .filter((r) => r.some((v) => v !== ''))
    .map((r, idx) => {
      const obj = { __line: idx + 2 };
      headers.forEach((h, i) => {
        obj[h] = r[i] ?? '';
      });
      return obj;
    });

  return { headers, rows };
}

function isValidIsoDateOrEmpty(value) {
  if (!value) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Validează rândurile CSV pentru importul de Cereri (enquiries) și detectează duplicatele.
 * Cheie de duplicat: (clientName + destination + travelDate) normalizat.
 */
export function validateEnquiryImportRows(parsedRows, existingEnquiries = [], existingCustomers = []) {
  const customerById = new Map(existingCustomers.map((c) => [c.id, c.name]));
  const existingKeyToId = new Map();

  for (const enq of existingEnquiries) {
    const cName = enq.customerName || customerById.get(enq.customerId) || '';
    const key = normalizeEnquiryKey(cName, enq.destination, enq.travelDate);
    if (key) existingKeyToId.set(key, enq.id);
  }

  const seenInFile = new Set();

  return parsedRows.map((raw) => {
    const errors = [];
    const customerName = (raw.client || raw.customerName || raw.Client || '').trim();
    const destination = (raw.destinatie || raw.destination || raw.Destinatie || '').trim();
    const source = (raw.sursa || raw.source || raw.Sursa || 'Import CSV').trim();
    const travelDate = (raw.data_plecare || raw.travelDate || raw.DataPlecare || '').trim();
    const followUpDate = (raw.follow_up || raw.followUpDate || raw.FollowUp || '').trim();
    const budgetRaw = (raw.buget || raw.budget || raw.Buget || '').trim();
    const currencyRaw = (raw.moneda || raw.currency || raw.Moneda || 'EUR').trim().toUpperCase();
    const statusRaw = (raw.status || raw.Status || 'Nouă').trim();
    const notes = (raw.note || raw.notes || raw.Note || '').trim();

    if (!customerName) errors.push('Lipsește numele clientului (coloana client)');
    if (!destination) errors.push('Lipsește destinația (coloana destinatie)');
    if (!isValidIsoDateOrEmpty(travelDate)) {
      errors.push('Data plecării trebuie să fie YYYY-MM-DD');
    }
    if (!isValidIsoDateOrEmpty(followUpDate)) {
      errors.push('Data follow-up trebuie să fie YYYY-MM-DD');
    }

    let budget = 0;
    if (budgetRaw !== '') {
      const num = Number(budgetRaw.replace(',', '.'));
      if (!Number.isFinite(num) || num < 0) {
        errors.push('Buget invalid (trebuie număr pozitiv)');
      } else {
        budget = Math.round(num);
      }
    }

    const currency = VALID_CURRENCIES.includes(currencyRaw) ? currencyRaw : null;
    if (!currency) {
      errors.push(`Monedă invalidă (${currencyRaw}); folosiți EUR, RON sau USD`);
    }

    const status = ENQUIRY_STATUSES.includes(statusRaw) ? statusRaw : 'Nouă';

    const key = normalizeEnquiryKey(customerName, destination, travelDate);
    let duplicateOfId = null;
    let duplicateInFile = false;

    if (key) {
      if (existingKeyToId.has(key)) {
        duplicateOfId = existingKeyToId.get(key);
      }
      if (seenInFile.has(key)) {
        duplicateInFile = true;
      }
      seenInFile.add(key);
    }

    return {
      line: raw.__line,
      valid: errors.length === 0,
      errors,
      duplicateOfId,
      duplicateInFile,
      data: {
        customerName,
        destination,
        source,
        travelDate,
        followUpDate,
        budget,
        currency: currency || 'EUR',
        status,
        notes,
      },
    };
  });
}

function normalizeEnquiryKey(customerName, destination, travelDate) {
  const c = String(customerName || '').trim().toLowerCase();
  const d = String(destination || '').trim().toLowerCase();
  const t = String(travelDate || '').trim();
  if (!c || !d) return '';
  return `${c}|${d}|${t}`;
}
