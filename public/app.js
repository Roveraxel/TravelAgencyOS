import {
  buildCsv,
  parseCsvText,
  validateEnquiryImportRows,
  VALID_CURRENCIES,
} from '/csv-utils.js';
import { getDueStatus, getDueLabel } from '/date-utils.js';
import {
  APPLICATION_STAGES,
  computeMasterTripMetrics,
  autoQualifyApplication,
} from '/trip-utils.js';

const STORAGE_KEY = 'travelagencyos_garlic_v2';

function createSeedState() {
  return {
    selectedTripId: 'trip-1',
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
        style: 'Expediție grup mic, snowmobile, observare natură',
        notes: 'Include ghid local și transfer aeroport. Echipament polar [DE CONFIRMAT].',
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
        style: 'Drumeții ușoare, pensiuni locale, cină tradițională',
        notes: 'Plecări din Timișoara / Cluj.',
      },
      {
        id: 'trip-3',
        title: 'Vietnam & Cambodgia',
        destination: 'Hanoi · Ha Long · Siem Reap',
        dates: '2027-10-10 → 2027-10-22',
        maxPax: 12,
        costPerPax: 1680,
        pricePerPax: 2150,
        fixedCost: 600,
        currency: 'EUR',
        style: 'Grup de prieteni, street food, temple Angkor',
        notes: 'Zbor internațional [DE CONFIRMAT].',
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
        stage: 'Aplicat',
        qualificationStatus: 'Buget sub prag',
        qualificationReasons: ['Buget (1300 EUR) sub pragul sejurului (1850 EUR)'],
        appliedAt: '2026-11-15',
        notes: ['15 nov · Aplicat; necesită discuție buget'],
      },
      {
        id: 'app-4',
        tripId: 'trip-2',
        customerId: 'cust-4',
        pax: 4,
        budgetPerPax: 1600,
        stage: 'Ofertă trimisă',
        qualificationStatus: 'Calificat automat',
        qualificationReasons: ['Buget și locuri compatibile cu sejurul'],
        appliedAt: '2026-11-14',
        notes: ['14 nov · Trimis PDF pe WhatsApp'],
      },
    ],
    tasks: [
      { id: 'tsk-1', title: 'Confirmă echipament polar Svalbard', dueDate: '2026-11-18', done: false, tripId: 'trip-1' },
      { id: 'tsk-2', title: 'Follow-up Ana & Mara pentru Maramureș', dueDate: '2026-11-20', done: false, tripId: 'trip-2' },
    ],
    offerDrafts: {},
  };
}

