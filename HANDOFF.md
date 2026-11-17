# TravelAgencyOS — Handoff Log

**Last updated:** 16 November 2026  
**Stage:** Local MVP Prototype (not production-ready; `localStorage` only)

## Current State

- Dependency-free Node.js 20+ server (`server.mjs`) serving `public/` on `http://127.0.0.1:4173`.
- Optional Gemini offer-draft proxy (`POST /api/offer-draft`) with server-side `GEMINI_API_KEY`, 10 req/min rate limit, and strict input minimization.
- **Trip-First ATS Workspace (Garlic Trips Demo)** (`public/index.html`, `public/styles.css`, `public/app.js`, `public/trip-utils.js`):
  - **Main Trip Selector -> 3-Pane Client Workspace -> Simple Trip Editor**:
    - **Main Page (`Sejururi`)**: visual Master Trip cards showing cover, dates, pax, and profit (`Deschide →` / `Editează`).
    - **Inside a Trip**: Left = `Clienți` list, Center = `Detalii Client` (stage, deposit, pax, multi-stay rooming & `Rooming Hotel` CSV export), Right = `Comunicare` (WhatsApp/Email templates + notes).
    - **Edit Trip View**: streamlined form with one `Descriere sejur` textbox and an `Imagini` gallery (URL or file upload).
  - **Analytics View (`Analytics` tab, `computeAnalytics`)**: total profit, revenue, occupancy %, auto-qualification rate %, per-trip revenue/profit bars, and applicant stage funnel.
  - **Public Agency Board & Apply (`/?board=1`, `/?apply=<tripId>`)**: visual expedition cards, image gallery, and 30-second apply form without exposing internal costs.
  - **Tasks & Supplier Deadlines (`Sarcini`)** with `+ Din Email` parser (`parseInboundEmailText`).
- Automated tests (`tests/app.test.mjs`) passing via `npm test` (18/18 passing offline).

## Next Priorities (for Claude or Antigravity)

1. **Trip Posting & Custom Qualification Questions (`PRD.md` §1):** Upgrade `/?apply=` into full `TripPosting` records (`Draft` / `Publicat` / `Locuri epuizate`) with custom per-trip qualification questions and an agency public trip board.
2. **Supplier Cut-Offs & Payment Tranches (`PRD.md` §3):** Add hotel/airline release dates and deposit tranches per Master Trip.
3. **Agency Discovery Interviews:** Validate the GarlicOS Trip-First ATS + Rooming + Excel sync with 3–5 Romanian agencies (`DISCOVERY.md`) before committing to Phase 1 hosting.
4. **Phase 1 Authenticated Backend (`ARCHITECTURE.md` §2–4):** Implement SQLite + Litestream (or EU Postgres), auth/tenancy, GDPR export/delete, and Gmail/Sheets sync only after discovery + privacy review.
5. **Compliance Gate (`COMPLIANCE.md`):** Have a Romanian accountant verify ANAF/e-Factura and travel-agency VAT margin rules before adding invoicing.
