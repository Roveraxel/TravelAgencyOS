/**
 * Calcule financiare pentru Master Trip și calificare automată a aplicanților (stil ATS).
 */

export const APPLICATION_STAGES = [
  'Aplicat',
  'Calificat',
  'Ofertă trimisă',
  'Avans achitat',
  'Confirmat',
  'Respins',
];

export const ROOM_TYPES = [
  'Double',
  'Twin (Partajabil)',
  'Single',
  'Triple',
];

export const POSTING_STATUSES = [
  'Draft',
  'Publicat',
  'Locuri epuizate',
  'Arhivat',
];

export const DEADLINE_KINDS = [
  'Rooming cut-off',
  'Avans furnizor',
  'Sold furnizor',
];

const ACTIVE_REVENUE_STAGES = new Set(['Ofertă trimisă', 'Avans achitat', 'Confirmat']);
const CONFIRMED_STAGES = new Set(['Avans achitat', 'Confirmat']);

/**
 * Calculează automat indicatorii financiari ai unui Master Trip pe baza aplicanților.
 */
export function computeMasterTripMetrics(trip, applications = []) {
  const tripApps = applications.filter((a) => a.tripId === trip.id && a.stage !== 'Respins');
  const confirmedPax = tripApps
    .filter((a) => CONFIRMED_STAGES.has(a.stage))
    .reduce((sum, a) => sum + Number(a.pax || 1), 0);

  const pipelinePax = tripApps
    .filter((a) => ACTIVE_REVENUE_STAGES.has(a.stage))
    .reduce((sum, a) => sum + Number(a.pax || 1), 0);

  const costPerPax = Number(trip.costPerPax || 0);
  const pricePerPax = Number(trip.pricePerPax || 0);
  const fixedCost = Number(trip.fixedCost || 0);

  const basisPax = confirmedPax > 0 ? confirmedPax : pipelinePax;
  const totalCost = basisPax * costPerPax + (basisPax > 0 ? fixedCost : 0);
  const totalRevenue = basisPax * pricePerPax;
  const profit = totalRevenue - totalCost;
  const marginPct = totalRevenue > 0 ? Math.round((profit / totalRevenue) * 100) : 0;

  return {
    applicantsCount: tripApps.length,
    confirmedPax,
    pipelinePax,
    basisPax,
    totalCost,
    totalRevenue,
    profit,
    marginPct,
    spotsRemaining: Math.max(0, Number(trip.maxPax || 0) - confirmedPax),
  };
}

/**
 * Califică automat un aplicant la un Master Trip (stil ATS: Greenhouse/Lever).
 * Returnează { status: 'Calificat automat' | 'Necesită verificare' | 'Buget sub prag', reasons: string[], suggestedStage: string }.
 */
export function autoQualifyApplication(trip, application, currentConfirmedPax = 0) {
  const reasons = [];
  const pax = Number(application.pax || 1);
  const budgetPerPax = Number(application.budgetPerPax || 0);
  const pricePerPax = Number(trip.pricePerPax || 0);
  const maxPax = Number(trip.maxPax || 0);

  if (maxPax > 0 && currentConfirmedPax + pax > maxPax) {
    reasons.push(`Depășește locurile disponibile (${currentConfirmedPax}/${maxPax} ocupate)`);
  }

  if (budgetPerPax > 0 && pricePerPax > 0 && budgetPerPax < pricePerPax * 0.85) {
    reasons.push(`Buget (${budgetPerPax} ${trip.currency}) sub pragul sejurului (${pricePerPax} ${trip.currency})`);
    return {
      status: 'Buget sub prag',
      reasons,
      suggestedStage: 'Aplicat',
    };
  }

  const questions = Array.isArray(trip.customQuestions) ? trip.customQuestions : [];
  const answers = application.answers && typeof application.answers === 'object' ? application.answers : {};
  for (const q of questions) {
    if (q.requiredAnswer && answers[q.id] && answers[q.id] !== q.requiredAnswer) {
      reasons.push(`Criteriu: ${q.label} (${answers[q.id]})`);
    }
  }

  if (reasons.length > 0) {
    return {
      status: 'Necesită verificare',
      reasons,
      suggestedStage: 'Aplicat',
    };
  }

  reasons.push('Buget și locuri compatibile cu sejurul');
  return {
    status: 'Calificat automat',
    reasons,
    suggestedStage: 'Calificat',
  };
}

