import {
  buildCsv,
  parseCsvText,
  validateEnquiryImportRows,
  VALID_CURRENCIES,
} from '/csv-utils.js';
import { getDueStatus, getDueLabel } from '/date-utils.js';
import {
  APPLICATION_STAGES,
  ROOM_TYPES,
  POSTING_STATUSES,
  DEADLINE_KINDS,
  computeMasterTripMetrics,
  autoQualifyApplication,
  buildPublicTripPostingView,
  analyzeRooming,
  buildHotelRoomingRows,
} from '/trip-utils.js';
import { MESSAGE_TEMPLATES, renderMessageTemplate } from '/template-utils.js';

const STORAGE_KEY = 'travelagencyos_garlic_v2';

function createSeedState() {
  return {
    selectedTripId: 'trip-1',
    selectedStayId: 'stay-1',
    selectedAppId: 'app-1',
    activeCenterTab: 'applicants',
    trips: [
      {
        id: 'trip-1',
        title: 'Svalbard Arctic Expedition',
        destination: 'Longyearbyen, Svalbard',
        dates: '2027-03-14 → 2027-03-21',
        maxPax: 10,
        costPerPax: 1450,
        pricePerPax: 1850,
        fixedCost: 400,
        currency: 'EUR',
        postingStatus: 'Publicat',
        style: 'Expediție grup mic, snowmobile, observare natură',
        publicSummary: '7 zile în Arctica cu grup restrâns (max 10 persoane), tură cu snowmobilul și cabană nordică.',
        includedText: 'Cazare 7 nopți, ghid însoțitor, tură snowmobil, transfer aeroport',
        excludedText: 'Zbor internațional, echipament termic personal, asigurare',
        customQuestions: [
          { id: 'q-1', label: 'Rezistență la temperaturi sub -15°C și drumeții?', requiredAnswer: 'Da' },
          { id: 'q-2', label: 'Pașaport valabil la data călătoriei?', requiredAnswer: 'Da' },
        ],
        notes: 'Include ghid local și transfer aeroport. Echipament polar [DE CONFIRMAT].',
        stays: [
          { id: 'stay-1', name: 'Basecamp Longyearbyen', nights: 7, doubleRooms: 4, singleRooms: 2 },
        ],
      },
      {
        id: 'trip-2',
        title: 'Maramureș & Bucovina Trail',
        destination: 'Maramureș, România',
        dates: '2027-05-01 → 2027-05-04',
        maxPax: 12,
        costPerPax: 1150,
        pricePerPax: 1550,
        fixedCost: 300,
        currency: 'RON',
        postingStatus: 'Publicat',
        style: 'Drumeții ușoare, pensiuni locale, cină tradițională',
        publicSummary: 'Weekend prelungit pe poteci din Maramureș, cazare autentică în Breb și mese locale.',
        includedText: 'Cazare 3 nopți cu demipensiune, ghid montan, transport microbuz',
        excludedText: 'Mesele de prânz, bilete intrare obiective',
        customQuestions: [
          { id: 'q-3', label: 'Experiență minimă drumeții 3–4h/zi?', requiredAnswer: 'Da' },
        ],
        notes: 'Plecări din Timișoara / Cluj.',
        stays: [
          { id: 'stay-2', name: 'Pensiunea Breb', nights: 3, doubleRooms: 5, singleRooms: 2 },
        ],
      },
      {
        id: 'trip-3',
        title: 'Vietnam & Cambodgia (2 săpt.)',
        destination: 'Hanoi · Ha Long · Siem Reap',
        dates: '2027-10-10 → 2027-10-24',
        maxPax: 12,
        costPerPax: 1680,
        pricePerPax: 2150,
        fixedCost: 600,
        currency: 'EUR',
        postingStatus: 'Publicat',
        style: 'Grup de prieteni, street food, temple Angkor',
        publicSummary: 'Circuit de 14 zile din nordul Vietnamului până la templele Angkor Wat.',
        includedText: 'Cazare 4*, croazieră Ha Long Bay 2n, transferuri interne, ghid',
        excludedText: 'Zbor intercontinental, taxe de viză',
        customQuestions: [
          { id: 'q-4', label: 'Pașaport valabil minim 6 luni de la retur?', requiredAnswer: 'Da' },
        ],
        notes: 'Zbor internațional [DE CONFIRMAT].',
        stays: [
          { id: 'stay-3', name: 'Hanoi Boutique', nights: 4, doubleRooms: 5, singleRooms: 2 },
          { id: 'stay-4', name: 'Ha Long Cruise', nights: 2, doubleRooms: 5, singleRooms: 1 },
          { id: 'stay-5', name: 'Siem Reap Hotel', nights: 5, doubleRooms: 5, singleRooms: 2 },
        ],
      },
    ],
    customers: [
      { id: 'cust-1', name: 'Radu Demo', channel: 'WhatsApp', note: 'A mai fost în Islanda (date demo)' },
      { id: 'cust-2', name: 'Elena & Mihai Demo', channel: 'Instagram', note: 'Preferă grupuri mici (date demo)' },
      { id: 'cust-3', name: 'Vlad Demo', channel: 'Email', note: 'Întreabă de rate (date demo)' },
      { id: 'cust-4', name: 'Ana & Mara Demo', channel: 'WhatsApp', note: 'Drumeții de weekend (date demo)' },
    ],
    applications: [
      {
        id: 'app-1',
        tripId: 'trip-1',
        customerId: 'cust-1',
        pax: 2,
        budgetPerPax: 1900,
        depositPaid: true,
        roomType: 'Double',
        roomCode: 'Cam. 1',
        stage: 'Avans achitat',
        qualificationStatus: 'Calificat automat',
        qualificationReasons: ['Buget și locuri compatibile cu sejurul'],
        appliedAt: '2026-11-12',
        notes: ['12 nov · Aplicat prin formular sejur', '14 nov · Achitat avans 30%'],
      },
      {
        id: 'app-2',
        tripId: 'trip-1',
        customerId: 'cust-2',
        pax: 2,
        budgetPerPax: 1850,
        depositPaid: true,
        roomType: 'Double',
        roomCode: 'Cam. 2',
        stage: 'Confirmat',
        qualificationStatus: 'Calificat automat',
        qualificationReasons: ['Buget și locuri compatibile cu sejurul'],
        appliedAt: '2026-11-10',
        notes: ['10 nov · Confirmat locuri'],
      },
      {
        id: 'app-3',
        tripId: 'trip-1',
        customerId: 'cust-3',
        pax: 1,
        budgetPerPax: 1300,
        depositPaid: false,
        roomType: 'Twin (Partajabil)',
        roomCode: 'Cam. 3',
        stage: 'Aplicat',
        qualificationStatus: 'Buget sub prag',
        qualificationReasons: ['Buget (1300 EUR) sub pragul sejurului (1850 EUR)'],
        appliedAt: '2026-11-15',
        notes: ['15 nov · Caută coleg cameră Twin'],
      },
      {
        id: 'app-4',
        tripId: 'trip-2',
        customerId: 'cust-4',
        pax: 4,
        budgetPerPax: 1600,
        depositPaid: false,
        roomType: 'Double',
        roomCode: 'Cam. 1',
        stage: 'Ofertă trimisă',
        qualificationStatus: 'Calificat automat',
        qualificationReasons: ['Buget și locuri compatibile cu sejurul'],
        appliedAt: '2026-11-14',
        notes: ['14 nov · Trimis PDF pe WhatsApp'],
      },
    ],
    supplierDeadlines: [
      { id: 'sd-1', tripId: 'trip-1', supplierName: 'Basecamp Longyearbyen', kind: 'Rooming cut-off', dueDate: '2026-11-18', amount: 0, currency: 'EUR', done: false },
      { id: 'sd-2', tripId: 'trip-1', supplierName: 'Arctic Snowmobile DMC', kind: 'Avans furnizor', dueDate: '2026-11-22', amount: 1800, currency: 'EUR', done: false },
      { id: 'sd-3', tripId: 'trip-3', supplierName: 'Ha Long Bay Cruise', kind: 'Avans furnizor', dueDate: '2026-12-01', amount: 1200, currency: 'EUR', done: false },
    ],
    tasks: [
      { id: 'tsk-1', title: 'Confirmă echipament polar Svalbard', dueDate: '2026-11-18', done: false, tripId: 'trip-1' },
      { id: 'tsk-2', title: 'Follow-up Ana & Mara pentru Maramureș', dueDate: '2026-11-20', done: false, tripId: 'trip-2' },
    ],
    documents: [
      { id: 'doc-1', tripId: 'trip-1', title: 'Itinerariu Svalbard 2027.pdf', kind: 'Itinerariu', audience: 'Client', version: 2, sentLog: ['15 nov · Trimis grup WhatsApp (v2)'], updatedAt: '2026-11-15' },
      { id: 'doc-2', tripId: 'trip-1', title: 'Rooming List Hotel Polar.csv', kind: 'Rooming', audience: 'Furnizor', version: 1, sentLog: ['14 nov · Trimis la Hotel (v1)'], updatedAt: '2026-11-14' },
      { id: 'doc-3', tripId: 'trip-2', title: 'Program Maramureș 4 zile.pdf', kind: 'Itinerariu', audience: 'Client', version: 1, sentLog: [], updatedAt: '2026-11-12' },
    ],
    offerDrafts: {},
  };
}

