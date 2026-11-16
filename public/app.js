import {
  buildCsv,
  parseCsvText,
  validateEnquiryImportRows,
  VALID_CURRENCIES,
  ENQUIRY_STATUSES,
} from '/csv-utils.js';

const STORAGE_KEY = 'travelagencyos_prototype_v1';

const BOOKING_STATUSES = [
  'Opțiune',
  'Confirmată',
  'Achitată parțial',
  'Achitată integral',
  'Anulată',
];

function createSeedState() {
  return {
    customers: [
      { id: 'cust-1', name: 'Familie Demo Ionescu', channel: 'WhatsApp', note: 'Preferă hoteluri family-friendly (date demo)' },
      { id: 'cust-2', name: 'Cuplu Demo Popa', channel: 'Email', note: 'Interesați de city break-uri (date demo)' },
      { id: 'cust-3', name: 'Grup Demo Brașov', channel: 'Telefon', note: '4 adulți, zbor din OTP (date demo)' },
    ],
    enquiries: [
      {
        id: 'enq-1',
        customerId: 'cust-1',
        destination: 'Antalya, Turcia',
        travelDate: '2027-06-15',
        budget: 2400,
        currency: 'EUR',
        source: 'WhatsApp',
        status: 'Ofertată',
        followUpDate: '2026-11-20',
        notes: '2 adulți + 1 copil (6 ani), All Inclusive, zbor direct.',
      },
      {
        id: 'enq-2',
        customerId: 'cust-2',
        destination: 'Roma, Italia',
        travelDate: '2027-04-10',
        budget: 4500,
        currency: 'RON',
        source: 'Email',
        status: 'Nouă',
        followUpDate: '2026-11-18',
        notes: '4 nopți, hotel central 4*, mic dejun.',
      },
      {
        id: 'enq-3',
        customerId: 'cust-3',
        destination: 'Creta, Grecia',
        travelDate: '2027-07-05',
        budget: 3200,
        currency: 'EUR',
        source: 'Recomandare',
        status: 'Convertită',
        followUpDate: '2026-11-25',
        notes: 'Transfer inclus, 2 camere duble.',
      },
    ],
    bookings: [
      {
        id: 'bk-1',
        enquiryId: 'enq-3',
        customerId: 'cust-3',
        destination: 'Creta, Grecia',
        supplier: 'TourOperator Demo',
        travelDate: '2027-07-05',
        amount: 3150,
        currency: 'EUR',
        dueDate: '2026-12-01',
        status: 'Achitată parțial',
      },
    ],
    tasks: [
      {
        id: 'tsk-1',
        title: 'Confirmă feedback ofertă Antalya',
        dueDate: '2026-11-18',
        done: false,
        enquiryId: 'enq-1',
        bookingId: '',
      },
      {
        id: 'tsk-2',
        title: 'Verifică tranșa 2 pentru Creta',
        dueDate: '2026-11-28',
        done: false,
        enquiryId: '',
        bookingId: 'bk-1',
      },
    ],
    offers: [
      {
        id: 'off-1',
        title: 'Schiță demo — Antalya Iunie 2027',
        body: [
          'PROPUNERE ORIENTATIVĂ DE CĂLĂTORIE',
          'Destinație: Antalya, Turcia',
          'Perioadă: 15-22 iunie 2027 [DE CONFIRMAT]',
          'Componență: 2 adulți + 1 copil',
          'Regim masă: All Inclusive [DE CONFIRMAT]',
          'Buget orientativ: 2400 EUR [DE CONFIRMAT]',
          '',
          'Notă: Tarifele și disponibilitatea locurilor se confirmă ferm în momentul rezervării.',
        ].join('\n'),
        updatedAt: '2026-11-16',
      },
    ],
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
      customers: Array.isArray(parsed.customers) ? parsed.customers : [],
      enquiries: Array.isArray(parsed.enquiries) ? parsed.enquiries : [],
      bookings: Array.isArray(parsed.bookings) ? parsed.bookings : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      offers: Array.isArray(parsed.offers) ? parsed.offers : [],
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

function getCustomerName(customerId) {
  return state.customers.find((c) => c.id === customerId)?.name || 'Client nespecificat';
}

function formatMoney(amount, currency) {
  const num = Number(amount || 0);
  return `${num.toLocaleString('ro-RO')} ${esc(currency || 'EUR')}`;
}

function statusBadgeClass(status) {
  if (['Convertită', 'Confirmată', 'Achitată integral'].includes(status)) return 'badge badge-success';
  if (['Pierdută', 'Anulată'].includes(status)) return 'badge badge-danger';
  if (['Opțiune', 'În negociere', 'Achitată parțial'].includes(status)) return 'badge badge-warning';
  return 'badge';
}

/* ---------------- NAVIGATION ---------------- */

function switchView(viewName) {
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    const active = btn.dataset.view === viewName;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('.view-section').forEach((sec) => {
    const active = sec.id === `view-${viewName}`;
    sec.hidden = !active;
    sec.classList.toggle('is-active', active);
  });
  renderAll();
}

document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

document.querySelectorAll('[data-nav-jump]').forEach((btn) => {
  btn.addEventListener('click', () => switchView(btn.dataset.navJump));
});

/* ---------------- RENDERING ---------------- */

function renderAll() {
  renderDashboard();
  renderEnquiries();
  renderBookings();
  renderCustomers();
  renderTasks();
  renderSavedOffers();
}

function renderDashboard() {
  const activeEnquiries = state.enquiries.filter(
    (e) => !['Convertită', 'Pierdută'].includes(e.status)
  );
  const activeBookings = state.bookings.filter((b) => b.status !== 'Anulată');
  const openTasks = state.tasks.filter((t) => !t.done);

  const totalsByCurrency = {};
  for (const b of activeBookings) {
    const cur = b.currency || 'EUR';
    totalsByCurrency[cur] = (totalsByCurrency[cur] || 0) + Number(b.amount || 0);
  }
  const totalsText =
    Object.entries(totalsByCurrency)
      .map(([cur, val]) => `${val.toLocaleString('ro-RO')} ${cur}`)
      .join(' · ') || '0 EUR';

  document.getElementById('dashboard-kpis').innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Cereri active</div>
      <div class="kpi-value">${activeEnquiries.length}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Rezervări active</div>
      <div class="kpi-value">${activeBookings.length}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Valoare rezervări active</div>
      <div class="kpi-value" style="font-size:1.25rem">${esc(totalsText)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Sarcini de făcut</div>
      <div class="kpi-value">${openTasks.length}</div>
    </div>
  `;

  const dashTasksEl = document.getElementById('dashboard-tasks');
  if (openTasks.length === 0) {
    dashTasksEl.innerHTML = '<p class="muted small">Nu aveți sarcini deschise.</p>';
  } else {
    dashTasksEl.innerHTML = `<div class="stack">${openTasks
      .slice(0, 4)
      .map(
        (t) => `
      <div class="task-row">
        <div>
          <strong>${esc(t.title)}</strong>
          <div class="muted small">Scadență: ${esc(t.dueDate || 'Fără termen')}</div>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" data-toggle-task="${esc(t.id)}">Gata</button>
      </div>`
      )
      .join('')}</div>`;
  }

  const dashEnqEl = document.getElementById('dashboard-enquiries');
  if (activeEnquiries.length === 0) {
    dashEnqEl.innerHTML = '<p class="muted small">Nu aveți cereri active.</p>';
  } else {
    dashEnqEl.innerHTML = `<div class="stack">${activeEnquiries
      .slice(0, 4)
      .map(
        (e) => `
      <div class="task-row">
        <div>
          <strong>${esc(e.destination)}</strong> — ${esc(getCustomerName(e.customerId))}
          <div class="muted small">${formatMoney(e.budget, e.currency)} · Follow-up: ${esc(e.followUpDate || '-')}</div>
        </div>
        <span class="${statusBadgeClass(e.status)}">${esc(e.status)}</span>
      </div>`
      )
      .join('')}</div>`;
  }
}

function renderEnquiries() {
  const query = document.getElementById('enquiry-search').value.trim().toLowerCase();
  const statusFilter = document.getElementById('enquiry-status-filter').value;

  const filtered = state.enquiries.filter((e) => {
    if (statusFilter && e.status !== statusFilter) return false;
    if (!query) return true;
    const cName = getCustomerName(e.customerId).toLowerCase();
    return (
      cName.includes(query) ||
      e.destination.toLowerCase().includes(query) ||
      (e.source || '').toLowerCase().includes(query)
    );
  });

  const tbody = document.getElementById('enquiries-tbody');
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="muted">Nicio cerere găsită.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered
    .map(
      (e) => `
    <tr>
      <td><strong>${esc(getCustomerName(e.customerId))}</strong></td>
      <td>
        <div>${esc(e.destination)}</div>
        <div class="muted small">${esc(e.travelDate || 'Dată neprecizată')}</div>
      </td>
      <td>${e.budget ? formatMoney(e.budget, e.currency) : '<span class="muted">-</span>'}</td>
      <td>${esc(e.source || '-')}</td>
      <td><span class="${statusBadgeClass(e.status)}">${esc(e.status)}</span></td>
      <td>${esc(e.followUpDate || '-')}</td>
      <td>
        <div class="header-actions">
          <button type="button" class="btn btn-secondary btn-sm" data-edit-enquiry="${esc(e.id)}">Editează</button>
          ${
            e.status !== 'Convertită'
              ? `<button type="button" class="btn btn-primary btn-sm" data-convert-enquiry="${esc(e.id)}">Convertește</button>`
              : ''
          }
          <button type="button" class="btn btn-ghost btn-sm" data-task-for-enquiry="${esc(e.id)}">+ Sarcină</button>
          <button type="button" class="btn btn-ghost btn-sm" data-offer-from-enquiry="${esc(e.id)}">Schiță</button>
        </div>
      </td>
    </tr>`
    )
    .join('');
}

function renderBookings() {
  const query = document.getElementById('booking-search').value.trim().toLowerCase();
  const statusFilter = document.getElementById('booking-status-filter').value;

  const filtered = state.bookings.filter((b) => {
    if (statusFilter && b.status !== statusFilter) return false;
    if (!query) return true;
    const cName = getCustomerName(b.customerId).toLowerCase();
    return (
      cName.includes(query) ||
      b.destination.toLowerCase().includes(query) ||
      (b.supplier || '').toLowerCase().includes(query)
    );
  });

  const tbody = document.getElementById('bookings-tbody');
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="muted">Nicio rezervare găsită.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered
    .map(
      (b) => `
    <tr>
      <td><strong>${esc(getCustomerName(b.customerId))}</strong></td>
      <td>
        <div>${esc(b.destination)}</div>
        <div class="muted small">${esc(b.travelDate || '-')}</div>
      </td>
      <td>${esc(b.supplier || '-')}</td>
      <td><strong>${formatMoney(b.amount, b.currency)}</strong></td>
      <td>${esc(b.dueDate || '-')}</td>
      <td><span class="${statusBadgeClass(b.status)}">${esc(b.status)}</span></td>
      <td>
        <div class="header-actions">
          <button type="button" class="btn btn-secondary btn-sm" data-edit-booking="${esc(b.id)}">Editează</button>
          <button type="button" class="btn btn-ghost btn-sm" data-task-for-booking="${esc(b.id)}">+ Sarcină</button>
        </div>
      </td>
    </tr>`
    )
    .join('');
}

function renderCustomers() {
  const query = document.getElementById('customer-search').value.trim().toLowerCase();
  const filtered = state.customers.filter((c) => !query || c.name.toLowerCase().includes(query));

  const tbody = document.getElementById('customers-tbody');
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="muted">Niciun client găsit.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered
    .map((c) => {
      const enqCount = state.enquiries.filter((e) => e.customerId === c.id).length;
      const bkCount = state.bookings.filter((b) => b.customerId === c.id).length;
      return `
      <tr>
        <td><strong>${esc(c.name)}</strong></td>
        <td>${esc(c.channel || '-')}</td>
        <td class="muted small">${esc(c.note || '-')}</td>
        <td>${enqCount}</td>
        <td>${bkCount}</td>
        <td>
          <button type="button" class="btn btn-secondary btn-sm" data-edit-customer="${esc(c.id)}">Editează</button>
        </td>
      </tr>`;
    })
    .join('');
}

function renderTasks() {
  const filter = document.getElementById('task-filter').value;
  const filtered = state.tasks.filter((t) => {
    if (filter === 'open') return !t.done;
    if (filter === 'done') return t.done;
    return true;
  });

  const list = document.getElementById('tasks-list');
  if (filtered.length === 0) {
    list.innerHTML = '<div class="card muted small">Nicio sarcină în această categorie.</div>';
    return;
  }

  list.innerHTML = filtered
    .map((t) => {
      const linkParts = [];
      if (t.enquiryId) {
        const enq = state.enquiries.find((e) => e.id === t.enquiryId);
        if (enq) linkParts.push(`Cerere: ${enq.destination}`);
      }
      if (t.bookingId) {
        const bk = state.bookings.find((b) => b.id === t.bookingId);
        if (bk) linkParts.push(`Rezervare: ${bk.destination}`);
      }
      return `
      <div class="task-row ${t.done ? 'is-done' : ''}">
        <div class="task-main">
          <input type="checkbox" ${t.done ? 'checked' : ''} data-toggle-task="${esc(t.id)}" aria-label="Marchează sarcina ${esc(t.title)}">
          <div>
            <strong>${esc(t.title)}</strong>
            <div class="muted small">
              Scadență: ${esc(t.dueDate || 'Fără termen')}
              ${linkParts.length ? ` · ${esc(linkParts.join(' | '))}` : ''}
            </div>
          </div>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" data-delete-task="${esc(t.id)}">Șterge</button>
      </div>`;
    })
    .join('');
}

function renderSavedOffers() {
  const list = document.getElementById('saved-offers-list');
  if (state.offers.length === 0) {
    list.innerHTML = '<p class="muted small">Nu aveți schițe salvate.</p>';
    return;
  }

  list.innerHTML = state.offers
    .map(
      (o) => `
    <div class="task-row">
      <div>
        <strong>${esc(o.title)}</strong>
        <div class="muted small">Actualizată: ${esc(o.updatedAt || '-')}</div>
      </div>
      <div class="header-actions">
        <button type="button" class="btn btn-secondary btn-sm" data-load-offer="${esc(o.id)}">Deschide</button>
        <button type="button" class="btn btn-ghost btn-sm" data-delete-offer="${esc(o.id)}">Șterge</button>
      </div>
    </div>`
    )
    .join('');

  syncOfferPrintPreview();
}

function syncOfferPrintPreview() {
  const title = document.getElementById('offer-editor-title').value.trim();
  const body = document.getElementById('offer-editor-body').value;
  document.getElementById('offer-print-preview').textContent = title ? `${title}\n\n${body}` : body;
}

/* ---------------- FILTERS & DELEGATED EVENTS ---------------- */

['enquiry-search', 'enquiry-status-filter', 'booking-search', 'booking-status-filter', 'customer-search', 'task-filter'].forEach(
  (id) => {
    document.getElementById(id).addEventListener('input', renderAll);
    document.getElementById(id).addEventListener('change', renderAll);
  }
);

document.addEventListener('click', (event) => {
  const btn = event.target.closest('button');
  if (!btn) return;

  if (btn.dataset.openModal) {
    openEntityModal(btn.dataset.openModal);
  } else if (btn.dataset.editEnquiry) {
    const enq = state.enquiries.find((e) => e.id === btn.dataset.editEnquiry);
    if (enq) openEntityModal('enquiry', enq);
  } else if (btn.dataset.convertEnquiry) {
    const enq = state.enquiries.find((e) => e.id === btn.dataset.convertEnquiry);
    if (enq) {
      openEntityModal('booking', {
        enquiryId: enq.id,
        customerId: enq.customerId,
        destination: enq.destination,
        travelDate: enq.travelDate,
        amount: enq.budget || '',
        currency: enq.currency || 'EUR',
        status: 'Opțiune',
      });
    }
  } else if (btn.dataset.taskForEnquiry) {
    const enq = state.enquiries.find((e) => e.id === btn.dataset.taskForEnquiry);
    openEntityModal('task', {
      enquiryId: btn.dataset.taskForEnquiry,
      title: enq ? `Follow-up ofertă ${enq.destination}` : '',
      dueDate: enq?.followUpDate || '',
    });
  } else if (btn.dataset.offerFromEnquiry) {
    const enq = state.enquiries.find((e) => e.id === btn.dataset.offerFromEnquiry);
    if (enq) {
      document.getElementById('offer-destination').value = enq.destination || '';
      document.getElementById('offer-dates').value = enq.travelDate || '';
      document.getElementById('offer-budget').value = enq.budget || '';
      document.getElementById('offer-currency').value = enq.currency || 'EUR';
      document.getElementById('offer-notes').value = enq.notes || '';
      switchView('offers');
    }
  } else if (btn.dataset.editBooking) {
    const bk = state.bookings.find((b) => b.id === btn.dataset.editBooking);
    if (bk) openEntityModal('booking', bk);
  } else if (btn.dataset.taskForBooking) {
    const bk = state.bookings.find((b) => b.id === btn.dataset.taskForBooking);
    openEntityModal('task', {
      bookingId: btn.dataset.taskForBooking,
      title: bk ? `Verifică scadență ${bk.destination}` : '',
      dueDate: bk?.dueDate || '',
    });
  } else if (btn.dataset.editCustomer) {
    const c = state.customers.find((x) => x.id === btn.dataset.editCustomer);
    if (c) openEntityModal('customer', c);
  } else if (btn.dataset.toggleTask) {
    const t = state.tasks.find((x) => x.id === btn.dataset.toggleTask);
    if (t) {
      t.done = !t.done;
      saveState();
      renderAll();
    }
  } else if (btn.dataset.deleteTask) {
    state.tasks = state.tasks.filter((x) => x.id !== btn.dataset.deleteTask);
    saveState();
    renderAll();
  } else if (btn.dataset.loadOffer) {
    const off = state.offers.find((x) => x.id === btn.dataset.loadOffer);
    if (off) {
      document.getElementById('offer-editor-title').value = off.title;
      document.getElementById('offer-editor-body').value = off.body;
      syncOfferPrintPreview();
    }
  } else if (btn.dataset.deleteOffer) {
    state.offers = state.offers.filter((x) => x.id !== btn.dataset.deleteOffer);
    saveState();
    renderSavedOffers();
  } else if (btn.dataset.exportCsv) {
    exportDatasetCsv(btn.dataset.exportCsv);
  }
});

document.addEventListener('change', (event) => {
  const target = event.target;
  if (target.matches('input[type="checkbox"][data-toggle-task]')) {
    const t = state.tasks.find((x) => x.id === target.dataset.toggleTask);
    if (t) {
      t.done = target.checked;
      saveState();
      renderAll();
    }
  }
});

/* ---------------- MODAL CRUD ---------------- */

const modalEl = document.getElementById('app-modal');
const modalTitleEl = document.getElementById('modal-title');
const modalFieldsEl = document.getElementById('modal-fields');
const modalErrorEl = document.getElementById('modal-error');
const modalFormEl = document.getElementById('modal-form');

function closeModal() {
  modalEl.hidden = true;
  activeModal = null;
  modalErrorEl.hidden = true;
  modalErrorEl.textContent = '';
}

document.getElementById('modal-close-btn').addEventListener('click', closeModal);
document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
modalEl.addEventListener('click', (e) => {
  if (e.target === modalEl) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modalEl.hidden) closeModal();
});

function customerOptionsHtml(selectedId) {
  return state.customers
    .map(
      (c) =>
        `<option value="${esc(c.id)}" ${c.id === selectedId ? 'selected' : ''}>${esc(c.name)}</option>`
    )
    .join('');
}

function currencyOptionsHtml(selected) {
  return VALID_CURRENCIES.map(
    (c) => `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`
  ).join('');
}

function openEntityModal(type, existing = null) {
  activeModal = { type, id: existing?.id || null, existing };
  modalErrorEl.hidden = true;

  if (type === 'customer') {
    modalTitleEl.textContent = existing?.id ? 'Editează client' : 'Client nou';
    modalFieldsEl.innerHTML = `
      <div class="field">
        <label for="f-name">Nume / etichetă client *</label>
        <input id="f-name" name="name" class="input" required value="${esc(existing?.name || '')}">
      </div>
      <div class="field">
        <label for="f-channel">Canal preferat</label>
        <select id="f-channel" name="channel" class="input">
          ${['WhatsApp', 'Email', 'Telefon', 'Sediu'].map(
            (ch) => `<option value="${ch}" ${existing?.channel === ch ? 'selected' : ''}>${ch}</option>`
          ).join('')}
        </select>
      </div>
      <div class="field">
        <label for="f-note">Notă (fără date sensibile în prototip)</label>
        <textarea id="f-note" name="note" rows="2" class="input">${esc(existing?.note || '')}</textarea>
      </div>
    `;
  } else if (type === 'enquiry') {
    modalTitleEl.textContent = existing?.id ? 'Editează cerere' : 'Cerere nouă';
    modalFieldsEl.innerHTML = `
      <div class="field">
        <label for="f-customer">Client *</label>
        <select id="f-customer" name="customerId" class="input">${customerOptionsHtml(existing?.customerId)}</select>
      </div>
      <div class="field">
        <label for="f-dest">Destinație *</label>
        <input id="f-dest" name="destination" class="input" required value="${esc(existing?.destination || '')}">
      </div>
      <div class="two-col-tight">
        <div class="field">
          <label for="f-tdate">Dată plecare</label>
          <input id="f-tdate" name="travelDate" type="date" class="input" value="${esc(existing?.travelDate || '')}">
        </div>
        <div class="field">
          <label for="f-fdate">Follow-up</label>
          <input id="f-fdate" name="followUpDate" type="date" class="input" value="${esc(existing?.followUpDate || '')}">
        </div>
      </div>
      <div class="two-col-tight">
        <div class="field">
          <label for="f-budget">Buget</label>
          <input id="f-budget" name="budget" type="number" min="0" class="input" value="${esc(existing?.budget ?? '')}">
        </div>
        <div class="field">
          <label for="f-currency">Monedă</label>
          <select id="f-currency" name="currency" class="input">${currencyOptionsHtml(existing?.currency || 'EUR')}</select>
        </div>
      </div>
      <div class="two-col-tight">
        <div class="field">
          <label for="f-source">Sursă</label>
          <input id="f-source" name="source" class="input" value="${esc(existing?.source || 'WhatsApp')}">
        </div>
        <div class="field">
          <label for="f-status">Status</label>
          <select id="f-status" name="status" class="input">
            ${ENQUIRY_STATUSES.map(
              (s) => `<option value="${s}" ${(existing?.status || 'Nouă') === s ? 'selected' : ''}>${s}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <div class="field">
        <label for="f-notes">Note</label>
        <textarea id="f-notes" name="notes" rows="2" class="input">${esc(existing?.notes || '')}</textarea>
      </div>
    `;
  } else if (type === 'booking') {
    modalTitleEl.textContent = existing?.id ? 'Editează rezervare' : 'Rezervare nouă';
    modalFieldsEl.innerHTML = `
      <input type="hidden" name="enquiryId" value="${esc(existing?.enquiryId || '')}">
      <div class="field">
        <label for="f-customer">Client *</label>
        <select id="f-customer" name="customerId" class="input">${customerOptionsHtml(existing?.customerId)}</select>
      </div>
      <div class="field">
        <label for="f-dest">Destinație *</label>
        <input id="f-dest" name="destination" class="input" required value="${esc(existing?.destination || '')}">
      </div>
      <div class="field">
        <label for="f-supplier">Furnizor / Tour-operator</label>
        <input id="f-supplier" name="supplier" class="input" value="${esc(existing?.supplier || '')}">
      </div>
      <div class="two-col-tight">
        <div class="field">
          <label for="f-tdate">Dată plecare</label>
          <input id="f-tdate" name="travelDate" type="date" class="input" value="${esc(existing?.travelDate || '')}">
        </div>
        <div class="field">
          <label for="f-ddate">Scadență următoare</label>
          <input id="f-ddate" name="dueDate" type="date" class="input" value="${esc(existing?.dueDate || '')}">
        </div>
      </div>
      <div class="two-col-tight">
        <div class="field">
          <label for="f-amount">Valoare *</label>
          <input id="f-amount" name="amount" type="number" min="0" required class="input" value="${esc(existing?.amount ?? '')}">
        </div>
        <div class="field">
          <label for="f-currency">Monedă</label>
          <select id="f-currency" name="currency" class="input">${currencyOptionsHtml(existing?.currency || 'EUR')}</select>
        </div>
      </div>
      <div class="field">
        <label for="f-status">Status</label>
        <select id="f-status" name="status" class="input">
          ${BOOKING_STATUSES.map(
            (s) => `<option value="${s}" ${(existing?.status || 'Opțiune') === s ? 'selected' : ''}>${s}</option>`
          ).join('')}
        </select>
      </div>
    `;
  } else if (type === 'task') {
    modalTitleEl.textContent = 'Sarcină nouă';
    modalFieldsEl.innerHTML = `
      <input type="hidden" name="enquiryId" value="${esc(existing?.enquiryId || '')}">
      <input type="hidden" name="bookingId" value="${esc(existing?.bookingId || '')}">
      <div class="field">
        <label for="f-title">Titlu sarcină *</label>
        <input id="f-title" name="title" class="input" required value="${esc(existing?.title || '')}">
      </div>
      <div class="field">
        <label for="f-due">Dată scadență</label>
        <input id="f-due" name="dueDate" type="date" class="input" value="${esc(existing?.dueDate || '')}">
      </div>
    `;
  }

  modalEl.hidden = false;
  modalFieldsEl.querySelector('input, select')?.focus();
}

modalFormEl.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!activeModal) return;

  const fd = new FormData(modalFormEl);
  const data = Object.fromEntries(fd.entries());

  const showError = (msg) => {
    modalErrorEl.textContent = msg;
    modalErrorEl.hidden = false;
  };

  if (activeModal.type === 'customer') {
    if (!data.name?.trim()) return showError('Numele clientului este obligatoriu.');
    if (activeModal.id) {
      Object.assign(state.customers.find((c) => c.id === activeModal.id), {
        name: data.name.trim(),
        channel: data.channel,
        note: data.note.trim(),
      });
    } else {
      state.customers.unshift({
        id: uid('cust'),
        name: data.name.trim(),
        channel: data.channel,
        note: data.note.trim(),
      });
    }
  } else if (activeModal.type === 'enquiry') {
    if (!data.destination?.trim()) return showError('Destinația este obligatorie.');
    const payload = {
      customerId: data.customerId,
      destination: data.destination.trim(),
      travelDate: data.travelDate,
      followUpDate: data.followUpDate,
      budget: Number(data.budget || 0),
      currency: data.currency || 'EUR',
      source: data.source.trim(),
      status: data.status,
      notes: data.notes.trim(),
    };
    if (activeModal.id) {
      Object.assign(state.enquiries.find((x) => x.id === activeModal.id), payload);
    } else {
      state.enquiries.unshift({ id: uid('enq'), ...payload });
    }
  } else if (activeModal.type === 'booking') {
    if (!data.destination?.trim()) return showError('Destinația este obligatorie.');
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount < 0) return showError('Introduceți o valoare validă.');
    const payload = {
      enquiryId: data.enquiryId || '',
      customerId: data.customerId,
      destination: data.destination.trim(),
      supplier: data.supplier.trim(),
      travelDate: data.travelDate,
      dueDate: data.dueDate,
      amount,
      currency: data.currency || 'EUR',
      status: data.status,
    };
    if (activeModal.id) {
      Object.assign(state.bookings.find((x) => x.id === activeModal.id), payload);
    } else {
      state.bookings.unshift({ id: uid('bk'), ...payload });
      if (payload.enquiryId) {
        const linked = state.enquiries.find((x) => x.id === payload.enquiryId);
        if (linked) linked.status = 'Convertită';
      }
    }
  } else if (activeModal.type === 'task') {
    if (!data.title?.trim()) return showError('Titlul sarcinii este obligatoriu.');
    state.tasks.unshift({
      id: uid('tsk'),
      title: data.title.trim(),
      dueDate: data.dueDate,
      done: false,
      enquiryId: data.enquiryId || '',
      bookingId: data.bookingId || '',
    });
  }

  saveState();
  closeModal();
  renderAll();
});