/**
 * Construiește proiecția publică a unui Master Trip (fără costPerPax, fixedCost, profit sau note interne).
 */
export function buildPublicTripPostingView(trip, applications = []) {
  const metrics = computeMasterTripMetrics(trip, applications);
  const status =
    trip.postingStatus === 'Publicat' && metrics.spotsRemaining === 0
      ? 'Locuri epuizate'
      : trip.postingStatus || 'Publicat';

  return {
    id: trip.id,
    title: trip.title,
    destination: trip.destination,
    dates: trip.dates,
    coverTheme: trip.coverTheme || 'forest',
    coverImageUrl: trip.coverImageUrl || '',
    pricePerPax: Number(trip.pricePerPax || 0),
    currency: trip.currency || 'EUR',
    style: trip.style || '',
    postingStatus: status,
    publicSummary: trip.publicSummary || trip.style || '',
    highlights: Array.isArray(trip.highlights) ? trip.highlights : [],
    faqs: Array.isArray(trip.faqs) ? trip.faqs : [],
    paymentTerms: trip.paymentTerms || 'Avans 30% la confirmare, rest cu 30 de zile înainte de plecare [DE CONFIRMAT].',
    includedText: trip.includedText || 'Cazare, ghid însoțitor, organizare grup',
    excludedText: trip.excludedText || 'Cheltuieli personale, asigurare medicală/storno',
    customQuestions: Array.isArray(trip.customQuestions) ? trip.customQuestions : [],
    spotsRemaining: metrics.spotsRemaining,
    maxPax: Number(trip.maxPax || 0),
  };
}

/**
 * Grupează aplicanții unui sejur pe camere (opțional pentru o cazare specifică `stay`)
 * și verifică inventarul de camere Double/Twin vs Single.
 */
export function analyzeRooming(tripApplications = [], customers = [], stay = null) {
  const custMap = new Map(customers.map((c) => [c.id, c.name]));
  const active = tripApplications.filter((a) => a.stage !== 'Respins');
  const roomMap = new Map();

  for (const app of active) {
    const staySlot = stay?.id && app.roomByStay?.[stay.id] ? app.roomByStay[stay.id] : app;
    const code = (staySlot.roomCode || '').trim() || 'Neasignat';
    const rType = staySlot.roomType || app.roomType || 'Double';

    if (!roomMap.has(code)) {
      roomMap.set(code, {
        roomCode: code,
        roomType: rType,
        pax: 0,
        guests: [],
      });
    }
    const entry = roomMap.get(code);
    entry.pax += Number(app.pax || 1);
    entry.guests.push(custMap.get(app.customerId) || 'Client');
    entry.roomType = rType;
  }

  const rooms = [...roomMap.values()].map((r) => {
    let alert = '';
    if (r.roomCode === 'Neasignat') {
      alert = 'Necesită alocare';
    } else if (r.roomType === 'Twin (Partajabil)' && r.pax === 1) {
      alert = 'Caută coleg(ă)';
    } else if ((r.roomType === 'Double' || r.roomType === 'Twin (Partajabil)') && r.pax > 2) {
      alert = 'Depășește 2 pax';
    } else if (r.roomType === 'Single' && r.pax > 1) {
      alert = 'Single cu >1 pax';
    }
    return { ...r, alert };
  });

  const assigned = rooms.filter((r) => r.roomCode !== 'Neasignat');
  const usedSingle = assigned.filter((r) => r.roomType === 'Single').length;
  const usedDouble = assigned.filter((r) => r.roomType !== 'Single').length;
  const maxSingle = stay ? Number(stay.singleRooms ?? 0) : null;
  const maxDouble = stay ? Number(stay.doubleRooms ?? 0) : null;

  const inventoryWarnings = [];
  if (maxDouble !== null && usedDouble > maxDouble) {
    inventoryWarnings.push(`Depășire Double/Twin: ${usedDouble}/${maxDouble}`);
  }
  if (maxSingle !== null && usedSingle > maxSingle) {
    inventoryWarnings.push(`Depășire Single: ${usedSingle}/${maxSingle}`);
  }

  const unpairedShareCount = rooms.filter((r) => r.alert === 'Caută coleg(ă)').length;
  return {
    rooms,
    unpairedShareCount,
    usedDouble,
    usedSingle,
    maxDouble,
    maxSingle,
    inventoryWarnings,
  };
}

