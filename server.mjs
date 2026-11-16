import http from 'node:http';
import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeMasterTripMetrics,
  autoQualifyApplication,
  buildPublicTripPostingView,
} from './public/trip-utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const DEFAULT_STORE_PATH = path.join(__dirname, '.local-store.json');

/**
 * Load key=value pairs from .env if present, without overriding existing env vars.
 */
export function loadDotEnv(envPath = path.join(__dirname, '.env')) {
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 10;
const requestTimestamps = [];

export function checkRateLimit(now = Date.now()) {
  while (requestTimestamps.length > 0 && now - requestTimestamps[0] > RATE_WINDOW_MS) {
    requestTimestamps.shift();
  }
  if (requestTimestamps.length >= RATE_MAX_REQUESTS) {
    return false;
  }
  requestTimestamps.push(now);
  return true;
}

/**
 * Strictly keep only anonymized trip brief fields; never forward names, emails, or phones.
 */
export function sanitizeOfferBrief(input) {
  if (!input || typeof input !== 'object') {
    return { error: 'Date invalide pentru brief-ul de ofertă.' };
  }
  const destination = String(input.destination ?? '').trim().slice(0, 120);
  const dates = String(input.dates ?? '').trim().slice(0, 80);
  const travellersCount = String(input.travellersCount ?? '').trim().slice(0, 40);
  const style = String(input.style ?? '').trim().slice(0, 80);
  const budget = String(input.budget ?? '').trim().slice(0, 40);
  const currency = ['EUR', 'RON', 'USD'].includes(String(input.currency ?? '').toUpperCase())
    ? String(input.currency).toUpperCase()
    : 'EUR';
  const notes = String(input.notes ?? '').trim().slice(0, 400);

  if (!destination) {
    return { error: 'Destinația este obligatorie pentru generarea schiței.' };
  }

  return {
    brief: { destination, dates, travellersCount, style, budget, currency, notes },
  };
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

async function readJsonBody(req, maxBytes = 16_384) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      throw new Error('PAYLOAD_TOO_LARGE');
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(raw || '{}');
}

async function callGeminiOfferDraft(brief) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return {
      status: 503,
      payload: {
        error:
          'Cheia GEMINI_API_KEY nu este configurată pe server. Folosiți șablonul local sau configurați .env pentru schițe AI.',
      },
    };
  }

  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const systemPrompt = [
    'Ești un asistent pentru o agenție de turism independentă din România.',
    'Redactează o SCHIȚĂ de ofertă în limba română, clară, profesionistă și concisă.',
    'REGULI STRICTE:',
    '- Nu inventa disponibilitate, hoteluri specifice neconfirmate, companii aeriene, furnizori, tarife exacte sau condiții contractuale/fiscale.',
    '- Marchează explicit orice element care trebuie verificat de agent cu eticheta [DE CONFIRMAT].',
    '- Păstrează moneda specificată explicit (EUR/RON).',
    '- Nu include sfaturi juridice sau fiscale.',
  ].join('\n');

  const userPrompt = [
    `Destinație: ${brief.destination}`,
    `Perioadă: ${brief.dates || '[DE CONFIRMAT]'}`,
    `Număr persoane: ${brief.travellersCount || '[DE CONFIRMAT]'}`,
    `Stil / preferințe: ${brief.style || 'Standard'}`,
    `Buget orientativ: ${brief.budget ? `${brief.budget} ${brief.currency}` : '[DE CONFIRMAT]'}`,
    `Note suplimentare (anonimizate): ${brief.notes || 'Fără note suplimentare.'}`,
  ].join('\n');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 900 },
    }),
  });

  if (!response.ok) {
    return {
      status: 502,
      payload: {
        error: `Serviciul Gemini a returnat eroarea ${response.status}. Puteți folosi șablonul local de ofertă.`,
      },
    };
  }

  const data = await response.json();
  const draft = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('\n')
    .trim();

  if (!draft) {
    return {
      status: 502,
      payload: {
        error: 'Nu s-a putut extrage un text valid din răspunsul Gemini. Folosiți șablonul local.',
      },
    };
  }

  return {
    status: 200,
    payload: {
      draft,
      model,
      disclaimer:
        'Schiță generată AI pe baza unui brief anonimizat. Verificați disponibilitatea, tarifele și condițiile [DE CONFIRMAT] înainte de trimitere.',
    },
  };
}