/* ---------------- OFFER DRAFTS & AI ---------------- */

function readOfferBrief() {
  return {
    destination: document.getElementById('offer-destination').value.trim(),
    dates: document.getElementById('offer-dates').value.trim(),
    travellersCount: document.getElementById('offer-travellers').value.trim(),
    budget: document.getElementById('offer-budget').value.trim(),
    currency: document.getElementById('offer-currency').value,
    style: document.getElementById('offer-style').value.trim(),
    notes: document.getElementById('offer-notes').value.trim(),
  };
}

document.getElementById('generate-template-offer-btn').addEventListener('click', () => {
  const b = readOfferBrief();
  if (!b.destination) {
    document.getElementById('offer-ai-feedback').textContent = 'Completați destinația.';
    return;
  }
  document.getElementById('offer-editor-title').value = `Schiță ofertă — ${b.destination}`;
  document.getElementById('offer-editor-body').value = [
    `PROPUNERE ORIENTATIVĂ DE CĂLĂTORIE`,
    `Destinație: ${b.destination}`,
    `Perioadă: ${b.dates || '[DE CONFIRMAT]'}`,
    `Persoane: ${b.travellersCount || '[DE CONFIRMAT]'}`,
    `Stil / preferințe: ${b.style || '[DE CONFIRMAT]'}`,
    `Buget orientativ: ${b.budget ? `${b.budget} ${b.currency}` : '[DE CONFIRMAT]'}`,
    ``,
    `Varianta 1: [DE CONFIRMAT — hotel, tip cameră, masă, tarif]`,
    `Transport / transfer: [DE CONFIRMAT]`,
    `Note: ${b.notes || '-'}`,
    ``,
    `Notă importantă: Aceasta este o schiță informativă. Disponibilitatea, furnizorii și tarifele finale necesită confirmare fermă.`,
  ].join('\n');
  syncOfferPrintPreview();
});

