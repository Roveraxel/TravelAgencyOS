# TravelAgencyOS — Handoff Log

**Last updated:** 16 November 2026  
**Stage:** Local MVP Prototype (not production-ready; `localStorage` only)

## Current State

- Dependency-free Node.js 20+ server (`server.mjs`) serving `public/` on `http://127.0.0.1:4173`.
- Optional Gemini offer-draft proxy (`POST /api/offer-draft`) with:
  - Server-side `GEMINI_API_KEY` check (returns `503` with Romanian setup message when unset).
  - In-memory rate limit (10 req/min).
  - Strict input minimization (`sanitizeOfferBrief` strips unexpected/PII fields).
- Responsive Romanian-first UI (`public/index.html`, `public/styles.css`, `public/app.js`) with:
  - Explicit local-only prototype warning banner.
  - Dashboard KPIs (active enquiries, active bookings, totals by explicit currency, open tasks).
  - Enquiries CRUD + **Convert to Booking** (`Convertește`) + **+ Sarcină** + **Schiță** prefill.
  - Bookings CRUD + **+ Sarcină** linked to booking.
  - Synthetic demo Customers CRUD.
  - Tasks & follow-up checklist linked to enquiries/bookings.
  - Offer Drafts: anonymized brief form, local template generator fallback, optional Gemini AI draft, save/edit/delete, and clean `@media print` / PDF view.
  - CSV Export (UTF-8 BOM for Enquiries, Bookings, Customers) and CSV Import (`public/csv-utils.js`) with preview table, row-level validation, and duplicate handling (`skip` / `overwrite` / `create`).
- Automated tests (`tests/app.test.mjs`) passing via `npm test` (5/5 passing offline).

## Next Priorities (for Claude or Antigravity)

1. **Manual browser QA & polish:** Start `npm start`, test all modals, mobile viewport, and Print-to-PDF layout in a real browser.
2. **Agency discovery interviews:** Use `DISCOVERY.md` and `COMPLIANCE.md` alongside agency interviews before locking the paid-pilot scope.
3. **Minimal authenticated backend proposal (before any live pilot):** Design a low-cost persistence + auth layer (e.g. SQLite/Litestream or Postgres/Supabase with EU region) and privacy/GDPR deletion/export workflow — do not implement without user sign-off.
4. **Compliance gate:** Have a Romanian accountant/privacy specialist verify current ANAF/e-Factura and travel-agency VAT margin rules before adding any invoicing or fiscal features.