export function createAppServer(options = {}) {
  const storePath = options.storePath ?? DEFAULT_STORE_PATH;
  let memoryStore = options.initialState ?? null;

  async function readStore() {
    if (memoryStore) return memoryStore;
    try {
      const raw = await fs.readFile(storePath, 'utf8');
      memoryStore = JSON.parse(raw);
      return memoryStore;
    } catch {
      return null;
    }
  }

  async function writeStore(nextState) {
    memoryStore = nextState;
    if (options.inMemoryOnly) return;
    try {
      await fs.writeFile(storePath, JSON.stringify(nextState, null, 2), 'utf8');
    } catch {
      // Ignore write errors in read-only environments
    }
  }

  return http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url || '/', 'http://localhost');
    const pathname = reqUrl.pathname;

    if (req.method === 'GET' && pathname === '/api/health') {
      return sendJson(res, 200, {
        ok: true,
        mode: 'local-prototype',
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
      });
    }

    if (req.method === 'GET' && pathname === '/api/state') {
      const state = await readStore();
      return sendJson(res, 200, { state });
    }

    if (req.method === 'PUT' && pathname === '/api/state') {
      try {
        const body = await readJsonBody(req, 262_144);
        if (!body || !Array.isArray(body.trips)) {
          return sendJson(res, 400, { error: 'State invalid.' });
        }
        await writeStore(body);
        return sendJson(res, 200, { ok: true });
      } catch {
        return sendJson(res, 400, { error: 'Cerere JSON invalidă.' });
      }
    }

    if (req.method === 'GET' && pathname === '/api/public/trips') {
      const state = await readStore();
      const trips = Array.isArray(state?.trips) ? state.trips : [];
      const apps = Array.isArray(state?.applications) ? state.applications : [];
      const publicTrips = trips
        .map((t) => buildPublicTripPostingView(t, apps))
        .filter((p) => p.postingStatus === 'Publicat' || p.postingStatus === 'Locuri epuizate');
      return sendJson(res, 200, { trips: publicTrips });
    }

    if (req.method === 'POST' && pathname === '/api/public/apply') {
      try {
        const body = await readJsonBody(req);
        const state = await readStore();
        if (!state || !Array.isArray(state.trips)) {
          return sendJson(res, 404, { error: 'Sejurul nu a fost găsit.' });
        }
        const trip = state.trips.find((t) => t.id === body.tripId) || state.trips[0];
        if (!trip) {
          return sendJson(res, 404, { error: 'Sejurul nu există.' });
        }
        const name = String(body.name || '').trim().slice(0, 80);
        if (!name) {
          return sendJson(res, 400, { error: 'Numele este obligatoriu.' });
        }
        const pax = Math.max(1, Number(body.pax || 1));
        const budgetPerPax = Math.max(0, Number(body.budgetPerPax || 0));
        const roomType = String(body.roomType || 'Double');
        const answers = body.answers && typeof body.answers === 'object' ? body.answers : {};

        const metrics = computeMasterTripMetrics(trip, state.applications || []);
        const qual = autoQualifyApplication(trip, { pax, budgetPerPax, answers }, metrics.confirmedPax);

        const custId = `cust-${Date.now().toString(36)}`;
        state.customers = Array.isArray(state.customers) ? state.customers : [];
        state.customers.unshift({ id: custId, name, channel: 'Board Public', note: 'Aplicat online' });

        state.applications = Array.isArray(state.applications) ? state.applications : [];
        state.applications.unshift({
          id: `app-${Date.now().toString(36)}`,
          tripId: trip.id,
          customerId: custId,
          pax,
          budgetPerPax,
          depositPaid: false,
          roomType,
          roomCode: 'Neasignat',
          stage: qual.suggestedStage,
          qualificationStatus: qual.status,
          qualificationReasons: qual.reasons,
          appliedAt: new Date().toISOString().slice(0, 10),
          notes: [`Azi · Aplicat via Board Public (${qual.status})`],
        });
        await writeStore(state);
        return sendJson(res, 200, {
          ok: true,
          qualificationStatus: qual.status,
          suggestedStage: qual.suggestedStage,
        });
      } catch {
        return sendJson(res, 400, { error: 'Date invalide pentru aplicare.' });
      }
    }

    if (req.method === 'POST' && pathname === '/api/offer-draft') {
      if (!checkRateLimit()) {
        return sendJson(res, 429, {
          error: 'Prea multe cereri într-un minut. Așteptați puțin sau folosiți șablonul local.',
        });
      }

      let body;
      try {
        body = await readJsonBody(req);
      } catch (err) {
        const status = err.message === 'PAYLOAD_TOO_LARGE' ? 413 : 400;
        return sendJson(res, status, { error: 'Cerere JSON invalidă.' });
      }

      const sanitized = sanitizeOfferBrief(body);
      if (sanitized.error) {
        return sendJson(res, 400, { error: sanitized.error });
      }

      try {
        const result = await callGeminiOfferDraft(sanitized.brief);
        return sendJson(res, result.status, result.payload);
      } catch {
        return sendJson(res, 502, {
          error: 'Eroare de rețea la apelul Gemini. Folosiți șablonul local de ofertă.',
        });
      }
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendJson(res, 405, { error: 'Metodă neacceptată.' });
    }

    const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const resolvedPath = path.resolve(PUBLIC_DIR, relativePath);
    if (!resolvedPath.startsWith(PUBLIC_DIR + path.sep) && resolvedPath !== PUBLIC_DIR) {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    try {
      const stat = await fs.stat(resolvedPath);
      const filePath = stat.isDirectory() ? path.join(resolvedPath, 'index.html') : resolvedPath;
      const ext = path.extname(filePath).toLowerCase();
      const content = await fs.readFile(filePath);
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
      });
      return res.end(req.method === 'HEAD' ? undefined : content);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  loadDotEnv();
  const port = Number(process.env.PORT) || 4173;
  const server = createAppServer();
  server.listen(port, '127.0.0.1', () => {
    console.log(`TravelAgencyOS (prototip local) pornit la http://127.0.0.1:${port}`);
  });
}
