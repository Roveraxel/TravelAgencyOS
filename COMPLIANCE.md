# COMPLIANCE.md — Romanian & EU Compliance Workstream

> **Disclaimer:** This document is a planning checklist, not legal or tax advice. Engage a Romanian accountant and privacy professional before implementing invoicing, fiscal reporting, package-travel contracts, or live personal-data processing.

## Key Gates Before Live Pilot

1. **GDPR / Personal Data:**
   - Prototype must NOT store real traveller PII (CNP, passport/ID scans, real emails/phones).
   - Free-tier AI APIs (e.g. Gemini free tier) may use submitted content to improve products per provider terms — only anonymized trip briefs may be sent, with clear user disclosure.
   - Live pilot requires privacy notice, data retention policy, EU hosting, and export/deletion workflows.
2. **ANAF & e-Factura (Romania):**
   - Validate current 2026+ RO e-Factura deadlines and B2B/B2C requirements with a Romanian accountant before building any invoicing module.
3. **Travel Agency VAT Margin Scheme:**
   - Travel agencies in Romania have specific VAT margin rules; do not hardcode tax calculations without accountant sign-off.
4. **Package Travel Directive / Romanian Tourism Licensing:**
   - Offer drafts must never auto-generate binding package-travel contracts or guarantees; keep `[DE CONFIRMAT]` markers and human review mandatory.