/**
 * Construiește rândurile pentru exportul Rooming List către hotel/furnizor,
 * eliminând complet prețurile, costurile și marja agenției.
 */
export function buildHotelRoomingRows(tripApplications = [], customers = [], stay = null) {
  const { rooms } = analyzeRooming(tripApplications, customers, stay);
  return rooms
    .filter((r) => r.roomCode !== 'Neasignat')
    .map((r) => ({
      cazare: stay ? `${stay.name} (${stay.nights}n)` : 'Sejur',
      camera: r.roomCode,
      tip_camera: r.roomType,
      oaspeti: r.guests.join(' + '),
      pax: r.pax,
      observatii: r.alert || 'OK',
    }));
}

/**
 * Asamblează automat documentul text pentru Client (Itinerariu & Cazări, fără costuri interne)
 * sau pentru Furnizor (Borderou Camere pe cazări, fără tarife de vânzare către client).
 */
export function buildGeneratedDocumentText(kind, trip, tripApplications = [], customers = []) {
  const stays = Array.isArray(trip.stays) && trip.stays.length > 0 ? trip.stays : [];

  if (kind === 'supplier_rooming') {
    const stayBlocks =
      stays.length === 0
        ? ['Fără cazări definite încă.']
        : stays.map((s) => {
            const rows = buildHotelRoomingRows(tripApplications, customers, s);
            const lines =
              rows.length === 0
                ? ['  - Nicio cameră alocată încă']
                : rows.map((r) => `  - ${r.camera} (${r.tip_camera}, ${r.pax} pax): ${r.oaspeti}`);
            return [`${s.name} (${s.nights} nopți) [Alocare: ${s.doubleRooms} DBL, ${s.singleRooms} SGL]`, ...lines].join('\n');
          });

    return [
      `BORDEROU CAMERE FURNIZOR — ${trip.title}`,
      `Destinație: ${trip.destination}`,
      `Perioadă: ${trip.dates}`,
      ``,
      ...stayBlocks,
    ].join('\n\n');
  }

  const pub = buildPublicTripPostingView(trip, tripApplications);
  const stayLines =
    stays.length === 0
      ? ['  - Cazare conform programului [DE CONFIRMAT]']
      : stays.map((s, idx) => `  ${idx + 1}. ${s.name} — ${s.nights} nopți`);

  return [
    `FIȘĂ ITINERARIU & CAZĂRI (CLIENT) — ${pub.title}`,
    `Destinație: ${pub.destination}`,
    `Perioadă: ${pub.dates}`,
    `Tarif pachet: ${pub.pricePerPax} ${pub.currency} / persoană [DE CONFIRMAT]`,
    ``,
    `REZUMAT PROGRAM:`,
    pub.publicSummary || '-',
    ``,
    `CAZĂRI ÎN CIRCUIT:`,
    ...stayLines,
    ``,
    `INCLUS ÎN TARIF: ${pub.includedText}`,
    `NEINCLUS: ${pub.excludedText}`,
  ].join('\n');
}

/**
 * Generează rânduri pregătitoare pentru facturare (ex. import în SmartBill / Saga),
 * marcând explicit că tratamentul TVA / e-Factura necesită validare contabilă.
 */
