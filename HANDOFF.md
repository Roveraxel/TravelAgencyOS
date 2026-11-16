# TravelAgencyOS — Handoff Log

**Last updated:** 16 November 2026  
**Stage:** Local MVP Prototype (not production-ready; `localStorage` only)

## Current State

- Dependency-free Node.js 20+ server (`server.mjs`) serving `public/` on `http://127.0.0.1:4173`.
- Optional Gemini offer-draft proxy (`POST /api/offer-draft`) with server-side `GEMINI_API_KEY`, 10 req/min rate limit, and strict input minimization.
- **Trip-First ATS Workspace (Garlic Trips Demo)** (`public/index.html`, `public/styles.css`, `public/app.js`, `public/trip-utils.js`):
  - **Garlic Trail-inspired palette** (pine `#1B3B2B`, warm parchment `#FAF8F4`, terracotta `#C85A32`, emerald profit badges).
  - **Master Trips** as the primary object (`Svalbard Arctic Expedition`, `Maramureș & Bucovina Trail`, `Vietnam & Cambodgia`) with live **Cost / Revenue / Profit** calculation (`computeMasterTripMetrics`).
  - **Customer Apply Link (`/?apply=<tripId>`) + Auto-Qualification** (`autoQualifyApplication`): copy a public-style apply link per Master Trip (`Link aplicare`) or use `+ Aplică`; applicants are automatically qualified (`Calificat automat`, `Necesită verificare`, `Buget sub prag`) into the trip's ATS pipeline without exposing internal cost/profit numbers.
  - **Multi-Accommodation Rooming & Inventory** (`Camere` tab, `analyzeRooming`, `buildHotelRoomingRows`): add multiple stays per Master Trip (each with `Double/Twin` & `Single` room counts), copy rooming from Stay 1, detect unpaired `Twin (Partajabil)` (`Caută coleg(ă)`) or over-allocated inventory, and export hotel-ready Rooming CSV per stay stripped of internal pricing.
  - **Document Story & Versioning** (`Documente` tab): track `v1 → v2` versions, `Client` vs `Furnizor` audience, and sent history log.
  - **Offer Master & Print/PDF** tab with optional Gemini AI draft, WhatsApp copy, and `@media print`.
  - **Messaging Templates** (`public/template-utils.js`): 5 Romanian WhatsApp/Email templates (`Confirmare aplicare`, `Ofertă & Avans`, `Propunere coleg Twin`, `Reminder plată`, `Checklist pre-plecare`) with auto-interpolation, clipboard copy, and `mailto:` launch.
  - **Two-Way Excel (.csv) Local Sync** (`CSV` tab): bind a local `.csv` file via File System Access API (`showSaveFilePicker`) to both write updates (`Scrie în Excel`) and pull edits made in Excel (`Citește din Excel`).
  - **Tasks & Due Dates**, **Synthetic Customers**, **CSV Export/Import** (`public/csv-utils.js`), and **JSON Backup/Restore**.
- Automated tests (`tests/app.test.mjs`) passing via `npm test` (11/11 passing offline).

## Next Priorities (for Claude or Antigravity)

1. **Manual browser QA & polish:** Start `npm start`, test all modals, mobile viewport, and Print-to-PDF layout in a real browser.
2. **Agency discovery interviews:** Use `DISCOVERY.md` and `COMPLIANCE.md` alongside agency interviews before locking the paid-pilot scope.
3. **Minimal authenticated backend proposal (before any live pilot):** Design a low-cost persistence + auth layer (e.g. SQLite/Litestream or Postgres/Supabase with EU region) and privacy/GDPR deletion/export workflow — do not implement without user sign-off.
4. **Compliance gate:** Have a Romanian accountant/privacy specialist verify current ANAF/e-Factura and travel-agency VAT margin rules before adding any invoicing or fiscal features.