let state = loadState();
let activeModal = null;
let stagedCsvRows = [];

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeedState();
    const parsed = JSON.parse(raw);
    return {
      selectedTripId: parsed.selectedTripId || parsed.trips?.[0]?.id || '',
      selectedAppId: parsed.selectedAppId || '',
      activeCenterTab: parsed.activeCenterTab || 'applicants',
      trips: Array.isArray(parsed.trips) ? parsed.trips : [],
      customers: Array.isArray(parsed.customers) ? parsed.customers : [],
      applications: Array.isArray(parsed.applications) ? parsed.applications : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
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

function qualBadgeClass(status) {
  if (status === 'Calificat automat') return 'badge badge-profit';
  if (status === 'Buget sub prag') return 'badge badge-danger';
  return 'badge badge-warning';
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
      '<div class="card">Creați primul Master Trip cu „+ Sejur nou”.</div>';
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
      return `
      <button type="button" class="trip-list-item ${active}" data-select-trip="${esc(t.id)}">
        <div class="trip-item-top">
          <span>${esc(t.title)}</span>
          <span class="profit-text">${m.profit >= 0 ? '+' : ''}${fmtMoney(m.profit, t.currency)}</span>
        </div>
        <div class="trip-item-meta">${esc(t.dates)} · ${m.confirmedPax}/${t.maxPax} pax</div>
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
              <th>Calificare automată</th>
              <th>Pax</th>
              <th>Total</th>
              <th>Profit</th>
              <th>Etapă ATS</th>
            </tr>
          </thead>
          <tbody>
            ${
              tripApps.length === 0
                ? '<tr><td colspan="6" class="muted">Niciun aplicant încă. Folosiți „+ Aplică client”.</td></tr>'
                : tripApps
                    .map((a) => {
                      const cust = getCustomer(a.customerId);
                      const pax = Number(a.pax || 1);
                      const total = pax * Number(trip.pricePerPax || 0);
                      const profit = pax * (Number(trip.pricePerPax || 0) - Number(trip.costPerPax || 0));
                      const selectedCls = a.id === state.selectedAppId ? 'is-selected' : '';
                      return `
                      <tr class="${selectedCls}" data-select-app="${esc(a.id)}">
                        <td><strong>${esc(cust.name)}</strong><div class="muted small">${esc(cust.channel)}</div></td>
                        <td><span class="${qualBadgeClass(a.qualificationStatus)}">${esc(a.qualificationStatus)}</span></td>
                        <td>${pax} pax</td>
                        <td><strong>${fmtMoney(total, trip.currency)}</strong></td>
                        <td class="profit-text">+${fmtMoney(profit, trip.currency)}</td>
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
  } else if (state.activeCenterTab === 'costs') {
    tabBodyHtml = `
      <div class="card">
        <h2 style="margin:0 0 12px;font-size:1rem">Structură costuri Master Trip</h2>
        <div class="two-col-tight">
          <div><span class="muted small">Cost furnizor / pax</span><div><strong>${fmtMoney(trip.costPerPax, trip.currency)}</strong></div></div>
          <div><span class="muted small">Preț vânzare / pax</span><div><strong>${fmtMoney(trip.pricePerPax, trip.currency)}</strong></div></div>
          <div><span class="muted small">Cost fix grup (ghid / transfer)</span><div><strong>${fmtMoney(trip.fixedCost, trip.currency)}</strong></div></div>
          <div><span class="muted small">Capacitate maximă</span><div><strong>${trip.maxPax} pax (${m.spotsRemaining} libere)</strong></div></div>
        </div>
        <hr class="divider">
        <p class="muted small">Note operaționale: ${esc(trip.notes || '-')}</p>
        <div class="form-actions" style="margin-top:12px">
          <button type="button" class="btn btn-secondary btn-sm" id="edit-trip-btn">Editează structura de cost</button>
        </div>
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
          <p class="muted small">${esc(trip.destination)} · ${esc(trip.dates)} · ${m.confirmedPax}/${trip.maxPax} locuri confirmate</p>
        </div>
        <div class="header-actions no-print">
          <button type="button" class="btn btn-secondary btn-sm" id="edit-trip-top-btn">Editează sejur</button>
          <button type="button" class="btn btn-accent btn-sm" id="apply-to-trip-btn">+ Aplică client (Simulare)</button>
        </div>
      </div>
      <div class="econ-grid">
        <div class="econ-box">
          <div class="econ-label">Cost / pax</div>
          <div class="econ-value">${fmtMoney(trip.costPerPax, trip.currency)}</div>
        </div>
        <div class="econ-box">
          <div class="econ-label">Preț / pax</div>
          <div class="econ-value">${fmtMoney(trip.pricePerPax, trip.currency)}</div>
        </div>
        <div class="econ-box">
          <div class="econ-label">Cost total (${m.basisPax} pax)</div>
          <div class="econ-value">${fmtMoney(m.totalCost, trip.currency)}</div>
        </div>
        <div class="econ-box">
          <div class="econ-label">Încasări estimate</div>
          <div class="econ-value">${fmtMoney(m.totalRevenue, trip.currency)}</div>
        </div>
        <div class="econ-box is-profit">
          <div class="econ-label">Profit estimat</div>
          <div class="econ-value">${m.profit >= 0 ? '+' : ''}${fmtMoney(m.profit, trip.currency)} (${m.marginPct}%)</div>
        </div>
      </div>
    </div>

    <div class="sub-tabs no-print">
      <button type="button" class="sub-tab-btn ${state.activeCenterTab === 'applicants' ? 'is-active' : ''}" data-center-tab="applicants">Aplicanți (${tripApps.length})</button>
      <button type="button" class="sub-tab-btn ${state.activeCenterTab === 'costs' ? 'is-active' : ''}" data-center-tab="costs">Structură costuri</button>
      <button type="button" class="sub-tab-btn ${state.activeCenterTab === 'offer' ? 'is-active' : ''}" data-center-tab="offer">Ofertă Master &amp; Print</button>
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

  rail.innerHTML = `
    <div class="rail-header" style="padding:0 0 10px">
      <span>Aplicant selectat</span>
      <span class="${qualBadgeClass(app.qualificationStatus)}">${esc(app.qualificationStatus)}</span>
    </div>
    <div>
      <strong style="font-size:1.02rem">${esc(cust.name)}</strong>
      <div class="muted small">${esc(cust.channel)} · ${pax} pax · Buget ${fmtMoney(app.budgetPerPax, trip.currency)}/pax</div>
    </div>
    <div class="card" style="padding:12px;background:var(--bg)">
      <div class="small muted">Calificare automată:</div>
      <div class="small" style="margin-top:4px">${esc((app.qualificationReasons || []).join('; '))}</div>
      <hr class="divider">
      <div class="small">Total pachet: <strong>${fmtMoney(total, trip.currency)}</strong></div>
      <div class="small muted">Cost furnizor: ${fmtMoney(cost, trip.currency)}</div>
      <div class="small profit-text">Profit: +${fmtMoney(profit, trip.currency)}</div>
    </div>
    <div class="form-actions">
      <button type="button" class="btn btn-primary btn-sm" id="rail-advance-btn">Avansează etapa →</button>
      <button type="button" class="btn btn-secondary btn-sm" id="rail-wa-btn">Copiază WhatsApp</button>
    </div>
    <div class="rail-header" style="padding:10px 0 6px"><span>Activitate &amp; Note</span></div>
    <form id="rail-note-form" class="form-actions">
      <input id="rail-note-input" class="input" placeholder="Adaugă notă rapidă..." aria-label="Adaugă notă rapidă">
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

  const btn = e.target.closest('button');
  if (!btn) return;

  if (btn.id === 'new-trip-btn') openTripModal();
  else if (btn.id === 'edit-trip-top-btn' || btn.id === 'edit-trip-btn') {
    const trip = state.trips.find((t) => t.id === state.selectedTripId);
    if (trip) openTripModal(trip);
  } else if (btn.id === 'apply-to-trip-btn') {
    openApplyModal();
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
    const text =
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
  }
});