let state = loadState();
let activeModal = null;
let stagedCsvRows = [];
let linkedExcelHandle = null;
let selectedTemplateId = MESSAGE_TEMPLATES[0].id;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeedState();
    const parsed = JSON.parse(raw);
    return {
      selectedTripId: parsed.selectedTripId || parsed.trips?.[0]?.id || '',
      selectedStayId: parsed.selectedStayId || '',
      selectedAppId: parsed.selectedAppId || '',
      activeCenterTab: parsed.activeCenterTab || 'applicants',
      trips: Array.isArray(parsed.trips) ? parsed.trips : [],
      customers: Array.isArray(parsed.customers) ? parsed.customers : [],
      applications: Array.isArray(parsed.applications) ? parsed.applications : [],
      supplierDeadlines: Array.isArray(parsed.supplierDeadlines) ? parsed.supplierDeadlines : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
      offerDrafts: parsed.offerDrafts && typeof parsed.offerDrafts === 'object' ? parsed.offerDrafts : {},
    };
  } catch {
    return createSeedState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtMoney(amount, currency) {
  return `${Number(amount || 0).toLocaleString('ro-RO')} ${esc(currency || 'EUR')}`;
}

function getCustomer(id) {
  return state.customers.find((c) => c.id === id) || { name: 'Client', channel: '-' };
}

function qualDotHtml(status, reasons = []) {
  const tip = esc((reasons || []).join('; '));
  if (status === 'Calificat automat') {
    return `<span class="qual-dot is-ok" title="${tip}">OK</span>`;
  }
  if (status === 'Buget sub prag') {
    return `<span class="qual-dot is-low" title="${tip}">Buget</span>`;
  }
  return `<span class="qual-dot is-warn" title="${tip}">Verifică</span>`;
}

function showToast(msg) {
  const region = document.getElementById('toast-region');
  if (!region) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  region.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

/* ---------------- NAVIGATION ---------------- */

function switchView(viewName) {
  document.querySelectorAll('.top-nav-btn').forEach((b) => {
    const active = b.dataset.view === viewName;
    b.classList.toggle('is-active', active);
    b.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('.view-section').forEach((sec) => {
    sec.hidden = sec.id !== `view-${viewName}`;
  });
  renderAll();
}

document.querySelectorAll('.top-nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

/* ---------------- RENDERING ---------------- */

function renderAll() {
  if (!document.getElementById('master-trips-list')) return;
  renderTripsView();
  renderTasksView();
  renderCustomersView();
}

function renderTripsView() {
  const listEl = document.getElementById('master-trips-list');
  document.getElementById('trips-count-badge').textContent = String(state.trips.length);

  if (state.trips.length === 0) {
    listEl.innerHTML = '<div class="muted small" style="padding:14px">Niciun sejur creat.</div>';
    document.getElementById('master-trip-center').innerHTML =
      '<div class="card">Creați primul Master Trip cu „+ Sejur”.</div>';
    document.getElementById('applicant-detail-rail').innerHTML = '';
    return;
  }

  let trip = state.trips.find((t) => t.id === state.selectedTripId);
  if (!trip) {
    trip = state.trips[0];
    state.selectedTripId = trip.id;
  }

  listEl.innerHTML = state.trips
    .map((t) => {
      const m = computeMasterTripMetrics(t, state.applications);
      const active = t.id === trip.id ? 'is-active' : '';
      const pStatus = t.postingStatus || 'Publicat';
      return `
      <button type="button" class="trip-list-item ${active}" data-select-trip="${esc(t.id)}">
        <div class="trip-item-top">
          <span>${esc(t.title)}</span>
          <span class="profit-text">${m.profit >= 0 ? '+' : ''}${fmtMoney(m.profit, t.currency)}</span>
        </div>
        <div class="trip-item-meta">${esc(t.dates)} · ${m.confirmedPax}/${t.maxPax} pax · ${esc(pStatus)}</div>
      </button>`;
    })
    .join('');

  renderMasterTripCenter(trip);
  renderApplicantRightRail(trip);
}

function renderMasterTripCenter(trip) {
  const centerEl = document.getElementById('master-trip-center');
  const m = computeMasterTripMetrics(trip, state.applications);
  const tripApps = state.applications.filter((a) => a.tripId === trip.id);

  if (!tripApps.some((a) => a.id === state.selectedAppId)) {
    state.selectedAppId = tripApps[0]?.id || '';
  }

  let tabBodyHtml = '';
  if (state.activeCenterTab === 'applicants') {
    tabBodyHtml = `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Status</th>
              <th>Pax</th>
              <th>Total</th>
              <th>Etapă</th>
            </tr>
          </thead>
          <tbody>
            ${
              tripApps.length === 0
                ? '<tr><td colspan="5" class="muted">Niciun aplicant. Click „+ Aplică”.</td></tr>'
                : tripApps
                    .map((a) => {
                      const cust = getCustomer(a.customerId);
                      const pax = Number(a.pax || 1);
                      const total = pax * Number(trip.pricePerPax || 0);
                      const selectedCls = a.id === state.selectedAppId ? 'is-selected' : '';
                      return `
                      <tr class="${selectedCls}" data-select-app="${esc(a.id)}">
                        <td><strong>${esc(cust.name)}</strong><div class="muted small">${esc(cust.channel)}</div></td>
                        <td>${qualDotHtml(a.qualificationStatus, a.qualificationReasons)}</td>
                        <td>${pax}</td>
                        <td><strong>${fmtMoney(total, trip.currency)}</strong></td>
                        <td>
                          <select class="inline-select" data-app-stage="${esc(a.id)}" aria-label="Etapă ${esc(cust.name)}">
                            ${APPLICATION_STAGES.map(
                              (s) => `<option value="${s}" ${a.stage === s ? 'selected' : ''}>${s}</option>`
                            ).join('')}
                          </select>
                        </td>
                      </tr>`;
                    })
                    .join('')
            }
          </tbody>
        </table>
      </div>`;
  } else if (state.activeCenterTab === 'rooms') {
    const stays =
      Array.isArray(trip.stays) && trip.stays.length > 0
        ? trip.stays
        : [{ id: `stay-${trip.id}`, name: trip.destination, nights: 1, doubleRooms: 4, singleRooms: 1 }];
    let activeStay = stays.find((s) => s.id === state.selectedStayId);
    if (!activeStay) {
      activeStay = stays[0];
      state.selectedStayId = activeStay.id;
    }

    const roomSummary = analyzeRooming(tripApps, state.customers, activeStay);
    const roomCodes = ['Neasignat', 'Cam. 1', 'Cam. 2', 'Cam. 3', 'Cam. 4', 'Cam. 5', 'Cam. 6', 'Cam. 7', 'Cam. 8'];
    const isFirstStay = stays[0].id === activeStay.id;

    tabBodyHtml = `
      <div class="card">
        <div class="master-header" style="margin-bottom:10px">
          <div class="header-actions">
            ${stays
              .map(
                (s) =>
                  `<button type="button" class="btn btn-sm ${s.id === activeStay.id ? 'btn-primary' : 'btn-secondary'}" data-select-stay="${esc(s.id)}">${esc(s.name)} (${s.nights}n)</button>`
              )
              .join('')}
            <button type="button" class="btn btn-ghost btn-sm" id="add-stay-btn">+ Cazare</button>
          </div>
          <div class="header-actions">
            ${!isFirstStay ? '<button type="button" class="btn btn-ghost btn-sm" id="copy-stay1-btn">Copiază din cazarea 1</button>' : ''}
            <button type="button" class="btn btn-secondary btn-sm" id="export-rooming-btn">Export Rooming (Hotel)</button>
          </div>
        </div>

        <div class="metric-strip" style="margin-bottom:12px">
          <div class="metric-item"><span>Double/Twin</span><strong>${roomSummary.usedDouble}/${activeStay.doubleRooms}</strong></div>
          <div class="metric-item"><span>Single</span><strong>${roomSummary.usedSingle}/${activeStay.singleRooms}</strong></div>
          ${
            roomSummary.unpairedShareCount > 0
              ? `<div class="metric-item"><span style="color:var(--amber-text)">Caută coleg(ă)</span><strong>${roomSummary.unpairedShareCount}</strong></div>`
              : ''
          }
          ${
            roomSummary.inventoryWarnings.length > 0
              ? `<div class="metric-item"><strong style="color:var(--danger)">${esc(roomSummary.inventoryWarnings.join(' · '))}</strong></div>`
              : ''
          }
        </div>

        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Pax</th>
                <th>Tip cameră</th>
                <th>Cameră</th>
              </tr>
            </thead>
            <tbody>
              ${
                tripApps.filter((a) => a.stage !== 'Respins').length === 0
                  ? '<tr><td colspan="4" class="muted">Niciun participant activ.</td></tr>'
                  : tripApps
                      .filter((a) => a.stage !== 'Respins')
                      .map((a) => {
                        const cust = getCustomer(a.customerId);
                        const slot = a.roomByStay?.[activeStay.id] || a;
                        const rType = slot.roomType || a.roomType || 'Double';
                        const rCode = slot.roomCode || a.roomCode || 'Neasignat';
                        return `
                        <tr>
                          <td><strong>${esc(cust.name)}</strong></td>
                          <td>${a.pax}</td>
                          <td>
                            <select class="inline-select" data-room-type="${esc(a.id)}">
                              ${ROOM_TYPES.map((rt) => `<option value="${rt}" ${rType === rt ? 'selected' : ''}>${rt}</option>`).join('')}
                            </select>
                          </td>
                          <td>
                            <select class="inline-select" data-room-code="${esc(a.id)}">
                              ${roomCodes.map((rc) => `<option value="${rc}" ${rCode === rc ? 'selected' : ''}>${rc}</option>`).join('')}
                            </select>
                          </td>
                        </tr>`;
                      })
                      .join('')
              }
            </tbody>
          </table>
        </div>
        ${
          roomSummary.rooms.some((r) => r.alert)
            ? `<div class="stack" style="margin-top:10px">${roomSummary.rooms
                .filter((r) => r.alert)
                .map((r) => `<div class="small" style="color:var(--amber-text)"><strong>${esc(r.roomCode)}</strong> (${esc(r.guests.join(' + '))}): ${esc(r.alert)}</div>`)
                .join('')}</div>`
            : ''
        }
      </div>`;
  } else if (state.activeCenterTab === 'posting') {
    const pub = buildPublicTripPostingView(trip, state.applications);
    const questions = pub.customQuestions;
    tabBodyHtml = `
      <div class="card">
        <div class="master-header" style="margin-bottom:12px">
          <div>
            <h2 style="margin:0;font-size:1rem">Anunț Public Sejur (ATS Job Posting)</h2>
            <p class="muted small"> Pagina publică nu expune niciodată costurile furnizorilor sau marja agenției.</p>
          </div>
          <div class="header-actions">
            <select id="posting-status-select" class="inline-select" aria-label="Status anunț">
              ${POSTING_STATUSES.map((st) => `<option value="${st}" ${(trip.postingStatus || 'Publicat') === st ? 'selected' : ''}>${st}</option>`).join('')}
            </select>
            <a href="/?apply=${encodeURIComponent(trip.id)}" class="btn btn-secondary btn-sm">Deschide pagina →</a>
          </div>
        </div>

        <form id="posting-details-form" class="form-stack">
          <div class="field">
            <label for="p-summary">Rezumat public</label>
            <textarea id="p-summary" name="publicSummary" rows="2" class="input">${esc(pub.publicSummary)}</textarea>
          </div>
          <div class="two-col-tight">
            <div class="field">
              <label for="p-inc">Inclus în tarif</label>
              <input id="p-inc" name="includedText" class="input" value="${esc(pub.includedText)}">
            </div>
            <div class="field">
              <label for="p-exc">Neinclus</label>
              <input id="p-exc" name="excludedText" class="input" value="${esc(pub.excludedText)}">
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary btn-sm">Salvează anunțul</button>
            <button type="button" class="btn btn-secondary btn-sm" id="add-question-btn">+ Criteriu calificare (Da/Nu)</button>
          </div>
        </form>

        <hr class="divider">
        <div class="small muted" style="margin-bottom:8px;font-weight:600">Criterii de auto-calificare la înscriere (${questions.length})</div>
        ${
          questions.length === 0
            ? '<p class="muted small">Doar verificare automată de buget și locuri.</p>'
            : `<div class="stack">${questions
                .map(
                  (q) => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg)">
                  <span class="small"><strong>${esc(q.label)}</strong> · Răspuns cerut: <code>${esc(q.requiredAnswer || 'Da')}</code></span>
                  <button type="button" class="btn btn-ghost btn-sm" data-delete-question="${esc(q.id)}">✕</button>
                </div>`
                )
                .join('')}</div>`
        }
      </div>`;
  } else if (state.activeCenterTab === 'docs') {
    const tripDocs = (state.documents || []).filter((d) => d.tripId === trip.id);
    tabBodyHtml = `
      <div class="card">
        <div class="master-header" style="margin-bottom:10px">
          <h2 style="margin:0;font-size:1rem">Documente &amp; Istoric</h2>
          <button type="button" class="btn btn-secondary btn-sm" id="add-doc-btn">+ Document</button>
        </div>
        ${
          tripDocs.length === 0
            ? '<p class="muted small">Niciun document atașat.</p>'
            : `<div class="stack">${tripDocs
                .map(
                  (d) => `
                <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg)">
                  <div>
                    <strong>${esc(d.title)}</strong>
                    <span class="badge">${esc(d.audience || 'Client')}</span>
                    <span class="badge badge-accent">v${d.version || 1}</span>
                    <div class="muted small">${esc(d.kind)} · ${d.sentLog && d.sentLog[0] ? esc(d.sentLog[0]) : 'Netrimis'}</div>
                  </div>
                  <div class="header-actions">
                    <button type="button" class="btn btn-secondary btn-sm" data-doc-bump="${esc(d.id)}">+v</button>
                    <button type="button" class="btn btn-secondary btn-sm" data-doc-sent="${esc(d.id)}">Trimis</button>
                    <button type="button" class="btn btn-ghost btn-sm" data-delete-doc="${esc(d.id)}">✕</button>
                  </div>
                </div>`
                )
                .join('')}</div>`
        }
      </div>`;
  } else if (state.activeCenterTab === 'costs') {
    const tripDeadlines = (state.supplierDeadlines || []).filter((sd) => sd.tripId === trip.id);
    tabBodyHtml = `
      <div class="card">
        <div class="master-header" style="margin-bottom:12px">
          <h2 style="margin:0;font-size:1rem">Costuri &amp; Scadențe Furnizori</h2>
          <div class="header-actions">
            <button type="button" class="btn btn-secondary btn-sm" id="edit-trip-btn">Editează costuri</button>
            <button type="button" class="btn btn-primary btn-sm" id="add-deadline-btn">+ Scadență furnizor</button>
          </div>
        </div>
        <div class="metric-strip" style="margin-bottom:14px">
          <div class="metric-item"><span>Cost/pax</span><strong>${fmtMoney(trip.costPerPax, trip.currency)}</strong></div>
          <div class="metric-item"><span>Preț/pax</span><strong>${fmtMoney(trip.pricePerPax, trip.currency)}</strong></div>
          <div class="metric-item"><span>Cost fix</span><strong>${fmtMoney(trip.fixedCost, trip.currency)}</strong></div>
          <div class="metric-item"><span>Cost total (${m.basisPax} pax)</span><strong>${fmtMoney(m.totalCost, trip.currency)}</strong></div>
          <div class="metric-item is-profit"><span>Profit</span><strong>+${fmtMoney(m.profit, trip.currency)}</strong></div>
        </div>
        <div class="small muted" style="margin-bottom:8px;font-weight:600">Cut-off &amp; Plăți Furnizori (${tripDeadlines.length})</div>
        ${
          tripDeadlines.length === 0
            ? '<p class="muted small">Nicio scadență furnizor adăugată.</p>'
            : `<div class="stack">${tripDeadlines
                .map((sd) => {
                  const st = sd.done ? 'none' : getDueStatus(sd.dueDate);
                  const lbl = getDueLabel(st);
                  return `
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);opacity:${sd.done ? 0.6 : 1}">
                    <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
                      <input type="checkbox" ${sd.done ? 'checked' : ''} data-toggle-deadline="${esc(sd.id)}">
                      <div>
                        <strong>${esc(sd.supplierName)}</strong> · <span class="badge">${esc(sd.kind)}</span>
                        <div class="muted small">
                          Termen: ${esc(sd.dueDate || '-')}
                          ${lbl ? `<span class="badge ${st === 'overdue' ? 'badge-danger' : 'badge-warning'}">${esc(lbl)}</span>` : ''}
                          ${sd.amount ? ` · ${fmtMoney(sd.amount, sd.currency)}` : ''}
                        </div>
                      </div>
                    </label>
                    <button type="button" class="btn btn-ghost btn-sm" data-delete-deadline="${esc(sd.id)}">✕</button>
                  </div>`;
                })
                .join('')}</div>`
        }
      </div>`;
  } else {
    const draftText =
      state.offerDrafts[trip.id] ||
      [
        `PROPUNERE SEJUR — ${trip.title}`,
        `Destinație: ${trip.destination}`,
        `Perioadă: ${trip.dates}`,
        `Stil: ${trip.style || 'Grup mic'}`,
        `Tarif orientativ: ${trip.pricePerPax} ${trip.currency} / persoană [DE CONFIRMAT]`,
        ``,
        `Notă: Locurile (${m.spotsRemaining} disponibile) și tarifele finale se confirmă la înscriere.`,
      ].join('\n');

    tabBodyHtml = `
      <div class="card">
        <div class="master-header" style="margin-bottom:10px">
          <h2 style="margin:0;font-size:1rem">Ofertă Master (WhatsApp / Print PDF)</h2>
          <div class="header-actions no-print">
            <button type="button" class="btn btn-secondary btn-sm" id="trip-ai-draft-btn">Generează cu Gemini AI</button>
            <button type="button" class="btn btn-secondary btn-sm" id="trip-copy-wa-btn">Copiază WhatsApp</button>
            <button type="button" class="btn btn-primary btn-sm" id="trip-print-btn">Print / PDF</button>
          </div>
        </div>
        <textarea id="trip-offer-textarea" rows="10" class="input mono-area no-print">${esc(draftText)}</textarea>
        <div id="trip-ai-feedback" class="feedback-msg no-print" style="margin-top:8px"></div>
        <div class="offer-print-preview">${esc(draftText)}</div>
      </div>`;
  }

  centerEl.innerHTML = `
    <div class="card">
      <div class="master-header">
        <div>
          <h1>${esc(trip.title)}</h1>
          <p class="muted small">${esc(trip.destination)} · ${esc(trip.dates)} · <span class="badge">${esc(trip.postingStatus || 'Publicat')}</span></p>
        </div>
        <div class="header-actions no-print">
          <button type="button" class="btn btn-ghost btn-sm" id="copy-apply-link-btn">Link aplicare</button>
          <button type="button" class="btn btn-secondary btn-sm" id="edit-trip-top-btn">Editează</button>
          <button type="button" class="btn btn-accent btn-sm" id="apply-to-trip-btn">+ Aplică</button>
        </div>
      </div>
      <div class="metric-strip">
        <div class="metric-item"><span>Locuri</span><strong>${m.confirmedPax}/${trip.maxPax} pax</strong></div>
        <div class="metric-item"><span>Preț</span><strong>${fmtMoney(trip.pricePerPax, trip.currency)}/pax</strong></div>
        <div class="metric-item is-profit"><span>Profit</span><strong>${m.profit >= 0 ? '+' : ''}${fmtMoney(m.profit, trip.currency)} (${m.marginPct}%)</strong></div>
      </div>
    </div>

    <div class="sub-tabs no-print">
      <button type="button" class="sub-tab-btn ${state.activeCenterTab === 'applicants' ? 'is-active' : ''}" data-center-tab="applicants">Aplicanți (${tripApps.length})</button>
      <button type="button" class="sub-tab-btn ${state.activeCenterTab === 'rooms' ? 'is-active' : ''}" data-center-tab="rooms">Camere</button>
      <button type="button" class="sub-tab-btn ${state.activeCenterTab === 'posting' ? 'is-active' : ''}" data-center-tab="posting">Anunț Public</button>
      <button type="button" class="sub-tab-btn ${state.activeCenterTab === 'docs' ? 'is-active' : ''}" data-center-tab="docs">Documente (${(state.documents || []).filter((d) => d.tripId === trip.id).length})</button>
      <button type="button" class="sub-tab-btn ${state.activeCenterTab === 'costs' ? 'is-active' : ''}" data-center-tab="costs">Costuri &amp; Furnizori</button>
      <button type="button" class="sub-tab-btn ${state.activeCenterTab === 'offer' ? 'is-active' : ''}" data-center-tab="offer">Ofertă &amp; PDF</button>
    </div>

    ${tabBodyHtml}
  `;
}

function renderApplicantRightRail(trip) {
  const rail = document.getElementById('applicant-detail-rail');
  const app = state.applications.find((a) => a.id === state.selectedAppId && a.tripId === trip.id);
  if (!app) {
    rail.innerHTML = '<div class="muted small">Selectați un aplicant pentru detalii și acțiuni rapide.</div>';
    return;
  }

  const cust = getCustomer(app.customerId);
  const pax = Number(app.pax || 1);
  const total = pax * Number(trip.pricePerPax || 0);
  const cost = pax * Number(trip.costPerPax || 0);
  const profit = total - cost;
  const metrics = computeMasterTripMetrics(trip, state.applications);
  const rendered = renderMessageTemplate(selectedTemplateId, { trip, app, customer: cust, metrics });

  rail.innerHTML = `
    <div class="rail-header" style="padding:0 0 10px">
      <span>Aplicant</span>
      ${qualDotHtml(app.qualificationStatus, app.qualificationReasons)}
    </div>
    <div>
      <strong style="font-size:1.02rem">${esc(cust.name)}</strong>
      <div class="muted small">${esc(cust.channel)} · ${pax} pax · ${fmtMoney(app.budgetPerPax, trip.currency)}/pax</div>
    </div>
    <div class="metric-strip" style="gap:12px">
      <div class="metric-item"><span>Total</span><strong>${fmtMoney(total, trip.currency)}</strong></div>
      <div class="metric-item is-profit" style="margin-left:0"><span>Profit</span><strong>+${fmtMoney(profit, trip.currency)}</strong></div>
    </div>
    <div class="form-actions">
      <button type="button" class="btn btn-primary btn-sm" id="rail-advance-btn">→ Etapă</button>
      <label class="btn btn-secondary btn-sm" style="cursor:pointer">
        <input type="checkbox" id="rail-deposit-toggle" ${app.depositPaid ? 'checked' : ''}> Avans 30%
      </label>
    </div>

    <div class="rail-header" style="padding:10px 0 6px"><span>Șablon mesaj</span></div>
    <select id="rail-tpl-select" class="input" aria-label="Alege șablon mesaj">
      ${MESSAGE_TEMPLATES.map((t) => `<option value="${esc(t.id)}" ${t.id === selectedTemplateId ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}
    </select>
    <textarea id="rail-tpl-body" rows="5" class="input" style="font-size:0.8rem">${esc(rendered.body)}</textarea>
    <div class="form-actions">
      <button type="button" class="btn btn-secondary btn-sm" id="rail-wa-btn">Copiază WhatsApp</button>
      <a class="btn btn-secondary btn-sm" href="mailto:?subject=${encodeURIComponent(rendered.subject)}&body=${encodeURIComponent(rendered.body)}">Email</a>
    </div>

    <div class="rail-header" style="padding:10px 0 6px"><span>Note</span></div>
    <form id="rail-note-form" class="form-actions">
      <input id="rail-note-input" class="input" placeholder="Notă rapidă..." aria-label="Notă rapidă">
    </form>
    <div class="stack">
      ${(app.notes || []).map((n) => `<div class="small" style="border-bottom:1px solid var(--border);padding-bottom:6px">${esc(n)}</div>`).join('')}
    </div>
  `;
}

function renderTasksView() {
  const list = document.getElementById('tasks-list');
  if (state.tasks.length === 0) {
    list.innerHTML = '<div class="card muted small">Nicio sarcină.</div>';
    return;
  }
  list.innerHTML = state.tasks
    .map((t) => {
      const trip = state.trips.find((tr) => tr.id === t.tripId);
      const dueStatus = t.done ? 'none' : getDueStatus(t.dueDate);
      const dueLabel = getDueLabel(dueStatus);
      return `
      <div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:12px;opacity:${t.done ? 0.6 : 1}">
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
          <input type="checkbox" ${t.done ? 'checked' : ''} data-toggle-task="${esc(t.id)}">
          <div>
            <strong>${esc(t.title)}</strong>
            <div class="muted small">
              Scadență: ${esc(t.dueDate || '-')}
              ${dueLabel ? `<span class="badge ${dueStatus === 'overdue' ? 'badge-danger' : 'badge-warning'}">${esc(dueLabel)}</span>` : ''}
              ${trip ? ` · ${esc(trip.title)}` : ''}
            </div>
          </div>
        </label>
        <button type="button" class="btn btn-ghost btn-sm" data-delete-task="${esc(t.id)}">Șterge</button>
      </div>`;
    })
    .join('');
}

function renderCustomersView() {
  const tbody = document.getElementById('customers-tbody');
  tbody.innerHTML = state.customers
    .map((c) => {
      const count = state.applications.filter((a) => a.customerId === c.id).length;
      return `
      <tr>
        <td><strong>${esc(c.name)}</strong></td>
        <td>${esc(c.channel || '-')}</td>
        <td>${count}</td>
        <td class="muted small">${esc(c.note || '-')}</td>
      </tr>`;
    })
    .join('');
}

/* ---------------- EVENTS ---------------- */

document.addEventListener('click', async (e) => {
  const tripBtn = e.target.closest('[data-select-trip]');
  if (tripBtn) {
    state.selectedTripId = tripBtn.dataset.selectTrip;
    saveState();
    renderTripsView();
    return;
  }

  const appRow = e.target.closest('tr[data-select-app]');
  if (appRow && !e.target.closest('select')) {
    state.selectedAppId = appRow.dataset.selectApp;
    saveState();
    renderTripsView();
    return;
  }

  const tabBtn = e.target.closest('[data-center-tab]');
  if (tabBtn) {
    state.activeCenterTab = tabBtn.dataset.centerTab;
    saveState();
    renderTripsView();
    return;
  }

  const stayBtn = e.target.closest('[data-select-stay]');
  if (stayBtn) {
    state.selectedStayId = stayBtn.dataset.selectStay;
    saveState();
    renderTripsView();
    return;
  }

  const btn = e.target.closest('button');
  if (!btn) return;

  if (btn.id === 'new-trip-btn') openTripModal();
  else if (btn.id === 'add-stay-btn') openStayModal();
  else if (btn.id === 'add-question-btn') openQuestionModal();
  else if (btn.id === 'add-deadline-btn') openDeadlineModal();
  else if (btn.id === 'copy-stay1-btn') {
    const trip = state.trips.find((t) => t.id === state.selectedTripId);
    const stay1 = trip?.stays?.[0];
    if (!trip || !stay1 || !state.selectedStayId) return;
    for (const app of state.applications.filter((a) => a.tripId === trip.id)) {
      const src = app.roomByStay?.[stay1.id] || { roomType: app.roomType || 'Double', roomCode: app.roomCode || 'Neasignat' };
      app.roomByStay = app.roomByStay || {};
      app.roomByStay[state.selectedStayId] = { ...src };
    }
    saveState();
    renderTripsView();
    showToast('Alocare copiată din prima cazare.');
  } else if (btn.id === 'edit-trip-top-btn' || btn.id === 'edit-trip-btn') {
    const trip = state.trips.find((t) => t.id === state.selectedTripId);
    if (trip) openTripModal(trip);
  } else if (btn.id === 'apply-to-trip-btn') {
    openApplyModal();
  } else if (btn.id === 'copy-apply-link-btn') {
    const url = `${window.location.origin}/?apply=${encodeURIComponent(state.selectedTripId)}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link de aplicare copiat.');
    } catch {
      showToast(url);
    }
  } else if (btn.id === 'new-task-btn') {
    openTaskModal();
  } else if (btn.id === 'rail-advance-btn') {
    const app = state.applications.find((a) => a.id === state.selectedAppId);
    if (app) {
      const idx = APPLICATION_STAGES.indexOf(app.stage);
      if (idx >= 0 && idx < APPLICATION_STAGES.length - 2) {
        app.stage = APPLICATION_STAGES[idx + 1];
        app.notes.unshift(`Azi · Avansat la ${app.stage}`);
        saveState();
        renderTripsView();
        showToast(`Etapă actualizată: ${app.stage}`);
      }
    }
  } else if (btn.id === 'rail-wa-btn' || btn.id === 'trip-copy-wa-btn') {
    const trip = state.trips.find((t) => t.id === state.selectedTripId);
    if (!trip) return;
    const railBody = document.getElementById('rail-tpl-body')?.value;
    const text =
      (btn.id === 'rail-wa-btn' && railBody) ||
      state.offerDrafts[trip.id] ||
      `Bună ziua! Vă trimit detaliile pentru ${trip.title} (${trip.dates}): ${trip.pricePerPax} ${trip.currency}/persoană [DE CONFIRMAT].`;
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copiat pentru WhatsApp.');
    } catch {
      showToast('Selectați textul manual.');
    }
  } else if (btn.id === 'trip-print-btn') {
    window.print();
  } else if (btn.id === 'trip-ai-draft-btn') {
    const trip = state.trips.find((t) => t.id === state.selectedTripId);
    const fb = document.getElementById('trip-ai-feedback');
    if (!trip || !fb) return;
    fb.className = 'feedback-msg';
    fb.textContent = 'Se generează schița AI...';
    try {
      const res = await fetch('/api/offer-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: trip.destination,
          dates: trip.dates,
          travellersCount: `grup max ${trip.maxPax} persoane`,
          style: trip.style,
          budget: String(trip.pricePerPax),
          currency: trip.currency,
          notes: trip.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        fb.className = 'feedback-msg is-error';
        fb.textContent = data.error;
        return;
      }
      state.offerDrafts[trip.id] = data.draft;
      saveState();
      renderTripsView();
    } catch {
      fb.className = 'feedback-msg is-error';
      fb.textContent = 'Serverul AI nu a răspuns.';
    }
  } else if (btn.id === 'add-doc-btn') {
    openDocModal();
  } else if (btn.id === 'export-rooming-btn') {
    const trip = state.trips.find((t) => t.id === state.selectedTripId);
    if (!trip) return;
    const activeStay = trip.stays?.find((s) => s.id === state.selectedStayId) || trip.stays?.[0] || null;
    const tripApps = state.applications.filter((a) => a.tripId === trip.id);
    const rows = buildHotelRoomingRows(tripApps, state.customers, activeStay);
    if (rows.length === 0) return showToast('Alocați cel puțin o cameră înainte de export.');
    const csv = buildCsv(['cazare', 'camera', 'tip_camera', 'oaspeti', 'pax', 'observatii'], rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rooming-${trip.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Rooming List exportat (fără prețuri interne).');
  } else if (btn.dataset.docBump) {
    const doc = (state.documents || []).find((d) => d.id === btn.dataset.docBump);
    if (doc) {
      doc.version = Number(doc.version || 1) + 1;
      doc.updatedAt = new Date().toISOString().slice(0, 10);
      saveState();
      renderTripsView();
      showToast(`Versiune nouă: v${doc.version}`);
    }
  } else if (btn.dataset.docSent) {
    const doc = (state.documents || []).find((d) => d.id === btn.dataset.docSent);
    if (doc) {
      doc.sentLog = doc.sentLog || [];
      const dateStr = new Date().toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' });
      doc.sentLog.unshift(`${dateStr} · Trimis (${doc.audience || 'Client'} v${doc.version || 1})`);
      saveState();
      renderTripsView();
      showToast('Marcat ca trimis.');
    }
  } else if (btn.dataset.deleteDoc) {
    state.documents = (state.documents || []).filter((d) => d.id !== btn.dataset.deleteDoc);
    saveState();
    renderTripsView();
    showToast('Document șters.');
  } else if (btn.dataset.deleteQuestion) {
    const trip = state.trips.find((t) => t.id === state.selectedTripId);
    if (trip && Array.isArray(trip.customQuestions)) {
      trip.customQuestions = trip.customQuestions.filter((q) => q.id !== btn.dataset.deleteQuestion);
      saveState();
      renderTripsView();
    }
  } else if (btn.dataset.deleteDeadline) {
    state.supplierDeadlines = (state.supplierDeadlines || []).filter((sd) => sd.id !== btn.dataset.deleteDeadline);
    saveState();
    renderTripsView();
  } else if (btn.dataset.deleteTask) {
    state.tasks = state.tasks.filter((t) => t.id !== btn.dataset.deleteTask);
    saveState();
    renderTasksView();
  } else if (btn.dataset.exportCsv) {
    exportDatasetCsv(btn.dataset.exportCsv);
  }
});

document.addEventListener('change', (e) => {
  if (e.target.matches('select[data-app-stage]')) {
    const app = state.applications.find((a) => a.id === e.target.dataset.appStage);
    if (app) {
      app.stage = e.target.value;
      app.notes.unshift(`Azi · Mutat în ${app.stage}`);
      saveState();
      renderTripsView();
      showToast(`Status: ${app.stage}`);
    }
  } else if (e.target.id === 'posting-status-select') {
    const trip = state.trips.find((t) => t.id === state.selectedTripId);
    if (trip) {
      trip.postingStatus = e.target.value;
      saveState();
      renderTripsView();
      showToast(`Status anunț: ${trip.postingStatus}`);
    }
  } else if (e.target.id === 'rail-deposit-toggle') {
    const app = state.applications.find((a) => a.id === state.selectedAppId);
    if (app) {
      app.depositPaid = e.target.checked;
      if (app.depositPaid && app.stage === 'Ofertă trimisă') {
        app.stage = 'Avans achitat';
      }
      app.notes.unshift(`Azi · Avans 30%: ${app.depositPaid ? 'Achitat' : 'Neachitat'}`);
      saveState();
      renderTripsView();
      showToast(app.depositPaid ? 'Avans 30% marcat achitat.' : 'Avans demarcat.');
    }
  } else if (e.target.id === 'rail-tpl-select') {
    selectedTemplateId = e.target.value;
    renderTripsView();
  } else if (e.target.matches('select[data-room-type]')) {
    const app = state.applications.find((a) => a.id === e.target.dataset.roomType);
    if (app) {
      if (state.selectedStayId) {
        app.roomByStay = app.roomByStay || {};
        const prev = app.roomByStay[state.selectedStayId] || { roomCode: app.roomCode || 'Neasignat' };
        app.roomByStay[state.selectedStayId] = { ...prev, roomType: e.target.value };
      }
      app.roomType = e.target.value;
      saveState();
      renderTripsView();
    }
  } else if (e.target.matches('select[data-room-code]')) {
    const app = state.applications.find((a) => a.id === e.target.dataset.roomCode);
    if (app) {
      if (state.selectedStayId) {
        app.roomByStay = app.roomByStay || {};
        const prev = app.roomByStay[state.selectedStayId] || { roomType: app.roomType || 'Double' };
        app.roomByStay[state.selectedStayId] = { ...prev, roomCode: e.target.value };
      }
      app.roomCode = e.target.value;
      saveState();
      renderTripsView();
    }
  } else if (e.target.matches('input[type="checkbox"][data-toggle-deadline]')) {
    const sd = (state.supplierDeadlines || []).find((x) => x.id === e.target.dataset.toggleDeadline);
    if (sd) {
      sd.done = e.target.checked;
      saveState();
      renderTripsView();
    }
  } else if (e.target.matches('input[type="checkbox"][data-toggle-task]')) {
    const t = state.tasks.find((x) => x.id === e.target.dataset.toggleTask);
    if (t) {
      t.done = e.target.checked;
      saveState();
      renderTasksView();
    }
  }
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'trip-offer-textarea' && state.selectedTripId) {
    state.offerDrafts[state.selectedTripId] = e.target.value;
    saveState();
  }
});

document.addEventListener('submit', (e) => {
  if (e.target.id === 'rail-note-form') {
    e.preventDefault();
    const input = document.getElementById('rail-note-input');
    const app = state.applications.find((a) => a.id === state.selectedAppId);
    if (app && input?.value.trim()) {
      app.notes.unshift(`Azi · ${input.value.trim()}`);
      saveState();
      renderTripsView();
      showToast('Notă adăugată.');
    }
  } else if (e.target.id === 'posting-details-form') {
    e.preventDefault();
    const trip = state.trips.find((t) => t.id === state.selectedTripId);
    if (!trip) return;
    const fd = Object.fromEntries(new FormData(e.target).entries());
    trip.publicSummary = (fd.publicSummary || '').trim();
    trip.includedText = (fd.includedText || '').trim();
    trip.excludedText = (fd.excludedText || '').trim();
    saveState();
    renderTripsView();
    showToast('Anunțul public a fost salvat.');
  }
});

/* ---------------- MODALS ---------------- */

const modalEl = document.getElementById('app-modal');
const modalTitleEl = document.getElementById('modal-title');
const modalFieldsEl = document.getElementById('modal-fields');
const modalErrorEl = document.getElementById('modal-error');
const modalFormEl = document.getElementById('modal-form');

function closeModal() {
  if (!modalEl) return;
  modalEl.hidden = true;
  activeModal = null;
  modalErrorEl.hidden = true;
}

document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
document.getElementById('modal-cancel-btn')?.addEventListener('click', closeModal);
modalEl?.addEventListener('click', (e) => {
  if (e.target === modalEl) closeModal();
});

function openTripModal(existing = null) {
  activeModal = { type: 'trip', id: existing?.id || null };
  modalTitleEl.textContent = existing ? 'Editează Master Trip' : 'Master Trip nou';
  modalFieldsEl.innerHTML = `
    <div class="field"><label for="t-title">Titlu sejur *</label><input id="t-title" name="title" class="input" required value="${esc(existing?.title || '')}"></div>
    <div class="field"><label for="t-dest">Destinație *</label><input id="t-dest" name="destination" class="input" required value="${esc(existing?.destination || '')}"></div>
    <div class="two-col-tight">
      <div class="field"><label for="t-dates">Perioadă</label><input id="t-dates" name="dates" class="input" placeholder="2027-06-15 → 2027-06-22" value="${esc(existing?.dates || '')}"></div>
      <div class="field"><label for="t-pax">Locuri max</label><input id="t-pax" name="maxPax" type="number" min="1" class="input" value="${esc(existing?.maxPax ?? 10)}"></div>
    </div>
    <div class="two-col-tight">
      <div class="field"><label for="t-cost">Cost furnizor / pax</label><input id="t-cost" name="costPerPax" type="number" min="0" class="input" value="${esc(existing?.costPerPax ?? 600)}"></div>
      <div class="field"><label for="t-price">Preț vânzare / pax</label><input id="t-price" name="pricePerPax" type="number" min="0" class="input" value="${esc(existing?.pricePerPax ?? 800)}"></div>
    </div>
    <div class="two-col-tight">
      <div class="field"><label for="t-fixed">Cost fix grup</label><input id="t-fixed" name="fixedCost" type="number" min="0" class="input" value="${esc(existing?.fixedCost ?? 0)}"></div>
      <div class="field"><label for="t-cur">Monedă</label><select id="t-cur" name="currency" class="input">${VALID_CURRENCIES.map((c) => `<option value="${c}" ${existing?.currency === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
    </div>
    <div class="field"><label for="t-notes">Note</label><textarea id="t-notes" name="notes" rows="2" class="input">${esc(existing?.notes || '')}</textarea></div>
  `;
  modalEl.hidden = false;
}

function openApplyModal() {
  const trip = state.trips.find((t) => t.id === state.selectedTripId);
  if (!trip) return;
  activeModal = { type: 'apply', tripId: trip.id };
  modalTitleEl.textContent = `Aplică la: ${trip.title}`;
  const questions = Array.isArray(trip.customQuestions) ? trip.customQuestions : [];
  modalFieldsEl.innerHTML = `
    <p class="muted small">Simulează aplicarea unui client. Sistemul califică automat bugetul (${trip.pricePerPax} ${trip.currency}/pax), locurile și criteriile.</p>
    <div class="field"><label for="a-name">Nume client (sintetic) *</label><input id="a-name" name="name" class="input" required placeholder="ex. Andrei Demo"></div>
    <div class="two-col-tight">
      <div class="field"><label for="a-pax">Nr. persoane</label><input id="a-pax" name="pax" type="number" min="1" class="input" value="2"></div>
      <div class="field"><label for="a-budget">Buget / pax (${esc(trip.currency)})</label><input id="a-budget" name="budgetPerPax" type="number" min="0" class="input" value="${esc(trip.pricePerPax)}"></div>
    </div>
    <div class="two-col-tight">
      <div class="field"><label for="a-channel">Canal</label><select id="a-channel" name="channel" class="input"><option>Formular Sejur</option><option>WhatsApp</option><option>Instagram</option><option>Email</option></select></div>
      <div class="field"><label for="a-room">Preferință cameră</label><select id="a-room" name="roomType" class="input">${ROOM_TYPES.map((rt) => `<option value="${rt}">${rt}</option>`).join('')}</select></div>
    </div>
    ${questions
      .map(
        (q) => `
      <div class="field">
        <label for="aq-${esc(q.id)}">${esc(q.label)}</label>
        <select id="aq-${esc(q.id)}" name="q_${esc(q.id)}" class="input">
          <option value="Da">Da</option>
          <option value="Nu">Nu</option>
        </select>
      </div>`
      )
      .join('')}
  `;
  modalEl.hidden = false;
}

function openQuestionModal() {
  activeModal = { type: 'question', tripId: state.selectedTripId };
  modalTitleEl.textContent = 'Criteriu nou de calificare';
  modalFieldsEl.innerHTML = `
    <div class="field"><label for="q-lbl">Întrebare Da/Nu pentru aplicant *</label><input id="q-lbl" name="label" class="input" required placeholder="ex. Experiență drumeții montane?"></div>
    <div class="field"><label for="q-req">Răspuns cerut pentru calificare automată</label><select id="q-req" name="requiredAnswer" class="input"><option value="Da">Da</option><option value="Nu">Nu</option></select></div>
  `;
  modalEl.hidden = false;
}

function openDeadlineModal() {
  const trip = state.trips.find((t) => t.id === state.selectedTripId);
  activeModal = { type: 'deadline', tripId: state.selectedTripId };
  modalTitleEl.textContent = 'Scadență furnizor nouă';
  modalFieldsEl.innerHTML = `
    <div class="field"><label for="sd-sup">Furnizor / Hotel *</label><input id="sd-sup" name="supplierName" class="input" required placeholder="ex. Basecamp Hotel"></div>
    <div class="two-col-tight">
      <div class="field"><label for="sd-kind">Tip scadență</label><select id="sd-kind" name="kind" class="input">${DEADLINE_KINDS.map((k) => `<option value="${k}">${k}</option>`).join('')}</select></div>
      <div class="field"><label for="sd-due">Dată limită *</label><input id="sd-due" name="dueDate" type="date" class="input" required></div>
    </div>
    <div class="two-col-tight">
      <div class="field"><label for="sd-amt">Sumă (opțional)</label><input id="sd-amt" name="amount" type="number" min="0" class="input" value="0"></div>
      <div class="field"><label for="sd-cur">Monedă</label><select id="sd-cur" name="currency" class="input">${VALID_CURRENCIES.map((c) => `<option value="${c}" ${trip?.currency === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
    </div>
  `;
  modalEl.hidden = false;
}

function openStayModal() {
  activeModal = { type: 'stay', tripId: state.selectedTripId };
  modalTitleEl.textContent = 'Cazare nouă în circuit';
  modalFieldsEl.innerHTML = `
    <div class="field"><label for="s-name">Hotel / Cazare *</label><input id="s-name" name="name" class="input" required placeholder="ex. Hoi An Resort"></div>
    <div class="two-col-tight">
      <div class="field"><label for="s-nights">Nopți</label><input id="s-nights" name="nights" type="number" min="1" class="input" value="3"></div>
      <div class="field"><label for="s-double">Camere Double/Twin</label><input id="s-double" name="doubleRooms" type="number" min="0" class="input" value="5"></div>
    </div>
    <div class="field"><label for="s-single">Camere Single</label><input id="s-single" name="singleRooms" type="number" min="0" class="input" value="2"></div>
  `;
  modalEl.hidden = false;
}

function openDocModal() {
  activeModal = { type: 'doc', tripId: state.selectedTripId };
  modalTitleEl.textContent = 'Document nou pentru sejur';
  modalFieldsEl.innerHTML = `
    <div class="field"><label for="d-title">Nume document *</label><input id="d-title" name="title" class="input" required placeholder="ex. Itinerariu final.pdf"></div>
    <div class="two-col-tight">
      <div class="field"><label for="d-kind">Tip</label><select id="d-kind" name="kind" class="input"><option>Itinerariu</option><option>Rooming</option><option>Ghid călător</option><option>Contract</option></select></div>
      <div class="field"><label for="d-audience">Destinatar</label><select id="d-audience" name="audience" class="input"><option>Client</option><option>Furnizor</option></select></div>
    </div>
  `;
  modalEl.hidden = false;
}

function openTaskModal() {
  activeModal = { type: 'task' };
  modalTitleEl.textContent = 'Sarcină nouă';
  modalFieldsEl.innerHTML = `
    <div class="field"><label for="tsk-title">Titlu *</label><input id="tsk-title" name="title" class="input" required></div>
    <div class="field"><label for="tsk-due">Scadență</label><input id="tsk-due" name="dueDate" type="date" class="input"></div>
    <div class="field"><label for="tsk-trip">Sejur</label><select id="tsk-trip" name="tripId" class="input">${state.trips.map((t) => `<option value="${esc(t.id)}">${esc(t.title)}</option>`).join('')}</select></div>
  `;
  modalEl.hidden = false;
}

modalFormEl?.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!activeModal) return;
  const data = Object.fromEntries(new FormData(modalFormEl).entries());
  const showError = (msg) => {
    modalErrorEl.textContent = msg;
    modalErrorEl.hidden = false;
  };

  if (activeModal.type === 'trip') {
    if (!data.title?.trim() || !data.destination?.trim()) return showError('Titlul și destinația sunt obligatorii.');
    const payload = {
      title: data.title.trim(),
      destination: data.destination.trim(),
      dates: data.dates.trim(),
      maxPax: Number(data.maxPax || 10),
      costPerPax: Number(data.costPerPax || 0),
      pricePerPax: Number(data.pricePerPax || 0),
      fixedCost: Number(data.fixedCost || 0),
      currency: data.currency || 'EUR',
      notes: data.notes.trim(),
    };
    if (activeModal.id) {
      Object.assign(state.trips.find((t) => t.id === activeModal.id), payload);
    } else {
      const id = uid('trip');
      state.trips.unshift({ id, postingStatus: 'Publicat', customQuestions: [], stays: [], ...payload });
      state.selectedTripId = id;
    }
    showToast('Sejur salvat.');
  } else if (activeModal.type === 'apply') {
    if (!data.name?.trim()) return showError('Numele clientului este obligatoriu.');
    const trip = state.trips.find((t) => t.id === activeModal.tripId);
    const metrics = computeMasterTripMetrics(trip, state.applications);
    const cust = { id: uid('cust'), name: data.name.trim(), channel: data.channel, note: 'Aplicant sejur' };
    state.customers.unshift(cust);

    const answers = {};
    for (const q of trip.customQuestions || []) {
      answers[q.id] = data[`q_${q.id}`] || 'Da';
    }

    const qual = autoQualifyApplication(
      trip,
      { pax: Number(data.pax || 1), budgetPerPax: Number(data.budgetPerPax || 0), answers },
      metrics.confirmedPax
    );
    const appId = uid('app');
    state.applications.unshift({
      id: appId,
      tripId: trip.id,
      customerId: cust.id,
      pax: Number(data.pax || 1),
      budgetPerPax: Number(data.budgetPerPax || 0),
      depositPaid: false,
      roomType: data.roomType || 'Double',
      roomCode: 'Neasignat',
      stage: qual.suggestedStage,
      qualificationStatus: qual.status,
      qualificationReasons: qual.reasons,
      appliedAt: new Date().toISOString().slice(0, 10),
      notes: [`Azi · ${qual.status}: ${qual.reasons.join('; ')}`],
    });
    state.selectedAppId = appId;
    showToast(`Aplicant adăugat: ${qual.status}`);
  } else if (activeModal.type === 'question') {
    if (!data.label?.trim()) return showError('Întrebarea este obligatorie.');
    const trip = state.trips.find((t) => t.id === activeModal.tripId);
    if (trip) {
      trip.customQuestions = Array.isArray(trip.customQuestions) ? trip.customQuestions : [];
      trip.customQuestions.push({
        id: uid('q'),
        label: data.label.trim(),
        requiredAnswer: data.requiredAnswer || 'Da',
      });
      showToast('Criteriu adăugat.');
    }
  } else if (activeModal.type === 'deadline') {
    if (!data.supplierName?.trim() || !data.dueDate) return showError('Furnizorul și data sunt obligatorii.');
    state.supplierDeadlines = state.supplierDeadlines || [];
    state.supplierDeadlines.unshift({
      id: uid('sd'),
      tripId: activeModal.tripId,
      supplierName: data.supplierName.trim(),
      kind: data.kind || 'Avans furnizor',
      dueDate: data.dueDate,
      amount: Number(data.amount || 0),
      currency: data.currency || 'EUR',
      done: false,
    });
    showToast('Scadență furnizor adăugată.');
  } else if (activeModal.type === 'stay') {
    if (!data.name?.trim()) return showError('Numele cazării este obligatoriu.');
    const trip = state.trips.find((t) => t.id === activeModal.tripId);
    if (trip) {
      trip.stays = trip.stays || [];
      const stayId = uid('stay');
      trip.stays.push({
        id: stayId,
        name: data.name.trim(),
        nights: Number(data.nights || 1),
        doubleRooms: Number(data.doubleRooms || 0),
        singleRooms: Number(data.singleRooms || 0),
      });
      state.selectedStayId = stayId;
      showToast('Cazare adăugată.');
    }
  } else if (activeModal.type === 'doc') {
    if (!data.title?.trim()) return showError('Numele documentului este obligatoriu.');
    state.documents = state.documents || [];
    state.documents.unshift({
      id: uid('doc'),
      tripId: activeModal.tripId,
      title: data.title.trim(),
      kind: data.kind || 'Itinerariu',
      audience: data.audience || 'Client',
      version: 1,
      sentLog: [],
      updatedAt: new Date().toISOString().slice(0, 10),
    });
    showToast('Document adăugat.');
  } else if (activeModal.type === 'task') {
    if (!data.title?.trim()) return showError('Titlul este obligatoriu.');
    state.tasks.unshift({ id: uid('tsk'), title: data.title.trim(), dueDate: data.dueDate, done: false, tripId: data.tripId });
    showToast('Sarcină adăugată.');
  }

  saveState();
  closeModal();
  renderAll();
});

/* ---------------- CSV & EXCEL SYNC ---------------- */

function exportDatasetCsv(kind) {
  let headers = [];
  let rows = [];
  if (kind === 'trips') {
    headers = ['titlu', 'destinatie', 'perioada', 'locuri_max', 'cost_pax', 'pret_pax', 'moneda'];
    rows = state.trips.map((t) => ({
      titlu: t.title,
      destinatie: t.destination,
      perioada: t.dates,
      locuri_max: t.maxPax,
      cost_pax: t.costPerPax,
      pret_pax: t.pricePerPax,
      moneda: t.currency,
    }));
  } else if (kind === 'applications') {
    headers = ['sejur', 'client', 'pax', 'buget_pax', 'calificare', 'etapa', 'tip_camera', 'camera'];
    rows = state.applications.map((a) => ({
      sejur: state.trips.find((t) => t.id === a.tripId)?.title || '',
      client: getCustomer(a.customerId).name,
      pax: a.pax,
      buget_pax: a.budgetPerPax,
      calificare: a.qualificationStatus,
      etapa: a.stage,
      tip_camera: a.roomType || 'Double',
      camera: a.roomCode || 'Neasignat',
    }));
  } else {
    headers = ['nume', 'canal', 'nota'];
    rows = state.customers.map((c) => ({ nume: c.name, canal: c.channel, nota: c.note }));
  }
  const csv = buildCsv(headers, rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${kind}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function previewCsv(text) {
  const parsed = parseCsvText(text);
  stagedCsvRows = validateEnquiryImportRows(parsed.rows, [], state.customers);
  const validCount = stagedCsvRows.filter((r) => r.valid).length;
  document.getElementById('csv-preview-card').hidden = false;
  document.getElementById('csv-preview-summary').textContent = `${stagedCsvRows.length} rânduri · ${validCount} valide`;
  document.getElementById('csv-commit-btn').disabled = validCount === 0;
  document.getElementById('csv-preview-tbody').innerHTML = stagedCsvRows
    .map(
      (r) => `
    <tr>
      <td>${r.line}</td>
      <td>${esc(r.data.customerName || '-')}</td>
      <td>${esc(r.data.destination || '-')}</td>
      <td>${r.data.budget ? fmtMoney(r.data.budget, r.data.currency) : '-'}</td>
      <td><span class="badge ${r.valid ? 'badge-profit' : 'badge-danger'}">${r.valid ? 'Valid' : esc(r.errors.join('; '))}</span></td>
    </tr>`
    )
    .join('');
}

document.getElementById('csv-file-input')?.addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (f) previewCsv(await f.text());
});

document.getElementById('csv-sample-btn')?.addEventListener('click', () => {
  previewCsv(
    [
      'client,destinatie,data_plecare,buget,moneda',
      'Ioana Demo,Svalbard,2027-03-14,1900,EUR',
      ',Roma,14-03-2027,-10,GBP',
    ].join('\n')
  );
});

document.getElementById('csv-commit-btn')?.addEventListener('click', () => {
  const trip = state.trips[0];
  if (!trip) return;
  let added = 0;
  for (const r of stagedCsvRows) {
    if (!r.valid) continue;
    const cust = { id: uid('cust'), name: r.data.customerName, channel: 'Import CSV', note: '' };
    state.customers.unshift(cust);
    const qual = autoQualifyApplication(trip, { pax: 1, budgetPerPax: r.data.budget }, 0);
    state.applications.unshift({
      id: uid('app'),
      tripId: trip.id,
      customerId: cust.id,
      pax: 1,
      budgetPerPax: r.data.budget,
      stage: qual.suggestedStage,
      qualificationStatus: qual.status,
      qualificationReasons: qual.reasons,
      appliedAt: new Date().toISOString().slice(0, 10),
      notes: ['Importat din CSV'],
    });
    added += 1;
  }
  saveState();
  renderAll();
  showToast(`${added} aplicanți importați.`);
  document.getElementById('csv-commit-btn').disabled = true;
});

function buildApplicationsCsvString() {
  const headers = ['sejur', 'client', 'pax', 'buget_pax', 'calificare', 'etapa', 'tip_camera', 'camera'];
  const rows = state.applications.map((a) => ({
    sejur: state.trips.find((t) => t.id === a.tripId)?.title || '',
    client: getCustomer(a.customerId).name,
    pax: a.pax,
    buget_pax: a.budgetPerPax,
    calificare: a.qualificationStatus,
    etapa: a.stage,
    tip_camera: a.roomType || 'Double',
    camera: a.roomCode || 'Neasignat',
  }));
  return buildCsv(headers, rows);
}

async function writeLinkedExcelFile() {
  if (!linkedExcelHandle) return;
  const writable = await linkedExcelHandle.createWritable();
  await writable.write(buildApplicationsCsvString());
  await writable.close();
  const statusEl = document.getElementById('excel-sync-status');
  if (statusEl) {
    statusEl.textContent = `Sincronizat la ${new Date().toLocaleTimeString('ro-RO')}`;
  }
}

document.getElementById('link-excel-btn')?.addEventListener('click', async () => {
  if (typeof window.showSaveFilePicker !== 'function') {
    exportDatasetCsv('applications');
    showToast('Browserul nu suportă File System Access; s-a descărcat CSV.');
    return;
  }
  try {
    linkedExcelHandle = await window.showSaveFilePicker({
      suggestedName: 'garlic-trips-live.csv',
      types: [{ description: 'Excel CSV', accept: { 'text/csv': ['.csv'] } }],
    });
    await writeLinkedExcelFile();
    document.getElementById('sync-excel-btn').disabled = false;
    document.getElementById('pull-excel-btn').disabled = false;
    showToast('Fișier Excel (.csv) legat și sincronizat.');
  } catch {
    showToast('Legare anulată.');
  }
});

document.getElementById('sync-excel-btn')?.addEventListener('click', async () => {
  try {
    await writeLinkedExcelFile();
    showToast('Excel (.csv) actualizat.');
  } catch {
    showToast('Eroare la scrierea fișierului Excel.');
  }
});

document.getElementById('pull-excel-btn')?.addEventListener('click', async () => {
  if (!linkedExcelHandle) return;
  try {
    const file = await linkedExcelHandle.getFile();
    const { rows } = parseCsvText(await file.text());
    let updated = 0;
    let added = 0;

    for (const r of rows) {
      const clientName = (r.client || '').trim();
      const tripTitle = (r.sejur || '').trim();
      if (!clientName) continue;

      const trip = state.trips.find((t) => t.title.toLowerCase() === tripTitle.toLowerCase()) || state.trips[0];
      if (!trip) continue;

      let cust = state.customers.find((c) => c.name.trim().toLowerCase() === clientName.toLowerCase());
      if (!cust) {
        cust = { id: uid('cust'), name: clientName, channel: 'Excel Sync', note: '' };
        state.customers.unshift(cust);
      }

      const existingApp = state.applications.find((a) => a.tripId === trip.id && a.customerId === cust.id);
      if (existingApp) {
        if (r.etapa && APPLICATION_STAGES.includes(r.etapa)) existingApp.stage = r.etapa;
        if (r.tip_camera && ROOM_TYPES.includes(r.tip_camera)) existingApp.roomType = r.tip_camera;
        if (r.camera) existingApp.roomCode = r.camera;
        updated += 1;
      } else {
        const pax = Math.max(1, Number(r.pax || 1));
        const budgetPerPax = Number(r.buget_pax || trip.pricePerPax || 0);
        const qual = autoQualifyApplication(trip, { pax, budgetPerPax }, 0);
        state.applications.unshift({
          id: uid('app'),
          tripId: trip.id,
          customerId: cust.id,
          pax,
          budgetPerPax,
          roomType: ROOM_TYPES.includes(r.tip_camera) ? r.tip_camera : 'Double',
          roomCode: r.camera || 'Neasignat',
          stage: APPLICATION_STAGES.includes(r.etapa) ? r.etapa : qual.suggestedStage,
          qualificationStatus: qual.status,
          qualificationReasons: qual.reasons,
          appliedAt: new Date().toISOString().slice(0, 10),
          notes: ['Sincronizat din Excel (.csv)'],
        });
        added += 1;
      }
    }

    saveState();
    renderAll();
    document.getElementById('excel-sync-status').textContent = `Citit din Excel: +${added} noi, ${updated} actualizate`;
    showToast(`Sincronizat din Excel (+${added}, ${updated} actualizate).`);
  } catch {
    showToast('Eroare la citirea fișierului Excel.');
  }
});

document.getElementById('backup-json-btn')?.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `garlic-demo-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('restore-json-input')?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed.trips) || !Array.isArray(parsed.applications)) {
      return showToast('Fișier JSON invalid.');
    }
    state = parsed;
    saveState();
    renderAll();
    showToast('Backup restaurat.');
  } catch {
    showToast('Eroare la citirea JSON.');
  }
});

document.getElementById('reset-demo-btn')?.addEventListener('click', () => {
  state = createSeedState();
  saveState();
  renderAll();
  showToast('Date demo Garlic Trips resetate.');
});

/* ---------------- PUBLIC BOARD & APPLY VIEWS ---------------- */

function renderPublicBoardPage() {
  const publicTrips = state.trips
    .map((t) => buildPublicTripPostingView(t, state.applications))
    .filter((p) => p.postingStatus === 'Publicat' || p.postingStatus === 'Locuri epuizate');

  document.body.innerHTML = `
    <header class="topbar">
      <div class="topbar-left">
        <div class="brand"><span class="brand-dot"></span><span>Garlic Trips · Sejururi de Grup</span></div>
      </div>
      <div class="topbar-right">
        <a href="/" class="btn btn-secondary btn-sm">Workspace Agenție →</a>
      </div>
    </header>
    <main class="page-container" style="max-width:920px">
      <div class="page-header">
        <div>
          <h1>Aventuri de grup deschise</h1>
          <p class="muted small">Alege sejurul și aplică direct — locurile sunt limitate.</p>
        </div>
      </div>
      <div class="stack">
        ${
          publicTrips.length === 0
            ? '<div class="card muted">Niciun sejur publicat în acest moment.</div>'
            : publicTrips
                .map(
                  (p) => `
                <div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap">
                  <div style="flex:1;min-width:240px">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                      <strong style="font-size:1.1rem">${esc(p.title)}</strong>
                      <span class="badge ${p.spotsRemaining > 0 ? 'badge-profit' : 'badge-warning'}">${p.spotsRemaining > 0 ? `${p.spotsRemaining} locuri libere` : 'Locuri epuizate'}</span>
                    </div>
                    <div class="muted small" style="margin-bottom:6px">${esc(p.destination)} · ${esc(p.dates)}</div>
                    <div class="small">${esc(p.publicSummary)}</div>
                  </div>
                  <div style="text-align:right">
                    <div style="font-size:1.15rem;font-weight:700;margin-bottom:8px">${fmtMoney(p.pricePerPax, p.currency)} <span class="muted small">/ pers.</span></div>
                    <a href="/?apply=${encodeURIComponent(p.id)}" class="btn btn-accent btn-sm">Aplică la sejur →</a>
                  </div>
                </div>`
                )
                .join('')
        }
      </div>
    </main>
  `;
}

function renderPublicApplyPage(tripId) {
  const trip = state.trips.find((t) => t.id === tripId) || state.trips[0];
  if (!trip) return renderAll();
  const pub = buildPublicTripPostingView(trip, state.applications);
  const m = computeMasterTripMetrics(trip, state.applications);

  document.body.innerHTML = `
    <header class="topbar">
      <div class="topbar-left">
        <div class="brand"><span class="brand-dot"></span><span>Garlic Trips · Înscriere Sejur</span></div>
      </div>
      <div class="topbar-right">
        <a href="/?board=1" class="btn btn-secondary btn-sm">← Toate sejururile</a>
        <a href="/" class="btn btn-secondary btn-sm">Workspace Agenție</a>
      </div>
    </header>
    <main class="page-container" style="max-width:600px">
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:6px">
          <h1 style="margin:0;font-size:1.35rem">${esc(pub.title)}</h1>
          <span class="badge ${pub.spotsRemaining > 0 ? 'badge-profit' : 'badge-warning'}">${pub.spotsRemaining} locuri libere</span>
        </div>
        <p class="muted small" style="margin-bottom:10px">${esc(pub.destination)} · ${esc(pub.dates)}</p>
        <p class="small" style="margin:0 0 12px">${esc(pub.publicSummary)}</p>
        <div class="metric-strip" style="margin-bottom:14px">
          <div class="metric-item"><span>Tarif orientativ</span><strong>${fmtMoney(pub.pricePerPax, pub.currency)}/pers.</strong></div>
          <div class="metric-item"><span>Inclus</span><strong>${esc(pub.includedText)}</strong></div>
        </div>
        <form id="public-apply-form" class="form-stack">
          <div class="field"><label for="pa-name">Nume / Etichetă (demo) *</label><input id="pa-name" name="name" class="input" required placeholder="ex. Andrei Demo"></div>
          <div class="two-col-tight">
            <div class="field"><label for="pa-pax">Nr. persoane</label><input id="pa-pax" name="pax" type="number" min="1" class="input" value="2"></div>
            <div class="field"><label for="pa-budget">Buget / pers. (${esc(pub.currency)})</label><input id="pa-budget" name="budgetPerPax" type="number" min="0" class="input" value="${esc(pub.pricePerPax)}"></div>
          </div>
          <div class="field"><label for="pa-room">Preferință cameră</label><select id="pa-room" name="roomType" class="input">${ROOM_TYPES.map((rt) => `<option value="${rt}">${rt}</option>`).join('')}</select></div>
          ${pub.customQuestions
            .map(
              (q) => `
            <div class="field">
              <label for="paq-${esc(q.id)}">${esc(q.label)}</label>
              <select id="paq-${esc(q.id)}" name="q_${esc(q.id)}" class="input">
                <option value="Da">Da</option>
                <option value="Nu">Nu</option>
              </select>
            </div>`
            )
            .join('')}
          <button type="submit" class="btn btn-accent">Trimite aplicarea</button>
        </form>
        <div id="public-apply-result" style="margin-top:14px"></div>
      </div>
    </main>
  `;

  document.getElementById('public-apply-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    if (!data.name?.trim()) return;
    const cust = { id: uid('cust'), name: data.name.trim(), channel: 'Board Public', note: 'Aplicat online' };
    state.customers.unshift(cust);
    const answers = {};
    for (const q of pub.customQuestions) {
      answers[q.id] = data[`q_${q.id}`] || 'Da';
    }
    const qual = autoQualifyApplication(
      trip,
      { pax: Number(data.pax || 1), budgetPerPax: Number(data.budgetPerPax || 0), answers },
      m.confirmedPax
    );
    state.applications.unshift({
      id: uid('app'),
      tripId: trip.id,
      customerId: cust.id,
      pax: Number(data.pax || 1),
      budgetPerPax: Number(data.budgetPerPax || 0),
      depositPaid: false,
      roomType: data.roomType || 'Double',
      roomCode: 'Neasignat',
      stage: qual.suggestedStage,
      qualificationStatus: qual.status,
      qualificationReasons: qual.reasons,
      appliedAt: new Date().toISOString().slice(0, 10),
      notes: [`Azi · Aplicat via Board Public (${qual.status})`],
    });
    state.selectedTripId = trip.id;
    saveState();
    document.getElementById('public-apply-result').innerHTML = `
      <div class="feedback-msg is-ok">
        Aplicare înregistrată! Status: <strong>${esc(qual.status)}</strong>.
        <a href="/">Deschide în Workspace →</a>
      </div>
    `;
    e.target.reset();
  });
}

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('board')) {
  renderPublicBoardPage();
} else if (urlParams.get('apply')) {
  renderPublicApplyPage(urlParams.get('apply'));
} else {
  renderAll();
}
