import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsvText, validateEnquiryImportRows, buildCsv } from '../public/csv-utils.js';
import { sanitizeOfferBrief, createAppServer } from '../server.mjs';

test('parseCsvText handles UTF-8 BOM, semicolons, and quoted commas', () => {
  const raw = '\uFEFFclient;destinatie;buget;moneda\n"Popescu, Ion";"Creta, Grecia";1500;EUR\n';
  const { headers, rows } = parseCsvText(raw);
  assert.deepEqual(headers, ['client', 'destinatie', 'buget', 'moneda']);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].client, 'Popescu, Ion');
  assert.equal(rows[0].destinatie, 'Creta, Grecia');
});

test('buildCsv outputs UTF-8 BOM and escapes commas', () => {
  const csv = buildCsv(['client', 'destinatie'], [{ client: 'Demo, A', destinatie: 'Roma' }]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"Demo, A",Roma'));
});

test('validateEnquiryImportRows flags invalid rows and detects duplicates', () => {
  const existing = [
    { id: 'enq-1', customerName: 'Familie Demo', destination: 'Antalya', travelDate: '2027-06-15' },
  ];
  const rows = [
    { __line: 2, client: 'Familie Demo', destinatie: 'Antalya', data_plecare: '2027-06-15', buget: '2000', moneda: 'EUR' },
    { __line: 3, client: '', destinatie: 'Roma', data_plecare: '15-06-2027', buget: '-5', moneda: 'GBP' },
  ];

  const validated = validateEnquiryImportRows(rows, existing);
  assert.equal(validated[0].valid, true);
  assert.equal(validated[0].duplicateOfId, 'enq-1');

  assert.equal(validated[1].valid, false);
  assert.ok(validated[1].errors.length >= 3);
});

test('sanitizeOfferBrief strips unexpected fields and enforces destination', () => {
  const bad = sanitizeOfferBrief({ destination: '' });
  assert.ok(bad.error);

  const ok = sanitizeOfferBrief({
    destination: 'Creta',
    dates: '10-17 iunie',
    travellersCount: '2 adulți',
    budget: '1500',
    currency: 'ron',
    customerName: 'SHOULD_BE_STRIPPED',
    email: 'secret@example.com',
  });
  assert.equal(ok.brief.destination, 'Creta');
  assert.equal(ok.brief.currency, 'RON');
  assert.equal('customerName' in ok.brief, false);
  assert.equal('email' in ok.brief, false);
});

import { Readable } from 'node:stream';

function invokeHandler(server, method, url, bodyObj) {
  return new Promise((resolve) => {
    const rawBody = bodyObj ? JSON.stringify(bodyObj) : '';
    const req = Readable.from(rawBody ? [Buffer.from(rawBody)] : []);
    req.method = method;
    req.url = url;
    req.headers = { 'content-type': 'application/json' };

    const chunks = [];
    const res = {
      statusCode: 200,
      headers: {},
      writeHead(status, headers = {}) {
        this.statusCode = status;
        this.headers = headers;
      },
      end(chunk) {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ status: this.statusCode, text, json: () => JSON.parse(text) });
      },
    };
    server.emit('request', req, res);
  });
}

test('HTTP server serves /api/health and handles missing GEMINI_API_KEY gracefully', async () => {
  const prevKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  const server = createAppServer();
  try {
    const healthRes = await invokeHandler(server, 'GET', '/api/health');
    assert.equal(healthRes.status, 200);
    const health = healthRes.json();
    assert.equal(health.ok, true);
    assert.equal(health.geminiConfigured, false);

    const draftRes = await invokeHandler(server, 'POST', '/api/offer-draft', {
      destination: 'Creta',
      currency: 'EUR',
    });
    assert.equal(draftRes.status, 503);
  } finally {
    if (prevKey !== undefined) process.env.GEMINI_API_KEY = prevKey;
  }
});
