import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsvText, validateEnquiryImportRows, buildCsv } from '../public/csv-utils.js';
import { getDueStatus, getDueLabel } from '../public/date-utils.js';
import { computeMasterTripMetrics, autoQualifyApplication, buildPublicTripPostingView, analyzeRooming, buildHotelRoomingRows, buildGeneratedDocumentText, buildBillingExportRows, buildSocialPostText, cloneMasterTrip } from '../public/trip-utils.js';
import { renderMessageTemplate, parseInboundEmailText } from '../public/template-utils.js';
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

test('getDueStatus and getDueLabel classify overdue, today, soon, and ok dates', () => {
  const today = '2026-11-16';
  assert.equal(getDueStatus('2026-11-15', today), 'overdue');
  assert.equal(getDueLabel('overdue'), 'Restant');
  assert.equal(getDueStatus('2026-11-16', today), 'today');
  assert.equal(getDueLabel('today'), 'Azi');
  assert.equal(getDueStatus('2026-11-19', today), 'soon');
  assert.equal(getDueLabel('soon'), 'În curând');
  assert.equal(getDueStatus('2026-11-25', today), 'ok');
  assert.equal(getDueStatus('', today), 'none');
});

test('computeMasterTripMetrics calculates cost, revenue, and profit accurately', () => {
  const trip = { id: 't1', maxPax: 10, costPerPax: 600, pricePerPax: 800, fixedCost: 200, currency: 'EUR' };
  const apps = [
    { tripId: 't1', pax: 2, stage: 'Confirmat' },
    { tripId: 't1', pax: 2, stage: 'Avans achitat' },
    { tripId: 't1', pax: 3, stage: 'Respins' },
  ];
  const m = computeMasterTripMetrics(trip, apps);
  assert.equal(m.confirmedPax, 4);
  assert.equal(m.totalCost, 4 * 600 + 200);
  assert.equal(m.totalRevenue, 4 * 800);
  assert.equal(m.profit, 600);
  assert.equal(m.spotsRemaining, 6);
});

test('autoQualifyApplication classifies budget fit and capacity limits', () => {
  const trip = { maxPax: 4, pricePerPax: 1000, currency: 'EUR' };
  const ok = autoQualifyApplication(trip, { pax: 2, budgetPerPax: 950 }, 1);
  assert.equal(ok.status, 'Calificat automat');
  assert.equal(ok.suggestedStage, 'Calificat');

  const low = autoQualifyApplication(trip, { pax: 1, budgetPerPax: 700 }, 1);
  assert.equal(low.status, 'Buget sub prag');

  const full = autoQualifyApplication(trip, { pax: 2, budgetPerPax: 1000 }, 3);
  assert.equal(full.status, 'Necesită verificare');
});

test('analyzeRooming detects unpaired Twin (Partajabil) and buildHotelRoomingRows strips pricing', () => {
  const customers = [
    { id: 'c1', name: 'Solo A' },
    { id: 'c2', name: 'Solo B' },
  ];
  const apps = [
    { customerId: 'c1', pax: 1, roomType: 'Twin (Partajabil)', roomCode: 'Cam. 1', stage: 'Confirmat', pricePerPax: 999 },
    { customerId: 'c2', pax: 1, roomType: 'Twin (Partajabil)', roomCode: 'Cam. 2', stage: 'Aplicat', pricePerPax: 999 },
  ];
  const unpaired = analyzeRooming(apps, customers);
  assert.equal(unpaired.unpairedShareCount, 2);

  // Pair Solo B into Cam. 1
  apps[1].roomCode = 'Cam. 1';
  const paired = analyzeRooming(apps, customers);
  assert.equal(paired.unpairedShareCount, 0);
  assert.equal(paired.rooms[0].pax, 2);

  const hotelRows = buildHotelRoomingRows(apps, customers);
  assert.equal(hotelRows.length, 1);
  assert.equal(hotelRows[0].oaspeti, 'Solo A + Solo B');
  assert.equal('pricePerPax' in hotelRows[0], false);
});

test('analyzeRooming tracks per-stay Double/Single inventory limits', () => {
  const stay = { id: 's1', name: 'Ha Long Cruise', nights: 2, doubleRooms: 1, singleRooms: 0 };
  const customers = [{ id: 'c1', name: 'A' }, { id: 'c2', name: 'B' }];
  const apps = [
    { customerId: 'c1', pax: 2, roomType: 'Double', roomCode: 'Cam. 1', stage: 'Confirmat' },
    { customerId: 'c2', pax: 1, roomType: 'Single', roomCode: 'Cam. 2', stage: 'Confirmat' },
  ];
  const res = analyzeRooming(apps, customers, stay);
  assert.equal(res.usedDouble, 1);
  assert.equal(res.usedSingle, 1);
  assert.equal(res.inventoryWarnings.length, 1);
  assert.ok(res.inventoryWarnings[0].includes('Single'));
});

test('renderMessageTemplate interpolates trip, applicant, and customer fields', () => {
  const out = renderMessageTemplate('offer-deposit', {
    trip: { title: 'Svalbard', dates: '14-21 mar', pricePerPax: 1850, currency: 'EUR' },
    app: { pax: 2 },
    customer: { name: 'Radu Demo' },
    metrics: { spotsRemaining: 6 },
  });
  assert.ok(out.subject.includes('Svalbard'));
  assert.ok(out.body.includes('Radu Demo'));
  assert.ok(out.body.includes('3700 EUR'));
  assert.ok(out.body.includes('6 locuri'));
});

