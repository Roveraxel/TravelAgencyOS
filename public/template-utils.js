/**
 * Șabloane de mesaje WhatsApp / Email cu interpolare automată din Master Trip & Aplicant.
 */

export const MESSAGE_TEMPLATES = [
  {
    id: 'confirm-apply',
    label: 'Confirmare aplicare',
    subject: 'Înscriere {sejur} ({perioada})',
    body: [
      'Bună, {client}!',
      'Am primit aplicarea ta pentru {sejur} ({perioada}, {pax} pers.).',
      'Tariful orientativ este {pret_pax} {moneda}/persoană (total {total} {moneda}) [DE CONFIRMAT].',
      'Revenim în scurt timp cu confirmarea locurilor.',
    ].join('\n'),
  },
  {
    id: 'offer-deposit',
    label: 'Ofertă & Avans',
    subject: 'Ofertă & Detalii avans — {sejur}',
    body: [
      'Bună, {client}!',
      'Locurile pentru {sejur} ({perioada}) sunt disponibile ({locuri_ramase} locuri rămase).',
      'Total pachet ({pax} pers.): {total} {moneda}.',
      'Pentru rezervare fermă este necesar un avans de 30% [DE CONFIRMAT].',
    ].join('\n'),
  },
  {
    id: 'twin-share',
    label: 'Propunere coleg Twin',
    subject: 'Partajare cameră Twin — {sejur}',
    body: [
      'Bună, {client}!',
      'Pentru {sejur}, ai selectat opțiunea Twin (Partajabil).',
      'Avem un alt participant care caută coleg(ă) de cameră — confirmi dacă ești de acord să vă punem împreună pentru a evita suplimentul de Single?',
    ].join('\n'),
  },
  {
    id: 'payment-reminder',
    label: 'Reminder plată',
    subject: 'Reminder tranșă — {sejur}',
    body: [
      'Bună, {client}!',
      'Îți reamintim de scadența următoarei tranșe pentru {sejur} ({perioada}).',
      'Total pachet: {total} {moneda}. Te rugăm să ne confirmi după efectuarea plății.',
    ].join('\n'),
  },
  {
    id: 'pre-departure',
    label: 'Checklist pre-plecare',
    subject: 'Informații plecare — {sejur}',
    body: [
      'Bună, {client}!',
      'Mai este puțin până la plecarea în {sejur} ({perioada})!',
      'Găsești itinerariul final și checklist-ul în documentul atașat. Verifică valabilitatea pașaportului/CI înainte de plecare.',
    ].join('\n'),
  },
];

export function renderMessageTemplate(templateId, context) {
  const tpl = MESSAGE_TEMPLATES.find((t) => t.id === templateId) || MESSAGE_TEMPLATES[0];
  const { trip = {}, app = {}, customer = {}, metrics = {} } = context || {};
  const pax = Number(app.pax || 1);
  const pricePerPax = Number(trip.pricePerPax || 0);
  const total = pax * pricePerPax;

  const vars = {
    '{client}': customer.name || 'Client',
    '{sejur}': trip.title || 'Sejur',
    '{perioada}': trip.dates || '[DE CONFIRMAT]',
    '{pax}': String(pax),
    '{pret_pax}': String(pricePerPax),
    '{total}': String(total),
    '{moneda}': trip.currency || 'EUR',
    '{locuri_ramase}': String(metrics.spotsRemaining ?? ''),
  };

  let subject = tpl.subject;
  let body = tpl.body;
  for (const [token, value] of Object.entries(vars)) {
    subject = subject.replaceAll(token, value);
    body = body.replaceAll(token, value);
  }
  return { subject, body, template: tpl };
}

/**
 * Extrage automat dată scadentă (YYYY-MM-DD sau DD.MM.YYYY) și sumă (EUR/RON/USD)
 * dintr-un email de furnizor/hotel pentru conversie rapidă în Scadență sau Sarcină.
 */
export function parseInboundEmailText(rawText = '') {
  const text = String(rawText || '').trim();
  const firstLine = (text.split(/\r?\n/).find((l) => l.trim()) || 'Email furnizor').trim().slice(0, 90);

  let dueDate = '';
  const isoMatch = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoMatch) {
    dueDate = isoMatch[1];
  } else {
    const roMatch = text.match(/\b(\d{2})[./-](\d{2})[./-](20\d{2})\b/);
    if (roMatch) {
      dueDate = `${roMatch[3]}-${roMatch[2]}-${roMatch[1]}`;
    }
  }

  let amount = 0;
  let currency = 'EUR';
  const moneyMatch = text.match(/\b(\d+(?:[.,]\d+)?)\s*(EUR|RON|USD)\b/i);
  if (moneyMatch) {
    amount = Math.round(Number(moneyMatch[1].replace(',', '.')));
    currency = moneyMatch[2].toUpperCase();
  }

  return {
    title: firstLine,
    dueDate,
    amount,
    currency,
  };
}
