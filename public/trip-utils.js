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
 * Grupează aplicanții unui sejur pe camere și detectează camerele Twin partajabile neîmperecheate.
 */
export function analyzeRooming(tripApplications = [], customers = []) {
  const custMap = new Map(customers.map((c) => [c.id, c.name]));
  const active = tripApplications.filter((a) => a.stage !== 'Respins');
  const roomMap = new Map();

  for (const app of active) {
    const code = (app.roomCode || '').trim() || 'Neasignat';
    if (!roomMap.has(code)) {
      roomMap.set(code, {
        roomCode: code,
        roomType: app.roomType || 'Double',
        pax: 0,
        guests: [],
      });
    }
    const entry = roomMap.get(code);
    entry.pax += Number(app.pax || 1);
    entry.guests.push(custMap.get(app.customerId) || 'Client');
    if (app.roomType) entry.roomType = app.roomType;
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

  const unpairedShareCount = rooms.filter((r) => r.alert === 'Caută coleg(ă)').length;
  return { rooms, unpairedShareCount };
}

/**
 * Construiește rândurile pentru exportul Rooming List către hotel/furnizor,
 * eliminând complet prețurile, costurile și marja agenției.
 */
export function buildHotelRoomingRows(tripApplications = [], customers = []) {
  const { rooms } = analyzeRooming(tripApplications, customers);
  return rooms
    .filter((r) => r.roomCode !== 'Neasignat')
    .map((r) => ({
      camera: r.roomCode,
      tip_camera: r.roomType,
      oaspeti: r.guests.join(' + '),
      pax: r.pax,
      observatii: r.alert || 'OK',
    }));
}