document.getElementById('offer-brief-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const feedback = document.getElementById('offer-ai-feedback');
  const brief = readOfferBrief();
  feedback.className = 'feedback-msg';
  feedback.textContent = 'Se generează schița AI...';

  try {
    const res = await fetch('/api/offer-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(brief),
    });
    const data = await res.json();
    if (!res.ok) {
      feedback.className = 'feedback-msg is-error';
      feedback.textContent = data.error || 'Nu s-a putut genera schița AI.';
      return;
    }
    document.getElementById('offer-editor-title').value = `Schiță AI — ${brief.destination}`;
    document.getElementById('offer-editor-body').value = data.draft;
    syncOfferPrintPreview();
    feedback.className = 'feedback-msg is-ok';
    feedback.textContent = data.disclaimer || 'Schiță generată.';
  } catch {
    feedback.className = 'feedback-msg is-error';
    feedback.textContent = 'Serverul local nu a răspuns. Folosiți șablonul local.';
  }
});

document.getElementById('offer-editor-title').addEventListener('input', syncOfferPrintPreview);
document.getElementById('offer-editor-body').addEventListener('input', syncOfferPrintPreview);

document.getElementById('save-offer-btn').addEventListener('click', () => {
  const title = document.getElementById('offer-editor-title').value.trim() || 'Schiță fără titlu';
  const body = document.getElementById('offer-editor-body').value.trim();
  if (!body) return;
  state.offers.unshift({
    id: uid('off'),
    title,
    body,
    updatedAt: new Date().toISOString().slice(0, 10),
  });
  saveState();
  renderSavedOffers();
});

