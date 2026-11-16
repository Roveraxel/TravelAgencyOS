# PRD.md — MVP Product Requirements (Draft)

## In-Scope (MVP Prototype)

1. **Dashboard:** Active enquiries, active bookings, totals grouped by explicit currency (`EUR`, `RON`, `USD`), and open follow-up tasks.
2. **Enquiries Pipeline:** Source, destination, travel date, budget + currency, status (`Nouă`, `Ofertată`, `În negociere`, `Convertită`, `Pierdută`), follow-up date, notes, and one-click conversion to a Booking.
3. **Bookings:** Supplier, travel date, amount + currency, next due date (`Scadență următoare`), status (`Opțiune`, `Confirmată`, `Achitată parțial`, `Achitată integral`, `Anulată`).
4. **Customers:** Basic contact/channel record linked to enquiries and bookings (synthetic demo data only in prototype).
5. **Tasks & Reminders:** Checklist linked to enquiries or bookings.
6. **CSV Export & Import:** UTF-8 BOM export; validated CSV import with preview and duplicate handling.
7. **Offer Drafts & Print:** Anonymized brief -> Romanian draft (local template or optional server-proxied AI) with `[DE CONFIRMAT]` markers and clean Print/PDF view.

## Out-of-Scope (Deferred)

- Direct ANAF / e-Factura submission and tax/VAT margin calculations.
- WhatsApp Business API automation or supplier/GDS integrations.
- Online payments, passport/ID storage, or OCR.
- Multi-user auth and cloud database (to be proposed before any live pilot).
