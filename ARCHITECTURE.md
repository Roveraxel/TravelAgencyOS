# ARCHITECTURE.md — System Shape & Data Model

## Current Prototype Architecture

- **Runtime:** Dependency-free Node.js 20+ HTTP server (`server.mjs`).
- **Frontend:** Vanilla HTML/CSS/ES modules in `public/`.
- **Persistence:** Browser `localStorage` (`travelagencyos_prototype_v1`). Zero cloud persistence or multi-user sync.
- **AI Proxy:** `POST /api/offer-draft` in `server.mjs` keeps `GEMINI_API_KEY` on the server, applies rate limiting (10 req/min), and strips non-brief fields.

## Core Entities

- `Customer`: `{ id, name, channel, note }`
- `Enquiry`: `{ id, customerId, destination, travelDate, followUpDate, budget, currency, source, status, notes }`
- `Booking`: `{ id, enquiryId, customerId, destination, supplier, travelDate, dueDate, amount, currency, status }`
- `Task`: `{ id, title, dueDate, done, enquiryId, bookingId }`
- `OfferDraft`: `{ id, title, body, updatedAt }`

## Proposed Pilot Architecture (Not Yet Built)

Before any live agency pilot with real customer data:
- Authenticated multi-tenant backend (e.g., EU-hosted Postgres/Supabase or SQLite + Litestream on a single EU VPS to stay within €1,000 budget).
- Role-based access, TLS, encrypted backups, audit log, and GDPR export/deletion endpoints.