export function buildBillingExportRows(trip, tripApplications = [], customers = []) {
  const custMap = new Map(customers.map((c) => [c.id, c.name]));
  const billable = tripApplications.filter((a) =>
    ['Ofertă trimisă', 'Avans achitat', 'Confirmat'].includes(a.stage)
  );

  return billable.map((a) => {
    const pax = Number(a.pax || 1);
    const unitPrice = Number(trip.pricePerPax || 0);
    const total = pax * unitPrice;
    const depositAmount = Math.round(total * 0.3);
    const paid = a.depositPaid ? depositAmount : a.stage === 'Confirmat' ? total : 0;
    const remaining = Math.max(0, total - paid);

    return {
      client: custMap.get(a.customerId) || 'Client',
      serviciu_sejur: `${trip.title} (${trip.dates || ''})`.trim(),
      pax,
      pret_pax: unitPrice,
      total,
      avans_30_proc: depositAmount,
      incasat: paid,
      rest_plata: remaining,
      moneda: trip.currency || 'EUR',
      etapa: a.stage,
      nota_contabila: '[DE CONFIRMAT REGIM TVA / MARJA CU CONTABILUL]',
    };
  });
}

/**
 * Generează text scurt de promovare pentru WhatsApp / Instagram cu link direct de aplicare.
 */
export function buildSocialPostText(trip, tripApplications = [], originUrl = 'http://127.0.0.1:4173') {
  const pub = buildPublicTripPostingView(trip, tripApplications);
  const link = `${originUrl.replace(/\/$/, '')}/?apply=${encodeURIComponent(trip.id)}`;
  return [
    `${pub.title} — ${pub.destination}`,
    `Perioadă: ${pub.dates} · ${pub.spotsRemaining} locuri libere`,
    `${pub.publicSummary}`,
    `Tarif orientativ: ${pub.pricePerPax} ${pub.currency}/pers. [DE CONFIRMAT]`,
    `Înscriere rapidă: ${link}`,
  ].join('\n');
}

/**
 * Clonează un Master Trip (inclusiv cazări, inventar camere și întrebări de calificare)
 * ca ediție nouă în status „Draft”, fără aplicanți.
 */
export function cloneMasterTrip(trip, newId, makeStayId = (i) => `${newId}-stay-${i + 1}`) {
  const stays = Array.isArray(trip.stays)
    ? trip.stays.map((s, idx) => ({
        ...s,
        id: makeStayId(idx),
      }))
    : [];

  const customQuestions = Array.isArray(trip.customQuestions)
    ? trip.customQuestions.map((q) => ({ ...q }))
    : [];

  return {
    ...trip,
    id: newId,
    title: `${trip.title} (Ediție nouă)`,
    postingStatus: 'Draft',
    stays,
    customQuestions,
  };
}

/**
 * Calculează indicatorii globali de Analytics (profit, venituri, ocupare, funnel și calificare).
 */
export function computeAnalytics(trips = [], applications = []) {
  let totalRevenue = 0;
  let totalCost = 0;
  let totalProfit = 0;
  let totalMaxPax = 0;
  let totalConfirmedPax = 0;

  const byTrip = trips.map((t) => {
    const m = computeMasterTripMetrics(t, applications);
    totalRevenue += m.totalRevenue;
    totalCost += m.totalCost;
    totalProfit += m.profit;
    totalMaxPax += Number(t.maxPax || 0);
    totalConfirmedPax += m.confirmedPax;
    return {
      id: t.id,
      title: t.title,
      currency: t.currency || 'EUR',
      revenue: m.totalRevenue,
      cost: m.totalCost,
      profit: m.profit,
      confirmedPax: m.confirmedPax,
      maxPax: Number(t.maxPax || 0),
    };
  });

  const activeApps = applications.filter((a) => a.stage !== 'Respins');
  const autoQualifiedCount = activeApps.filter((a) => a.qualificationStatus === 'Calificat automat').length;
  const qualificationRatePct = activeApps.length > 0 ? Math.round((autoQualifiedCount / activeApps.length) * 100) : 0;
  const occupancyPct = totalMaxPax > 0 ? Math.round((totalConfirmedPax / totalMaxPax) * 100) : 0;

  const funnel = APPLICATION_STAGES.filter((s) => s !== 'Respins').map((stage) => ({
    stage,
    count: applications.filter((a) => a.stage === stage).length,
  }));

  return {
    totalRevenue,
    totalCost,
    totalProfit,
    occupancyPct,
    qualificationRatePct,
    totalApplications: activeApps.length,
    byTrip,
    funnel,
  };
}
