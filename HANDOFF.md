# TravelAgencyOS — Handoff Log

**Last updated:** 16 November 2026  
**Stage:** Local MVP Prototype (not production-ready; `localStorage` only)

## Current State

- Dependency-free Node.js 20+ server (`server.mjs`) serving `public/` on `http://127.0.0.1:4173`.
- Optional Gemini offer-draft proxy (`POST /api/offer-draft`) with server-side `GEMINI_API_KEY`, 10 req/min rate limit, and strict input minimization.
- **Trip-First ATS Workspace (Garlic Trips Demo)** (`public/index.html`, `public/styles.css`, `public/app.js`, `public/trip-utils.js`):
  - **Garlic Trail-inspired palette** (pine `#1B3B2B`, warm parchment `#FAF8F4`, terracotta `#C85A32`, emerald profit badges).
  - **Master Trips** as the primary object (`Svalbard Arctic Expedition`, `Maramureș & Bucovina Trail`, `Vietnam & Cambodgia`) with live **Cost / Revenue / Profit** calculation (`computeMasterTripMetrics`).
  - **Trip Posting & Public Agency Board (`/?board=1`, `/?apply=<tripId>`)** (`Anunț Public` tab, `buildPublicTripPostingView`, `autoQualifyApplication`): manage `Draft` / `Publicat` / `Locuri epuizate` / `Arhivat`, edit public summary & inclusions, configure custom Da/Nu qualification criteria per trip, and publish on a clean public trip board without exposing internal costs or margins.
  - **Supplier Cut-Offs & Payment Tranches** (`Costuri & Furnizori` tab): track `Rooming cut-off`, `Avans furnizor`, and `Sold furnizor` deadlines with overdue/soon badges, plus 1-click `Avans 30%` toggle per applicant.
  - **Multi-Accommodation Rooming & Inventory** (`Camere` tab, `analyzeRooming`, `buildHotelRoomingRows`): add multiple stays per Master Trip (each with `Double/Twin` & `Single` room counts), copy rooming from Stay 1, detect unpaired `Twin (Partajabil)` (`Caută coleg(ă)`) or over-allocated inventory, and export hotel-ready Rooming CSV per stay stripped of internal pricing.
  - **Document Story, Versioning & Auto-Assembly** (`Documente` tab, `buildGeneratedDocumentText`): auto-generate **Client Itinerary (`Itinerariu & Cazări`)** and **Supplier Rooming Sheet (`Borderou Camere`)** from live Master Trip stays & rooms, open directly in PDF print view (`Deschide PDF`), track `v1 → v2` versions, `Client` vs `Furnizor` audience, and sent history log.
  - **Offer Master & Print/PDF** tab with optional Gemini AI draft, WhatsApp copy, and `@media print`.
  - **Messaging Templates** (`public/template-utils.js`): 5 Romanian WhatsApp/Email templates (`Confirmare aplicare`, `Ofertă & Avans`, `Propunere coleg Twin`, `Reminder plată`, `Checklist pre-plecare`) with auto-interpolation, clipboard copy, and `mailto:` launch.
  - **Two-Way Excel (.csv) Local Sync** (`CSV` tab): bind a local `.csv` file via File System Access API (`showSaveFilePicker`) to both write updates (`Scrie în Excel`) and pull edits made in Excel (`Citește din Excel`).
  - **Server-Side Public Trip API & Local Persistence (`server.mjs`)**: `GET /api/public/trips` (strictly strips `costPerPax`, `fixedCost`, and profit on the server), `POST /api/public/apply` (validates & auto-qualifies applicant server-side), and `GET/PUT /api/state` (`.local-store.json`, gitignored).
  - **Email-to-Deadline / Task Parser (`+ Din Email`)** (`parseInboundEmailText` in `public/template-utils.js`): extracts dates (`DD.MM.YYYY` / `YYYY-MM-DD`) and amounts (`EUR`/`RON`/`USD`) from pasted supplier emails and converts them into a Supplier Deadline or Task in 1 click, plus automatic timeline logging when copying WhatsApp templates.
  - **Billing Export & Social Promo Copy** (`buildBillingExportRows`, `buildSocialPostText`): 1-click `Export Facturare (.csv)` (with 30% deposit vs remaining balance and accountant review note for SmartBill/Saga) in `Costuri & Furnizori`, `Postare Social` copy in `Anunț Public`, and quick filter pills (`Toți` / `● OK` / `Avans / Confirmat`) in `Aplicanți`.
  - **GDPR Export & Deletion** (`Clienți` tab): 1-click JSON data export (`Export JSON`) and cascade deletion (`Șterge`) per customer.
  - **Tasks & Due Dates**, **Synthetic Customers**, **CSV Export/Import** (`public/csv-utils.js`), and **JSON Backup/Restore**.
- Automated tests (`tests/app.test.mjs`) passing via `npm test` (16/16 passing offline).

## Next Priorities (for Claude or Antigravity)

1. **Trip Posting & Custom Qualification Questions (`PRD.md` §1):** Upgrade `/?apply=` into full `TripPosting` records (`Draft` / `Publicat` / `Locuri epuizate`) with custom per-trip qualification questions and an agency public trip board.
2. **Supplier Cut-Offs & Payment Tranches (`PRD.md` §3):** Add hotel/airline release dates and deposit tranches per Master Trip.
3. **Agency Discovery Interviews:** Validate the GarlicOS Trip-First ATS + Rooming + Excel sync with 3–5 Romanian agencies (`DISCOVERY.md`) before committing to Phase 1 hosting.
4. **Phase 1 Authenticated Backend (`ARCHITECTURE.md` §2–4):** Implement SQLite + Litestream (or EU Postgres), auth/tenancy, GDPR export/delete, and Gmail/Sheets sync only after discovery + privacy review.
5. **Compliance Gate (`COMPLIANCE.md`):** Have a Romanian accountant verify ANAF/e-Factura and travel-agency VAT margin rules before adding invoicing.