test('buildPublicTripPostingView strips internal costs and autoQualifyApplication evaluates custom questions', () => {
  const trip = {
    id: 't1',
    title: 'Svalbard',
    destination: 'Longyearbyen',
    dates: '2027-03-14',
    maxPax: 6,
    costPerPax: 1400,
    pricePerPax: 1850,
    fixedCost: 400,
    currency: 'EUR',
    postingStatus: 'Publicat',
    customQuestions: [{ id: 'q1', label: 'Drumeții iarna?', requiredAnswer: 'Da' }],
  };
  const pub = buildPublicTripPostingView(trip, [{ tripId: 't1', pax: 2, stage: 'Confirmat' }]);
  assert.equal(pub.spotsRemaining, 4);
  assert.equal('costPerPax' in pub, false);
  assert.equal('fixedCost' in pub, false);

  const qFail = autoQualifyApplication(trip, { pax: 1, budgetPerPax: 1850, answers: { q1: 'Nu' } }, 2);
  assert.equal(qFail.status, 'Necesită verificare');
});

test('parseInboundEmailText extracts DD.MM.YYYY date and currency amount from supplier email', () => {
  const res = parseInboundEmailText('Basecamp Hotel: Vă rugăm să achitați avansul de 1800 EUR până la 25.11.2026.');
  assert.equal(res.dueDate, '2026-11-25');
  assert.equal(res.amount, 1800);
  assert.equal(res.currency, 'EUR');
});

test('Server /api/public/trips strips internal costs and /api/public/apply auto-qualifies applicant', async () => {
  const initialState = {
    trips: [
      {
        id: 'trip-1',
        title: 'Svalbard',
        destination: 'Longyearbyen',
        dates: '2027-03-14',
        maxPax: 6,
        costPerPax: 1400,
        pricePerPax: 1850,
        fixedCost: 400,
        currency: 'EUR',
        postingStatus: 'Publicat',
      },
    ],
    customers: [],
    applications: [],
  };
  const server = createAppServer({ initialState, inMemoryOnly: true });

  const pubRes = await invokeHandler(server, 'GET', '/api/public/trips');
  assert.equal(pubRes.status, 200);
  const pubData = pubRes.json();
  assert.equal(pubData.trips.length, 1);
  assert.equal('costPerPax' in pubData.trips[0], false);

  const applyRes = await invokeHandler(server, 'POST', '/api/public/apply', {
    tripId: 'trip-1',
    name: 'Test Traveler',
    pax: 2,
    budgetPerPax: 1900,
  });
  assert.equal(applyRes.status, 200);
  assert.equal(applyRes.json().qualificationStatus, 'Calificat automat');
});

test('buildGeneratedDocumentText separates Client Itinerary from Supplier Rooming Borderou', () => {
  const trip = {
    id: 't1',
    title: 'Svalbard',
    destination: 'Longyearbyen',
    dates: '2027-03-14',
    costPerPax: 1400,
    pricePerPax: 1850,
    currency: 'EUR',
    stays: [{ id: 's1', name: 'Basecamp Hotel', nights: 7, doubleRooms: 4, singleRooms: 2 }],
  };
  const customers = [{ id: 'c1', name: 'Radu Demo' }];
  const apps = [{ tripId: 't1', customerId: 'c1', pax: 2, roomType: 'Double', roomCode: 'Cam. 1', stage: 'Confirmat' }];

  const clientDoc = buildGeneratedDocumentText('client_itinerary', trip, apps, customers);
  assert.ok(clientDoc.includes('Basecamp Hotel'));
  assert.ok(clientDoc.includes('1850 EUR'));
  assert.equal(clientDoc.includes('1400'), false);

  const supplierDoc = buildGeneratedDocumentText('supplier_rooming', trip, apps, customers);
  assert.ok(supplierDoc.includes('Cam. 1 (Double, 2 pax): Radu Demo'));
  assert.equal(supplierDoc.includes('1850'), false);
});

test('buildBillingExportRows and buildSocialPostText generate accounting and promo outputs', () => {
  const trip = {
    id: 'trip-1',
    title: 'Svalbard',
    destination: 'Longyearbyen',
    dates: '2027-03-14',
    maxPax: 10,
    pricePerPax: 1000,
    currency: 'EUR',
    publicSummary: 'Expediție arctică.',
  };
  const customers = [{ id: 'c1', name: 'Radu Demo' }];
  const apps = [{ tripId: 'trip-1', customerId: 'c1', pax: 2, depositPaid: true, stage: 'Avans achitat' }];

  const rows = buildBillingExportRows(trip, apps, customers);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].total, 2000);
  assert.equal(rows[0].avans_30_proc, 600);
  assert.equal(rows[0].rest_plata, 1400);

  const post = buildSocialPostText(trip, apps, 'https://example.com');
  assert.ok(post.includes('8 locuri libere'));
  assert.ok(post.includes('https://example.com/?apply=trip-1'));
});

test('cloneMasterTrip creates a new Draft trip with cloned stays and custom questions', () => {
  const original = {
    id: 'trip-1',
    title: 'Svalbard',
    postingStatus: 'Publicat',
    stays: [{ id: 's1', name: 'Basecamp', nights: 7, doubleRooms: 4, singleRooms: 2 }],
    customQuestions: [{ id: 'q1', label: 'Drumeții?', requiredAnswer: 'Da' }],
  };
  const cloned = cloneMasterTrip(original, 'trip-2');
  assert.equal(cloned.id, 'trip-2');
  assert.equal(cloned.postingStatus, 'Draft');
  assert.ok(cloned.title.includes('Ediție nouă'));
  assert.equal(cloned.stays.length, 1);
  assert.notEqual(cloned.stays[0].id, 's1');
  assert.equal(cloned.customQuestions.length, 1);
});