document.getElementById('print-offer-btn').addEventListener('click', () => {
  syncOfferPrintPreview();
  window.print();
});

/* ---------------- CSV EXPORT & IMPORT ---------------- */

function exportDatasetCsv(kind) {
  let headers = [];
  let rows = [];
  let filename = `${kind}.csv`;

  if (kind === 'enquiries') {
    headers = ['client', 'destinatie', 'data_plecare', 'buget', 'moneda', 'sursa', 'status', 'follow_up', 'note'];
    rows = state.enquiries.map((e) => ({
      client: getCustomerName(e.customerId),
      destinatie: e.destination,
      data_plecare: e.travelDate,
      buget: e.budget,
      moneda: e.currency,
      sursa: e.source,
      status: e.status,
      follow_up: e.followUpDate,
      note: e.notes,
    }));
  } else if (kind === 'bookings') {
    headers = ['client', 'destinatie', 'furnizor', 'data_plecare', 'valoare', 'moneda', 'scadenta', 'status'];
    rows = state.bookings.map((b) => ({
      client: getCustomerName(b.customerId),
      destinatie: b.destination,
      furnizor: b.supplier,
      data_plecare: b.travelDate,
      valoare: b.amount,
      moneda: b.currency,
      scadenta: b.dueDate,
      status: b.status,
    }));
  } else {
    headers = ['nume', 'canal', 'nota'];
    rows = state.customers.map((c) => ({
      nume: c.name,
      canal: c.channel,
      nota: c.note,
    }));
  }

  const csv = buildCsv(headers, rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function previewCsvImportText(csvText) {
  const parsed = parseCsvText(csvText);
  const enrichedExisting = state.enquiries.map((e) => ({
    ...e,
    customerName: getCustomerName(e.customerId),
  }));
  stagedCsvRows = validateEnquiryImportRows(parsed.rows, enrichedExisting, state.customers);

  const validCount = stagedCsvRows.filter((r) => r.valid).length;
  const dupCount = stagedCsvRows.filter((r) => r.duplicateOfId || r.duplicateInFile).length;

  document.getElementById('csv-preview-card').hidden = false;
  document.getElementById('csv-preview-summary').textContent =
    `${stagedCsvRows.length} rânduri citite · ${validCount} valide · ${dupCount} posibile duplicate`;
  document.getElementById('csv-commit-btn').disabled = validCount === 0;

  document.getElementById('csv-preview-tbody').innerHTML = stagedCsvRows
    .map((r) => {
      let badge = '<span class="badge badge-success">Valid</span>';
      if (!r.valid) {
        badge = `<span class="badge badge-danger">${esc(r.errors.join('; '))}</span>`;
      } else if (r.duplicateOfId || r.duplicateInFile) {
        badge = '<span class="badge badge-warning">Duplicat detectat</span>';
      }
      return `
      <tr>
        <td>${r.line}</td>
        <td>${esc(r.data.customerName || '-')}</td>
        <td>${esc(r.data.destination || '-')}</td>
        <td>${esc(r.data.travelDate || '-')}</td>
        <td>${r.data.budget ? formatMoney(r.data.budget, r.data.currency) : '-'}</td>
        <td>${badge}</td>
      </tr>`;
    })
    .join('');
}

document.getElementById('csv-file-input').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  previewCsvImportText(text);
});

