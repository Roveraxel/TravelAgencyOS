import { buildCsv, VALID_CURRENCIES } from '/csv-utils.js';
import { getDueStatus, getDueLabel } from '/date-utils.js';
import {
  APPLICATION_STAGES,
  ROOM_TYPES,
  POSTING_STATUSES,
  computeMasterTripMetrics,
  autoQualifyApplication,
  buildPublicTripPostingView,
  analyzeRooming,
  buildHotelRoomingRows,
  computeAnalytics,
} from '/trip-utils.js';
import { MESSAGE_TEMPLATES, renderMessageTemplate, parseInboundEmailText } from '/template-utils.js';
import { icon, channelIcon } from '/icons.js';

const STORAGE_KEY = 'travelagencyos_garlic_v3';

function createSeedState() {
  return {
    selectedTripId: 'trip-1',
    selectedStayId: 'stay-1',
    selectedAppId: 'app-1',
    tripsPageMode: 'home', // 'home' | 'workspace' | 'edit'
    trips: [
      {
        id: 'trip-1',
        title: 'Svalbard Arctic Expedition',
        destination: 'Longyearbyen, Svalbard',
        dates: '2027-03-14 → 2027-03-21',
        coverTheme: 'arctic',
        maxPax: 10,
        costPerPax: 1450,
        pricePerPax: 1850,
        fixedCost: 400,
        currency: 'EUR',
        postingStatus: 'Publicat',
        publicSummary:
          '7 zile în Arctica cu grup restrâns (max 10 persoane): snowmobil spre ghețarii de est, peștera de gheață și cabană nordică. Include cazare 7 nopți, ghid însoțitor și transfer aeroport.',
        images: [],
        stays: [
          { id: 'stay-1', name: 'Basecamp Longyearbyen', nights: 7, doubleRooms: 4, singleRooms: 2 },
        ],
      },
      {
        id: 'trip-2',
        title: 'Maramureș & Bucovina Trail',
        destination: 'Maramureș, România',
        dates: '2027-05-01 → 2027-05-04',
        coverTheme: 'forest',
        maxPax: 12,
        costPerPax: 1150,
        pricePerPax: 1550,
        fixedCost: 300,
        currency: 'RON',
        postingStatus: 'Publicat',
        publicSummary:
          'Weekend prelungit pe poteci din Maramureș: drumeție Creasta Cocoșului, Mocănița și cazare autentică cu demipensiune în Breb.',
        images: [],
        stays: [
          { id: 'stay-2', name: 'Pensiunea Breb', nights: 3, doubleRooms: 5, singleRooms: 2 },
        ],
      },
      {
        id: 'trip-3',
        title: 'Vietnam & Cambodgia (2 săpt.)',
        destination: 'Hanoi · Ha Long · Siem Reap',
        dates: '2027-10-10 → 2027-10-24',
        coverTheme: 'tropical',
        maxPax: 12,
        costPerPax: 1680,
        pricePerPax: 2150,
        fixedCost: 600,
        currency: 'EUR',
        postingStatus: 'Publicat',
        publicSummary:
          'Circuit de 14 zile din nordul Vietnamului până la templele Angkor Wat: street food în Hanoi, croazieră 2 nopți în Ha Long Bay și răsărit la Angkor.',
        images: [],
        stays: [
          { id: 'stay-3', name: 'Hanoi Boutique', nights: 4, doubleRooms: 5, singleRooms: 2 },
          { id: 'stay-4', name: 'Ha Long Cruise', nights: 2, doubleRooms: 5, singleRooms: 1 },
          { id: 'stay-5', name: 'Siem Reap Hotel', nights: 5, doubleRooms: 5, singleRooms: 2 },
        ],
      },
    ],
    customers: [
      { id: 'cust-1', name: 'Radu Demo', channel: 'WhatsApp', note: 'A mai fost în Islanda' },
      { id: 'cust-2', name: 'Elena & Mihai Demo', channel: 'Instagram', note: 'Preferă grupuri mici' },
      { id: 'cust-3', name: 'Vlad Demo', channel: 'Email', note: 'Întreabă de rate' },
      { id: 'cust-4', name: 'Ana & Mara Demo', channel: 'WhatsApp', note: 'Drumeții de weekend' },
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
    ],
    tasks: [
      { id: 'tsk-1', title: 'Confirmă echipament polar Svalbard', dueDate: '2026-11-18', done: false, tripId: 'trip-1' },
      { id: 'tsk-2', title: 'Follow-up Ana & Mara pentru Maramureș', dueDate: '2026-11-20', done: false, tripId: 'trip-2' },
    ],
  };
}

let state = loadState();
let activeModal = null;
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
      tripsPageMode: parsed.tripsPageMode || 'home',
      trips: Array.isArray(parsed.trips) ? parsed.trips : [],
      customers: Array.isArray(parsed.customers) ? parsed.customers : [],
      applications: Array.isArray(parsed.applications) ? parsed.applications : [],
      supplierDeadlines: Array.isArray(parsed.supplierDeadlines) ? parsed.supplierDeadlines : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
    };
  } catch {
    return createSeedState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  fetch('/api/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  }).catch(() => {});
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
  if (status === 'Calificat automat') return `<span class="qual-dot is-ok" title="${tip}">OK</span>`;
  if (status === 'Buget sub prag') return `<span class="qual-dot is-low" title="${tip}">Buget</span>`;
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
  btn.addEventListener('click', () => {
    if (btn.dataset.view === 'trips') {
      state.tripsPageMode = 'home';
    }
    switchView(btn.dataset.view);
  });
});

/* ---------------- RENDERING ---------------- */

function renderAll() {
  if (!document.getElementById('trips-home-page')) return;
  renderTripsSection();
  renderAnalyticsView();
  renderTasksView();
}

