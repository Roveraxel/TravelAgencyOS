# CLAUDE.md — TravelAgencyOS

This file gives persistent context and guardrails for AI coding agents (**Claude**, **Antigravity**, etc.) collaborating on this repository.

## Project Identity & Constraints

- **Product:** TravelAgencyOS — a low-cost, Romanian-language operating workspace for independent Romanian travel agencies (1–5 people) moving off Excel, WhatsApp, and email.
- **Founder constraints:** 10–15 hours/week, ~€1,000 initial budget. Keep complexity, hosting costs, and third-party dependencies minimal.
- **Zero-dependency preference:** The current MVP uses pure Node.js 20+ (`node:http`, `node:test`) and vanilla HTML/CSS/ES modules. Do not add npm dependencies or build toolchains without explaining the cost/benefit first.

## Non-Negotiable Boundaries

1. **Local-only prototype boundary:** Data currently lives in browser `localStorage`. Never silently move customer data to a third party. Keep the local-only warning visible until a minimal authenticated backend + privacy review is implemented.
2. **No live PII / sensitive data:** Do not collect passport/ID numbers, CNP, or real traveller personal data in this prototype.
3. **AI / Free-model safety:**
   - Keep `GEMINI_API_KEY` (or any provider key) strictly on the server (`server.mjs`), never in `public/`.
   - Send only anonymized trip brief fields (`destination`, `dates`, `travellersCount`, `style`, `budget`, `currency`, `notes`) — never names, emails, or phones.
   - Always preserve a local template fallback so the app works with zero API keys.
   - AI output is a **draft** only: mark unconfirmed availability, suppliers, prices, and terms with `[DE CONFIRMAT]`.
4. **Romanian-first UI & explicit currencies:** All UI copy must be natural Romanian. Always display explicit currency codes (`EUR`, `RON`, `USD`). Never make legal or fiscal claims (no ANAF/e-Factura/VAT advice in the UI).

## Commands

- Run app: `npm start` (serves on `http://127.0.0.1:4173`)
- Run tests: `npm test` (uses `node --test tests/*.test.mjs`, runs offline)

## Collaboration Protocol (Antigravity <-> Claude)

1. Read `HANDOFF.md` at the start of any session to see the current state and next priorities.
2. Work incrementally and run `npm test` before finishing.
3. Update `HANDOFF.md` after meaningful milestones with: changed files, test results, and the next concrete tasks.