document.getElementById('csv-sample-btn').addEventListener('click', () => {
  const sample = [
    'client,destinatie,data_plecare,buget,moneda,sursa,status,follow_up,note',
    'Client Demo Nou,Tenerife Spania,2027-05-12,2100,EUR,WhatsApp,Nouă,2026-11-22,2 adulți hotel 4*',
    'Familie Demo Ionescu,Antalya Turcia,2027-06-15,2400,EUR,WhatsApp,Ofertată,2026-11-20,Exemplu duplicat',
    ',Lisabona Portugalia,12-05-2027,-100,GBP,Email,Nouă,,Rând invalid pentru test',
  ].join('\n');
  previewCsvImportText(sample);
});

document.getElementById('csv-commit-btn').addEventListener('click', () => {
  const dupMode = document.getElementById('csv-duplicate-mode').value;
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of stagedCsvRows) {
    if (!row.valid) {
      skipped += 1;
      continue;
    }

    if (row.duplicateOfId && dupMode === 'skip') {
      skipped += 1;
      continue;
    }

    let customer = state.customers.find(
      (c) => c.name.trim().toLowerCase() === row.data.customerName.toLowerCase()
    );
    if (!customer) {
      customer = {
        id: uid('cust'),
        name: row.data.customerName,
        channel: row.data.source || 'Import CSV',
        note: 'Creat automat la import CSV',
      };
      state.customers.push(customer);
    }

    if (row.duplicateOfId && dupMode === 'overwrite') {
      const target = state.enquiries.find((e) => e.id === row.duplicateOfId);
      if (target) {
        Object.assign(target, {
          customerId: customer.id,
          destination: row.data.destination,
          travelDate: row.data.travelDate,
          followUpDate: row.data.followUpDate,
          budget: row.data.budget,
          currency: row.data.currency,
          source: row.data.source,
          status: row.data.status,
          notes: row.data.notes,
        });
        updated += 1;
        continue;
      }
    }

    state.enquiries.unshift({
      id: uid('enq'),
      customerId: customer.id,
      destination: row.data.destination,
      travelDate: row.data.travelDate,
      followUpDate: row.data.followUpDate,
      budget: row.data.budget,
      currency: row.data.currency,
      source: row.data.source,
      status: row.data.status,
      notes: row.data.notes,
    });
    imported += 1;
  }

  saveState();
  renderAll();
  document.getElementById('csv-preview-summary').textContent =
    `Import finalizat: ${imported} adăugate, ${updated} actualizate, ${skipped} sărite.`;
  document.getElementById('csv-commit-btn').disabled = true;
});

/* ---------------- INIT ---------------- */

document.getElementById('reset-demo-btn').addEventListener('click', () => {
  state = createSeedState();
  saveState();
  renderAll();
});

async function checkServerHealth() {
  const pill = document.getElementById('ai-status-pill');
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    pill.textContent = data.geminiConfigured
      ? 'Server local · Gemini activ'
      : 'Server local · Mod offline (fără cheie AI)';
  } catch {
    pill.textContent = 'Mod local';
  }
}

checkServerHealth();
renderAll();