function renderTripsSection() {
  const homeEl = document.getElementById('trips-home-page');
  const wsEl = document.getElementById('trip-workspace-page');
  const editEl = document.getElementById('trip-edit-page');

  homeEl.hidden = state.tripsPageMode !== 'home';
  wsEl.hidden = state.tripsPageMode !== 'workspace';
  editEl.hidden = state.tripsPageMode !== 'edit';

  if (state.tripsPageMode === 'home') {
    renderTripsHome(homeEl);
  } else if (state.tripsPageMode === 'workspace') {
    renderTripWorkspace(wsEl);
  } else {
    renderTripEditPage(editEl);
  }
}

/* 1. MAIN PAGE: SELECT A TRIP */
function renderTripsHome(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Sejururi (Master Trips)</h1>
        <p class="muted small">Selectează un sejur pentru a gestiona clienții, camerele și comunicarea.</p>
      </div>
    </div>
    <div class="pub-board-grid">
      ${
        state.trips.length === 0
          ? '<div class="card muted">Niciun sejur. Click „+ Sejur” în bara de sus.</div>'
          : state.trips
              .map((t) => {
                const m = computeMasterTripMetrics(t, state.applications);
                const coverImg = Array.isArray(t.images) && t.images[0] ? t.images[0] : '';
                const coverStyle = coverImg
                  ? `style="background-image:linear-gradient(rgba(15,35,28,0.52),rgba(15,35,28,0.7)),url('${esc(coverImg)}');background-size:cover;background-position:center"`
                  : '';
                return `
                <article class="pub-trip-card">
                  <div class="pub-trip-cover theme-${esc(t.coverTheme || 'forest')}" ${coverStyle}>
                    <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.75rem;opacity:0.9;margin-bottom:4px">
                      <span>${esc(t.destination)}</span>
                      <span class="badge" style="background:rgba(255,255,255,0.2);color:#fff">${esc(t.postingStatus || 'Publicat')}</span>
                    </div>
                    <strong style="font-size:1.15rem;display:block">${esc(t.title)}</strong>
                    <div style="font-size:0.8rem;opacity:0.88;margin-top:4px">${esc(t.dates)}</div>
                  </div>
                  <div class="pub-trip-body">
                    <div class="metric-strip" style="padding:8px 10px;gap:12px">
                      <div class="metric-item"><span>Locuri</span><strong>${m.confirmedPax}/${t.maxPax}</strong></div>
                      <div class="metric-item"><span>Aplicanți</span><strong>${m.applicantsCount}</strong></div>
                      <div class="metric-item is-profit"><span>Profit</span><strong>${m.profit >= 0 ? '+' : ''}${fmtMoney(m.profit, t.currency)}</strong></div>
                    </div>
                    <div class="header-actions" style="margin-top:auto;padding-top:8px">
                      <button type="button" class="btn btn-primary btn-sm" data-open-trip="${esc(t.id)}">Deschide →</button>
                      <button type="button" class="btn btn-secondary btn-sm" data-edit-trip="${esc(t.id)}">${icon('edit')} Editează</button>
                    </div>
                  </div>
                </article>`;
              })
              .join('')
      }
    </div>
  `;
}

/* 2. INSIDE TRIP: LEFT CLIENTS | CENTER CLIENT DETAILS | RIGHT COMMUNICATION */
function renderTripWorkspace(container) {
  const trip = state.trips.find((t) => t.id === state.selectedTripId) || state.trips[0];
  if (!trip) {
    state.tripsPageMode = 'home';
    return renderTripsHome(container);
  }
  state.selectedTripId = trip.id;

  const m = computeMasterTripMetrics(trip, state.applications);
  const tripApps = state.applications.filter((a) => a.tripId === trip.id);
  if (!tripApps.some((a) => a.id === state.selectedAppId)) {
    state.selectedAppId = tripApps[0]?.id || '';
  }

  const stays =
    Array.isArray(trip.stays) && trip.stays.length > 0
      ? trip.stays
      : [{ id: `stay-${trip.id}`, name: trip.destination, nights: 1, doubleRooms: 4, singleRooms: 1 }];
  let activeStay = stays.find((s) => s.id === state.selectedStayId);
  if (!activeStay) {
    activeStay = stays[0];
    state.selectedStayId = activeStay.id;
  }

  const app = tripApps.find((a) => a.id === state.selectedAppId);
  const cust = app ? getCustomer(app.customerId) : null;
  const roomSummary = analyzeRooming(tripApps, state.customers, activeStay);
  const roomCodes = ['Neasignat', 'Cam. 1', 'Cam. 2', 'Cam. 3', 'Cam. 4', 'Cam. 5', 'Cam. 6', 'Cam. 7', 'Cam. 8'];

  let centerHtml = '<div class="card muted">Selectează un client din stânga sau adaugă unul cu „+ Aplică”.</div>';
  if (app && cust) {
    const pax = Number(app.pax || 1);
    const total = pax * Number(trip.pricePerPax || 0);
    const profit = pax * (Number(trip.pricePerPax || 0) - Number(trip.costPerPax || 0));
    const slot = app.roomByStay?.[activeStay.id] || app;
    const rType = slot.roomType || app.roomType || 'Double';
    const rCode = slot.roomCode || app.roomCode || 'Neasignat';

    centerHtml = `
      <div class="card">
        <div class="master-header">
          <div>
            <div style="display:flex;align-items:center;gap:10px">
              <h2 style="margin:0;font-size:1.25rem">${esc(cust.name)}</h2>
              ${qualDotHtml(app.qualificationStatus, app.qualificationReasons)}
            </div>
            <p class="muted small" style="display:flex;align-items:center;gap:6px;margin-top:3px">
              ${channelIcon(cust.channel)} ${esc(cust.channel)} · Aplicat: ${esc(app.appliedAt || '-')}
            </p>
          </div>
          <div class="header-actions">
            <select class="inline-select" data-app-stage="${esc(app.id)}" aria-label="Etapă client">
              ${APPLICATION_STAGES.map((s) => `<option value="${s}" ${app.stage === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
            <button type="button" class="btn btn-primary btn-sm" id="advance-stage-btn">${icon('arrowRight')} Etapă</button>
          </div>
        </div>

        <div class="metric-strip" style="margin-bottom:14px">
          <div class="metric-item"><span>Pax</span><strong>${pax}</strong></div>
          <div class="metric-item"><span>Buget/pax</span><strong>${fmtMoney(app.budgetPerPax, trip.currency)}</strong></div>
          <div class="metric-item"><span>Total</span><strong>${fmtMoney(total, trip.currency)}</strong></div>
          <div class="metric-item is-profit"><span>Profit</span><strong>+${fmtMoney(profit, trip.currency)}</strong></div>
          <label style="margin-left:auto;display:inline-flex;align-items:center;gap:6px;font-size:0.82rem;font-weight:600;cursor:pointer">
            <input type="checkbox" id="client-deposit-toggle" ${app.depositPaid ? 'checked' : ''}> Avans 30%
          </label>
        </div>

        <div class="small muted">${esc((app.qualificationReasons || []).join(' · '))}</div>
      </div>

      <div class="card">
        <div class="master-header" style="margin-bottom:10px">
          <div>
            <h3 style="margin:0;font-size:0.98rem">${icon('bed')} Cazare &amp; Cameră</h3>
            <div class="muted small">
              Double/Twin: ${roomSummary.usedDouble}/${activeStay.doubleRooms} · Single: ${roomSummary.usedSingle}/${activeStay.singleRooms}
              ${roomSummary.unpairedShareCount > 0 ? ` · <span style="color:var(--amber-text);font-weight:600">${roomSummary.unpairedShareCount} caută coleg(ă)</span>` : ''}
            </div>
          </div>
          <div class="header-actions">
            <button type="button" class="btn btn-ghost btn-sm" id="add-stay-btn">+ Cazare</button>
            <button type="button" class="btn btn-secondary btn-sm" id="export-rooming-btn">${icon('download')} Rooming Hotel</button>
          </div>
        </div>

        ${
          stays.length > 1
            ? `<div class="header-actions" style="margin-bottom:12px">
                ${stays.map((s) => `<button type="button" class="btn btn-sm ${s.id === activeStay.id ? 'btn-primary' : 'btn-secondary'}" data-select-stay="${esc(s.id)}">${esc(s.name)} (${s.nights}n)</button>`).join('')}
              </div>`
            : ''
        }

        <div class="two-col-tight">
          <div class="field">
            <label for="cd-room-type">Tip cameră</label>
            <select id="cd-room-type" class="input" data-room-type="${esc(app.id)}">
              ${ROOM_TYPES.map((rt) => `<option value="${rt}" ${rType === rt ? 'selected' : ''}>${rt}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="cd-room-code">Alocare cameră (${esc(activeStay.name)})</label>
            <select id="cd-room-code" class="input" data-room-code="${esc(app.id)}">
              ${roomCodes.map((rc) => `<option value="${rc}" ${rCode === rc ? 'selected' : ''}>${rc}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
    `;
  }

  let rightHtml = '<div class="muted small">Selectează un client pentru comunicare.</div>';
  if (app && cust) {
    const rendered = renderMessageTemplate(selectedTemplateId, { trip, app, customer: cust, metrics: m });
    rightHtml = `
      <div class="rail-header" style="padding:0 0 8px"><span>Comunicare</span></div>
      <select id="rail-tpl-select" class="input" aria-label="Alege șablon mesaj">
        ${MESSAGE_TEMPLATES.map((t) => `<option value="${esc(t.id)}" ${t.id === selectedTemplateId ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}
      </select>
      <textarea id="rail-tpl-body" rows="6" class="input" style="font-size:0.8rem">${esc(rendered.body)}</textarea>
      <div class="form-actions">
        <button type="button" class="btn btn-primary btn-sm" id="rail-wa-btn">${icon('chat')} WhatsApp</button>
        <a class="btn btn-secondary btn-sm" href="mailto:?subject=${encodeURIComponent(rendered.subject)}&body=${encodeURIComponent(rendered.body)}">${icon('mail')} Email</a>
      </div>

      <div class="rail-header" style="padding:10px 0 6px"><span>Istoric &amp; Note</span></div>
      <form id="rail-note-form" class="form-actions">
        <input id="rail-note-input" class="input" placeholder="Adaugă notă..." aria-label="Adaugă notă">
      </form>
      <div class="stack">
        ${(app.notes || []).map((n) => `<div class="small" style="border-bottom:1px solid var(--border);padding-bottom:6px">${esc(n)}</div>`).join('')}
      </div>
    `;
  }

  container.innerHTML = `
    <div class="trip-subbar no-print">
      <div class="header-actions">
        <button type="button" class="btn btn-secondary btn-sm" id="back-to-trips-btn">← Sejururi</button>
        <strong style="font-size:1rem">${esc(trip.title)}</strong>
        <span class="muted small">${m.confirmedPax}/${trip.maxPax} pax</span>
        <span class="badge badge-profit">${m.profit >= 0 ? '+' : ''}${fmtMoney(m.profit, trip.currency)}</span>
      </div>
      <div class="header-actions">
        <button type="button" class="btn btn-ghost btn-sm" id="copy-apply-link-btn">${icon('link')} Link</button>
        <button type="button" class="btn btn-secondary btn-sm" id="ws-edit-trip-btn">${icon('edit')} Editează sejur</button>
        <button type="button" class="btn btn-accent btn-sm" id="apply-to-trip-btn">${icon('userPlus')} Aplică</button>
      </div>
    </div>

    <div class="ats-shell">
      <aside class="ats-rail-left" aria-label="Clienți sejur">
        <div class="rail-header">
          <span>Clienți (${tripApps.length})</span>
        </div>
        <div>
          ${
            tripApps.length === 0
              ? '<div class="muted small" style="padding:14px">Niciun client.</div>'
              : tripApps
                  .map((a) => {
                    const c = getCustomer(a.customerId);
                    const active = a.id === state.selectedAppId ? 'is-active' : '';
                    return `
                    <button type="button" class="trip-list-item ${active}" data-select-app="${esc(a.id)}">
                      <div class="trip-item-top">
                        <span>${esc(c.name)}</span>
                        ${qualDotHtml(a.qualificationStatus, a.qualificationReasons)}
                      </div>
                      <div class="trip-item-meta">${a.pax} pax · ${esc(a.stage)}</div>
                    </button>`;
                  })
                  .join('')
          }
        </div>
      </aside>

      <main class="ats-center">${centerHtml}</main>

      <aside class="ats-rail-right" aria-label="Comunicare client">${rightHtml}</aside>
    </div>
  `;
}

/* 3. EDIT TRIP VIEW (Simple: Description textbox + Pictures) */
function renderTripEditPage(container) {
  const trip = state.trips.find((t) => t.id === state.selectedTripId);
  if (!trip) {
    state.tripsPageMode = 'home';
    return renderTripsSection();
  }
  const images = Array.isArray(trip.images) ? trip.images : [];

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Editează sejur</h1>
        <p class="muted small">${esc(trip.title)}</p>
      </div>
      <div class="header-actions">
        <button type="button" class="btn btn-ghost btn-sm" id="edit-back-btn">← Înapoi</button>
        <button type="button" class="btn btn-secondary btn-sm" id="edit-open-ws-btn">Deschide Clienți →</button>
      </div>
    </div>

    <div class="card">
      <form id="trip-edit-form" class="form-stack">
        <div class="two-col-tight">
          <div class="field"><label for="et-title">Titlu sejur *</label><input id="et-title" name="title" class="input" required value="${esc(trip.title)}"></div>
          <div class="field"><label for="et-dest">Destinație *</label><input id="et-dest" name="destination" class="input" required value="${esc(trip.destination)}"></div>
        </div>
        <div class="two-col-tight">
          <div class="field"><label for="et-dates">Perioadă</label><input id="et-dates" name="dates" class="input" value="${esc(trip.dates)}"></div>
          <div class="field"><label for="et-status">Status anunț</label><select id="et-status" name="postingStatus" class="input">${POSTING_STATUSES.map((s) => `<option value="${s}" ${(trip.postingStatus || 'Publicat') === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        </div>
        <div class="two-col-tight">
          <div class="field"><label for="et-cost">Cost furnizor / pax</label><input id="et-cost" name="costPerPax" type="number" min="0" class="input" value="${esc(trip.costPerPax)}"></div>
          <div class="field"><label for="et-price">Preț vânzare / pax</label><input id="et-price" name="pricePerPax" type="number" min="0" class="input" value="${esc(trip.pricePerPax)}"></div>
        </div>
        <div class="two-col-tight">
          <div class="field"><label for="et-pax">Locuri max</label><input id="et-pax" name="maxPax" type="number" min="1" class="input" value="${esc(trip.maxPax)}"></div>
          <div class="field"><label for="et-cur">Monedă</label><select id="et-cur" name="currency" class="input">${VALID_CURRENCIES.map((c) => `<option value="${c}" ${trip.currency === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        </div>

        <div class="field">
          <label for="et-desc">Descriere sejur</label>
          <textarea id="et-desc" name="publicSummary" rows="5" class="input" placeholder="Descrie programul, ce este inclus și detalii utile pentru clienți...">${esc(trip.publicSummary || '')}</textarea>
        </div>

        <div class="field">
          <label>Imagini sejur (${images.length})</label>
          <div class="header-actions">
            <input id="et-img-url" class="input" style="flex:1" placeholder="Lipește URL imagine (https://...)">
            <button type="button" class="btn btn-secondary btn-sm" id="et-add-img-url">+ Adaugă URL</button>
            <label class="btn btn-secondary btn-sm" for="et-img-file" style="cursor:pointer">+ Încarcă poză</label>
            <input id="et-img-file" type="file" accept="image/*" hidden>
          </div>
          ${
            images.length > 0
              ? `<div class="img-preview-strip">${images
                  .map(
                    (src, idx) => `
                  <div class="img-thumb-wrap">
                    <img src="${esc(src)}" alt="Imagine sejur">
                    <button type="button" class="img-thumb-del" data-del-trip-img="${idx}" aria-label="Șterge imagine">✕</button>
                  </div>`
                  )
                  .join('')}</div>`
              : ''
          }
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Salvează sejur</button>
        </div>
      </form>
    </div>
  `;
}

/* 4. ANALYTICS VIEW */
function renderAnalyticsView() {
  const el = document.getElementById('view-analytics');
  if (!el) return;
  const a = computeAnalytics(state.trips, state.applications);
  const maxRev = Math.max(1, ...a.byTrip.map((t) => t.revenue));
  const maxFunnel = Math.max(1, ...a.funnel.map((f) => f.count));

  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Analytics</h1>
        <p class="muted small">Performanță pe sejururi, ocupare locuri și rată de calificare.</p>
      </div>
    </div>

    <div class="econ-grid" style="margin-bottom:20px">
      <div class="econ-box is-profit"><div class="econ-label">Profit estimat total</div><div class="econ-value">+${a.totalProfit.toLocaleString('ro-RO')}</div></div>
      <div class="econ-box"><div class="econ-label">Venituri estimate</div><div class="econ-value">${a.totalRevenue.toLocaleString('ro-RO')}</div></div>
      <div class="econ-box"><div class="econ-label">Ocupare locuri</div><div class="econ-value">${a.occupancyPct}%</div></div>
      <div class="econ-box"><div class="econ-label">Calificare automată</div><div class="econ-value">${a.qualificationRatePct}%</div></div>
    </div>

    <div class="two-col">
      <div class="card">
        <h2 style="margin:0 0 12px;font-size:1rem">Venituri &amp; Profit per Sejur</h2>
        ${a.byTrip
          .map(
            (t) => `
          <div class="bar-row">
            <div class="small"><strong>${esc(t.title)}</strong><div class="muted">${t.confirmedPax}/${t.maxPax} pax</div></div>
            <div class="bar-track"><div class="bar-fill" style="width:${Math.round((t.revenue / maxRev) * 100)}%"></div></div>
            <div class="small" style="text-align:right"><strong class="profit-text">+${fmtMoney(t.profit, t.currency)}</strong></div>
          </div>`
          )
          .join('')}
      </div>

      <div class="card">
        <h2 style="margin:0 0 12px;font-size:1rem">Funnel Aplicanți (${a.totalApplications} activi)</h2>
        ${a.funnel
          .map(
            (f) => `
          <div class="bar-row">
            <div class="small"><strong>${esc(f.stage)}</strong></div>
            <div class="bar-track"><div class="bar-fill is-accent" style="width:${Math.round((f.count / maxFunnel) * 100)}%"></div></div>
            <div class="small" style="text-align:right"><strong>${f.count}</strong></div>
          </div>`
          )
          .join('')}
      </div>
    </div>
  `;
}

/* 5. TASKS VIEW */
function renderTasksView() {
  const list = document.getElementById('tasks-list');
  const openTasksCount =
    state.tasks.filter((t) => !t.done).length +
    (state.supplierDeadlines || []).filter((sd) => !sd.done).length;
  const navTaskBtn = document.querySelector('.top-nav-btn[data-view="tasks"]');
  if (navTaskBtn) {
    navTaskBtn.innerHTML = `${icon('calendar')} Sarcini (${openTasksCount})`;
  }

  const deadlineHtml = (state.supplierDeadlines || []).map((sd) => {
    const trip = state.trips.find((tr) => tr.id === sd.tripId);
    const dueStatus = sd.done ? 'none' : getDueStatus(sd.dueDate);
    const dueLabel = getDueLabel(dueStatus);
    return `
      <div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:12px;opacity:${sd.done ? 0.6 : 1}">
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
          <input type="checkbox" ${sd.done ? 'checked' : ''} data-toggle-deadline="${esc(sd.id)}">
          <div>
            <strong>${esc(sd.supplierName)}</strong> <span class="badge">${esc(sd.kind)}</span>
            <div class="muted small">
              Termen: ${esc(sd.dueDate || '-')}
              ${dueLabel ? `<span class="badge ${dueStatus === 'overdue' ? 'badge-danger' : 'badge-warning'}">${esc(dueLabel)}</span>` : ''}
              ${sd.amount ? ` · ${fmtMoney(sd.amount, sd.currency)}` : ''}
              ${trip ? ` · ${esc(trip.title)}` : ''}
            </div>
          </div>
        </label>
        <button type="button" class="btn btn-ghost btn-sm" data-delete-deadline="${esc(sd.id)}">Șterge</button>
      </div>`;
  });

  const taskHtml = state.tasks.map((t) => {
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
  });

  if (deadlineHtml.length === 0 && taskHtml.length === 0) {
    list.innerHTML = '<div class="card muted small">Nicio sarcină sau scadență.</div>';
    return;
  }
  list.innerHTML = [...deadlineHtml, ...taskHtml].join('');
}

/* ---------------- EVENTS ---------------- */

document.addEventListener('click', async (e) => {
  const openBtn = e.target.closest('[data-open-trip]');
  if (openBtn) {
    state.selectedTripId = openBtn.dataset.openTrip;
    state.tripsPageMode = 'workspace';
    saveState();
    renderTripsSection();
    return;
  }

  const editBtn = e.target.closest('[data-edit-trip]');
  if (editBtn) {
    state.selectedTripId = editBtn.dataset.editTrip;
    state.tripsPageMode = 'edit';
    saveState();
    renderTripsSection();
    return;
  }

  const appBtn = e.target.closest('[data-select-app]');
  if (appBtn) {
    state.selectedAppId = appBtn.dataset.selectApp;
    saveState();
    renderTripsSection();
    return;
  }

  const stayBtn = e.target.closest('[data-select-stay]');
  if (stayBtn) {
    state.selectedStayId = stayBtn.dataset.selectStay;
    saveState();
    renderTripsSection();
    return;
  }

  const btn = e.target.closest('button');
  if (!btn) return;

  if (btn.id === 'new-trip-btn') {
    const id = uid('trip');
    state.trips.unshift({
      id,
      title: 'Sejur nou',
      destination: 'Destinație',
      dates: '2027-06-15 → 2027-06-22',
      coverTheme: 'forest',
      maxPax: 10,
      costPerPax: 600,
      pricePerPax: 850,
      fixedCost: 0,
      currency: 'EUR',
      postingStatus: 'Draft',
      publicSummary: '',
      images: [],
      stays: [{ id: uid('stay'), name: 'Cazare principală', nights: 5, doubleRooms: 4, singleRooms: 2 }],
    });
    state.selectedTripId = id;
    state.tripsPageMode = 'edit';
    saveState();
    switchView('trips');
  } else if (btn.id === 'back-to-trips-btn' || btn.id === 'edit-back-btn') {
    state.tripsPageMode = 'home';
    saveState();
    renderTripsSection();
  } else if (btn.id === 'ws-edit-trip-btn') {
    state.tripsPageMode = 'edit';
    saveState();
    renderTripsSection();
  } else if (btn.id === 'edit-open-ws-btn') {
    state.tripsPageMode = 'workspace';
    saveState();
    renderTripsSection();
  } else if (btn.id === 'et-add-img-url') {
    const urlInput = document.getElementById('et-img-url');
    const trip = state.trips.find((t) => t.id === state.selectedTripId);
    if (trip && urlInput?.value.trim()) {
      trip.images = Array.isArray(trip.images) ? trip.images : [];
      trip.images.push(urlInput.value.trim());
      saveState();
      renderTripsSection();
      showToast('Imagine adăugată.');
    }
  } else if (btn.dataset.delTripImg !== undefined) {
    const trip = state.trips.find((t) => t.id === state.selectedTripId);
    if (trip && Array.isArray(trip.images)) {
      trip.images.splice(Number(btn.dataset.delTripImg), 1);
      saveState();
      renderTripsSection();
    }
  } else if (btn.id === 'apply-to-trip-btn') {
    openApplyModal();
  } else if (btn.id === 'add-stay-btn') {
    openStayModal();
  } else if (btn.id === 'new-task-btn') {
    openTaskModal();
  } else if (btn.id === 'parse-email-btn') {
    openEmailParseModal();
  } else if (btn.id === 'copy-apply-link-btn') {
    const url = `${window.location.origin}/?apply=${encodeURIComponent(state.selectedTripId)}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link de aplicare copiat.');
    } catch {
      showToast(url);
    }
  } else if (btn.id === 'advance-stage-btn') {
    const app = state.applications.find((a) => a.id === state.selectedAppId);
    if (app) {
      const idx = APPLICATION_STAGES.indexOf(app.stage);
      if (idx >= 0 && idx < APPLICATION_STAGES.length - 2) {
        app.stage = APPLICATION_STAGES[idx + 1];
        app.notes.unshift(`Azi · Avansat la ${app.stage}`);
        saveState();
        renderAll();
        showToast(`Etapă: ${app.stage}`);
      }
    }
  } else if (btn.id === 'rail-wa-btn') {
    const text = document.getElementById('rail-tpl-body')?.value || '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      const app = state.applications.find((a) => a.id === state.selectedAppId);
      const tpl = MESSAGE_TEMPLATES.find((t) => t.id === selectedTemplateId);
      if (app && tpl) {
        app.notes.unshift(`Azi · Trimis WhatsApp: ${tpl.label}`);
        saveState();
        renderTripsSection();
      }
      showToast('Copiat pentru WhatsApp.');
    } catch {
      showToast('Copiere eșuată.');
    }
  } else if (btn.id === 'export-rooming-btn') {
    const trip = state.trips.find((t) => t.id === state.selectedTripId);
    if (!trip) return;
    const activeStay = trip.stays?.find((s) => s.id === state.selectedStayId) || trip.stays?.[0] || null;
    const tripApps = state.applications.filter((a) => a.tripId === trip.id);
    const rows = buildHotelRoomingRows(tripApps, state.customers, activeStay);
    if (rows.length === 0) return showToast('Alocați cel puțin o cameră.');
    const csv = buildCsv(['cazare', 'camera', 'tip_camera', 'oaspeti', 'pax', 'observatii'], rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rooming-${trip.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Rooming Hotel exportat.');
  } else if (btn.dataset.deleteDeadline) {
    state.supplierDeadlines = (state.supplierDeadlines || []).filter((sd) => sd.id !== btn.dataset.deleteDeadline);
    saveState();
    renderTasksView();
  } else if (btn.dataset.deleteTask) {
    state.tasks = state.tasks.filter((t) => t.id !== btn.dataset.deleteTask);
    saveState();
    renderTasksView();
  }
});

document.addEventListener('change', async (e) => {
  if (e.target.id === 'et-img-file') {
    const file = e.target.files?.[0];
    const trip = state.trips.find((t) => t.id === state.selectedTripId);
    if (!file || !trip) return;
    const reader = new FileReader();
    reader.onload = () => {
      trip.images = Array.isArray(trip.images) ? trip.images : [];
      trip.images.push(String(reader.result));
      saveState();
      renderTripsSection();
      showToast('Poză încărcată.');
    };
    reader.readAsDataURL(file);
  } else if (e.target.matches('select[data-app-stage]')) {
    const app = state.applications.find((a) => a.id === e.target.dataset.appStage);
    if (app) {
      app.stage = e.target.value;
      app.notes.unshift(`Azi · Mutat în ${app.stage}`);
      saveState();
      renderAll();
      showToast(`Status: ${app.stage}`);
    }
  } else if (e.target.id === 'client-deposit-toggle') {
    const app = state.applications.find((a) => a.id === state.selectedAppId);
    if (app) {
      app.depositPaid = e.target.checked;
      if (app.depositPaid && app.stage === 'Ofertă trimisă') app.stage = 'Avans achitat';
      app.notes.unshift(`Azi · Avans 30%: ${app.depositPaid ? 'Achitat' : 'Neachitat'}`);
      saveState();
      renderAll();
    }
  } else if (e.target.id === 'rail-tpl-select') {
    selectedTemplateId = e.target.value;
    renderTripsSection();
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
      renderTripsSection();
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
      renderTripsSection();
    }
  } else if (e.target.matches('input[type="checkbox"][data-toggle-deadline]')) {
    const sd = (state.supplierDeadlines || []).find((x) => x.id === e.target.dataset.toggleDeadline);
    if (sd) {
      sd.done = e.target.checked;
      saveState();
      renderTasksView();
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

document.addEventListener('submit', (e) => {
  if (e.target.id === 'trip-edit-form') {
    e.preventDefault();
    const trip = state.trips.find((t) => t.id === state.selectedTripId);
    if (!trip) return;
    const fd = Object.fromEntries(new FormData(e.target).entries());
    Object.assign(trip, {
      title: (fd.title || '').trim() || trip.title,
      destination: (fd.destination || '').trim() || trip.destination,
      dates: (fd.dates || '').trim(),
      postingStatus: fd.postingStatus || 'Publicat',
      costPerPax: Number(fd.costPerPax || 0),
      pricePerPax: Number(fd.pricePerPax || 0),
      maxPax: Number(fd.maxPax || 10),
      currency: fd.currency || 'EUR',
      publicSummary: (fd.publicSummary || '').trim(),
    });
    saveState();
    renderAll();
    showToast('Sejur salvat.');
  } else if (e.target.id === 'rail-note-form') {
    e.preventDefault();
    const input = document.getElementById('rail-note-input');
    const app = state.applications.find((a) => a.id === state.selectedAppId);
    if (app && input?.value.trim()) {
      app.notes.unshift(`Azi · ${input.value.trim()}`);
      saveState();
      renderTripsSection();
      showToast('Notă adăugată.');
    }
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

function openApplyModal() {
  const trip = state.trips.find((t) => t.id === state.selectedTripId);
  if (!trip) return;
  activeModal = { type: 'apply', tripId: trip.id };
  modalTitleEl.textContent = `Aplică la: ${trip.title}`;
  modalFieldsEl.innerHTML = `
    <div class="field"><label for="a-name">Nume client (sintetic) *</label><input id="a-name" name="name" class="input" required placeholder="ex. Andrei Demo"></div>
    <div class="two-col-tight">
      <div class="field"><label for="a-pax">Nr. persoane</label><input id="a-pax" name="pax" type="number" min="1" class="input" value="2"></div>
      <div class="field"><label for="a-budget">Buget / pax (${esc(trip.currency)})</label><input id="a-budget" name="budgetPerPax" type="number" min="0" class="input" value="${esc(trip.pricePerPax)}"></div>
    </div>
    <div class="two-col-tight">
      <div class="field"><label for="a-channel">Canal</label><select id="a-channel" name="channel" class="input"><option>Formular Sejur</option><option>WhatsApp</option><option>Instagram</option><option>Email</option></select></div>
      <div class="field"><label for="a-room">Preferință cameră</label><select id="a-room" name="roomType" class="input">${ROOM_TYPES.map((rt) => `<option value="${rt}">${rt}</option>`).join('')}</select></div>
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

function openEmailParseModal() {
  activeModal = { type: 'email-parse' };
  modalTitleEl.textContent = 'Convertește Email în Scadență / Sarcină';
  modalFieldsEl.innerHTML = `
    <div class="field"><label for="ep-text">Text email *</label><textarea id="ep-text" name="rawText" rows="4" class="input" required placeholder="ex. Vă rugăm să achitați 1200 EUR până la 25.11.2026."></textarea></div>
    <div class="field"><label for="ep-trip">Sejur</label><select id="ep-trip" name="tripId" class="input">${state.trips.map((t) => `<option value="${esc(t.id)}">${esc(t.title)}</option>`).join('')}</select></div>
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

  if (activeModal.type === 'apply') {
    if (!data.name?.trim()) return showError('Numele clientului este obligatoriu.');
    const trip = state.trips.find((t) => t.id === activeModal.tripId);
    const metrics = computeMasterTripMetrics(trip, state.applications);
    const cust = { id: uid('cust'), name: data.name.trim(), channel: data.channel, note: '' };
    state.customers.unshift(cust);
    const qual = autoQualifyApplication(
      trip,
      { pax: Number(data.pax || 1), budgetPerPax: Number(data.budgetPerPax || 0) },
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
      notes: [`Azi · ${qual.status}`],
    });
    state.selectedAppId = appId;
    showToast(`Aplicant adăugat: ${qual.status}`);
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
  } else if (activeModal.type === 'email-parse') {
    if (!data.rawText?.trim()) return showError('Lipește textul emailului.');
    const extracted = parseInboundEmailText(data.rawText);
    state.supplierDeadlines = state.supplierDeadlines || [];
    state.supplierDeadlines.unshift({
      id: uid('sd'),
      tripId: data.tripId || state.selectedTripId,
      supplierName: extracted.title,
      kind: extracted.amount > 0 ? 'Avans furnizor' : 'Rooming cut-off',
      dueDate: extracted.dueDate,
      amount: extracted.amount,
      currency: extracted.currency,
      done: false,
    });
    showToast('Scadență extrasă din email.');
  } else if (activeModal.type === 'task') {
    if (!data.title?.trim()) return showError('Titlul este obligatoriu.');
    state.tasks.unshift({ id: uid('tsk'), title: data.title.trim(), dueDate: data.dueDate, done: false, tripId: data.tripId });
    showToast('Sarcină adăugată.');
  }

  saveState();
  closeModal();
  renderAll();
});

document.getElementById('reset-demo-btn')?.addEventListener('click', () => {
  state = createSeedState();
  saveState();
  renderAll();
  showToast('Date demo resetate.');
});

/* ---------------- PUBLIC BOARD & APPLY VIEWS ---------------- */

function renderPublicBoardPage() {
  const publicTrips = state.trips
    .map((t) => ({ raw: t, pub: buildPublicTripPostingView(t, state.applications) }))
    .filter(({ pub }) => pub.postingStatus === 'Publicat' || pub.postingStatus === 'Locuri epuizate');

  document.body.innerHTML = `
    <header class="topbar">
      <div class="topbar-left">
        <div class="brand">
          <img src="/favicon.svg" width="22" height="22" alt="" aria-hidden="true" style="border-radius:5px">
          <span>Garlic Trips · Expediții de Grup</span>
        </div>
      </div>
      <div class="topbar-right">
        <a href="/" class="btn btn-secondary btn-sm">Workspace Agenție →</a>
      </div>
    </header>
    <main class="page-container" style="max-width:1040px">
      <div class="pub-hero theme-forest">
        <span class="pub-kicker">Grupuri mici · Prieteni · Aventură</span>
        <h1>Aventuri de grup deschise</h1>
        <p style="margin:0;opacity:0.9">Alege expediția care ți se potrivește și aplică în 30 de secunde.</p>
      </div>
      <div class="pub-board-grid">
        ${publicTrips
          .map(({ raw, pub }) => {
            const coverImg = Array.isArray(raw.images) && raw.images[0] ? raw.images[0] : '';
            const coverStyle = coverImg
              ? `style="background-image:linear-gradient(rgba(15,35,28,0.52),rgba(15,35,28,0.72)),url('${esc(coverImg)}');background-size:cover;background-position:center"`
              : '';
            return `
              <article class="pub-trip-card">
                <div class="pub-trip-cover theme-${esc(pub.coverTheme)}" ${coverStyle}>
                  <div style="font-size:0.75rem;opacity:0.85;margin-bottom:4px">${esc(pub.destination)}</div>
                  <strong style="font-size:1.18rem;display:block">${esc(pub.title)}</strong>
                  <div style="font-size:0.82rem;opacity:0.9;margin-top:4px">${esc(pub.dates)}</div>
                </div>
                <div class="pub-trip-body">
                  <span class="badge ${pub.spotsRemaining > 0 ? 'badge-profit' : 'badge-warning'}" style="width:fit-content">
                    ${pub.spotsRemaining > 0 ? `${pub.spotsRemaining} locuri libere` : 'Listă de așteptare'}
                  </span>
                  <p class="small" style="margin:0;color:var(--text-secondary)">${esc(pub.publicSummary)}</p>
                  <div style="margin-top:auto;padding-top:10px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
                    <div><strong style="font-size:1.1rem">${fmtMoney(pub.pricePerPax, pub.currency)}</strong> <span class="muted small">/ pers.</span></div>
                    <a href="/?apply=${encodeURIComponent(pub.id)}" class="btn btn-accent btn-sm">Aplică →</a>
                  </div>
                </div>
              </article>`;
          })
          .join('')}
      </div>
    </main>
  `;
}

function renderPublicApplyPage(tripId) {
  const trip = state.trips.find((t) => t.id === tripId) || state.trips[0];
  if (!trip) return renderAll();
  const pub = buildPublicTripPostingView(trip, state.applications);
  const m = computeMasterTripMetrics(trip, state.applications);
  const images = Array.isArray(trip.images) ? trip.images : [];
  const coverStyle = images[0]
    ? `style="background-image:linear-gradient(rgba(15,35,28,0.58),rgba(15,35,28,0.72)),url('${esc(images[0])}');background-size:cover;background-position:center"`
    : '';

  document.body.innerHTML = `
    <header class="topbar">
      <div class="topbar-left">
        <div class="brand">
          <img src="/favicon.svg" width="22" height="22" alt="" aria-hidden="true" style="border-radius:5px">
          <span>Garlic Trips</span>
        </div>
      </div>
      <div class="topbar-right">
        <a href="/?board=1" class="btn btn-secondary btn-sm">← Toate sejururile</a>
        <a href="/" class="btn btn-secondary btn-sm">Workspace Agenție</a>
      </div>
    </header>
    <main class="page-container" style="max-width:980px">
      <div class="pub-hero theme-${esc(pub.coverTheme)}" ${coverStyle}>
        <span class="pub-kicker">${pub.spotsRemaining > 0 ? `${pub.spotsRemaining} locuri libere` : 'Listă de așteptare'}</span>
        <h1>${esc(pub.title)}</h1>
        <div class="pub-meta-row">
          <span>${icon('globe')} ${esc(pub.destination)}</span>
          <span>${icon('calendar')} ${esc(pub.dates)}</span>
          <span>${icon('coins')} <strong>${fmtMoney(pub.pricePerPax, pub.currency)}</strong> / pers.</span>
        </div>
      </div>

      <div class="pub-grid">
        <div class="stack">
          <div class="card">
            <h2 style="margin:0 0 10px;font-size:1.05rem">Despre expediție</h2>
            <p class="small" style="margin:0;white-space:pre-line">${esc(pub.publicSummary)}</p>
          </div>
          ${
            images.length > 0
              ? `<div class="card">
                  <h2 style="margin:0 0 10px;font-size:1.05rem">Galerie</h2>
                  <div class="img-preview-strip">${images.map((src) => `<div class="img-thumb-wrap" style="width:150px;height:100px"><img src="${esc(src)}" alt="Foto sejur"></div>`).join('')}</div>
                </div>`
              : ''
          }
        </div>

        <div class="card">
          <h2 style="margin:0 0 4px;font-size:1.1rem">${pub.spotsRemaining > 0 ? 'Aplică la expediție' : 'Listă de așteptare'}</h2>
          <p class="muted small" style="margin-bottom:14px">Completează în 30 de secunde.</p>
          <form id="public-apply-form" class="form-stack">
            <div class="field"><label for="pa-name">Nume (demo) *</label><input id="pa-name" name="name" class="input" required placeholder="ex. Andrei Demo"></div>
            <div class="two-col-tight">
              <div class="field"><label for="pa-pax">Nr. persoane</label><input id="pa-pax" name="pax" type="number" min="1" class="input" value="2"></div>
              <div class="field"><label for="pa-budget">Buget / pers. (${esc(pub.currency)})</label><input id="pa-budget" name="budgetPerPax" type="number" min="0" class="input" value="${esc(pub.pricePerPax)}"></div>
            </div>
            <div class="field"><label for="pa-room">Preferință cameră</label><select id="pa-room" name="roomType" class="input">${ROOM_TYPES.map((rt) => `<option value="${rt}">${rt}</option>`).join('')}</select></div>
            <button type="submit" class="btn btn-accent">Trimite aplicarea →</button>
          </form>
          <div id="public-apply-result" style="margin-top:14px"></div>
        </div>
      </div>
    </main>
  `;

  document.getElementById('public-apply-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    if (!data.name?.trim()) return;
    const cust = { id: uid('cust'), name: data.name.trim(), channel: 'Board Public', note: '' };
    state.customers.unshift(cust);
    const qual = autoQualifyApplication(
      trip,
      { pax: Number(data.pax || 1), budgetPerPax: Number(data.budgetPerPax || 0) },
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
    fetch('/api/public/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tripId: trip.id,
        name: data.name.trim(),
        pax: Number(data.pax || 1),
        budgetPerPax: Number(data.budgetPerPax || 0),
        roomType: data.roomType || 'Double',
      }),
    }).catch(() => {});
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
async function initApp() {
  try {
    const res = await fetch('/api/state');
    if (res.ok) {
      const data = await res.json();
      if (data?.state && Array.isArray(data.state.trips) && data.state.trips.length > 0) {
        state = { ...state, ...data.state };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } else {
        saveState();
      }
    }
  } catch {
    // Offline fallback
  }

  if (urlParams.get('board')) {
    renderPublicBoardPage();
  } else if (urlParams.get('apply')) {
    renderPublicApplyPage(urlParams.get('apply'));
  } else {
    renderAll();
  }
}

initApp();