/* ---------------- MODALS ---------------- */

const modalEl = document.getElementById('app-modal');
const modalTitleEl = document.getElementById('modal-title');
const modalFieldsEl = document.getElementById('modal-fields');
const modalErrorEl = document.getElementById('modal-error');
const modalFormEl = document.getElementById('modal-form');

function closeModal() {
  modalEl.hidden = true;
  activeModal = null;
  modalErrorEl.hidden = true;
}

document.getElementById('modal-close-btn').addEventListener('click', closeModal);
document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
modalEl.addEventListener('click', (e) => {
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
  modalFieldsEl.innerHTML = `
    <p class="muted small">Simulează aplicarea unui client (stil ATS). Sistemul califică automat aplicantul în funcție de buget (${trip.pricePerPax} ${trip.currency}/pax) și locuri.</p>
    <div class="field"><label for="a-name">Nume client (sintetic) *</label><input id="a-name" name="name" class="input" required placeholder="ex. Andrei Demo"></div>
    <div class="two-col-tight">
      <div class="field"><label for="a-pax">Nr. persoane</label><input id="a-pax" name="pax" type="number" min="1" class="input" value="2"></div>
      <div class="field"><label for="a-budget">Buget / pax (${esc(trip.currency)})</label><input id="a-budget" name="budgetPerPax" type="number" min="0" class="input" value="${esc(trip.pricePerPax)}"></div>
    </div>
    <div class="field"><label for="a-channel">Canal</label><select id="a-channel" name="channel" class="input"><option>Formular Sejur</option><option>WhatsApp</option><option>Instagram</option><option>Email</option></select></div>
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

modalFormEl.addEventListener('submit', (e) => {
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
      state.trips.unshift({ id, ...payload });
      state.selectedTripId = id;
    }
    showToast('Sejur salvat.');
  } else if (activeModal.type === 'apply') {
    if (!data.name?.trim()) return showError('Numele clientului este obligatoriu.');
    const trip = state.trips.find((t) => t.id === activeModal.tripId);
    const metrics = computeMasterTripMetrics(trip, state.applications);
    const cust = { id: uid('cust'), name: data.name.trim(), channel: data.channel, note: 'Aplicant sejur' };
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
      stage: qual.suggestedStage,
      qualificationStatus: qual.status,
      qualificationReasons: qual.reasons,
      appliedAt: new Date().toISOString().slice(0, 10),
      notes: [`Azi · ${qual.status}: ${qual.reasons.join('; ')}`],
    });
    state.selectedAppId = appId;
    showToast(`Aplicant adăugat: ${qual.status}`);
  } else if (activeModal.type === 'task') {
    if (!data.title?.trim()) return showError('Titlul este obligatoriu.');
    state.tasks.unshift({ id: uid('tsk'), title: data.title.trim(), dueDate: data.dueDate, done: false, tripId: data.tripId });
    showToast('Sarcină adăugată.');
  }

  saveState();
  closeModal();
  renderAll();
});

/* ---------------- CSV & BACKUP ---------------- */

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
    headers = ['sejur', 'client', 'pax', 'buget_pax', 'calificare', 'etapa'];
    rows = state.applications.map((a) => ({
      sejur: state.trips.find((t) => t.id === a.tripId)?.title || '',
      client: getCustomer(a.customerId).name,
      pax: a.pax,
      buget_pax: a.budgetPerPax,
      calificare: a.qualificationStatus,
      etapa: a.stage,
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

document.getElementById('csv-file-input').addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (f) previewCsv(await f.text());
});

document.getElementById('csv-sample-btn').addEventListener('click', () => {
  previewCsv(
    [
      'client,destinatie,data_plecare,buget,moneda',
      'Ioana Demo,Svalbard,2027-03-14,1900,EUR',
      ',Roma,14-03-2027,-10,GBP',
    ].join('\n')
  );
});

document.getElementById('csv-commit-btn').addEventListener('click', () => {
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

document.getElementById('backup-json-btn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `garlic-demo-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('restore-json-input').addEventListener('change', async (e) => {
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

document.getElementById('reset-demo-btn').addEventListener('click', () => {
  state = createSeedState();
  saveState();
  renderAll();
  showToast('Date demo Garlic Trips resetate.');
});

renderAll();
