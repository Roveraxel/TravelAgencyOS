# PRD.md — TravelAgencyOS (Full Feature Specification)

> **Status:** Planning & Prototype Spec (Garlic Trips Trip-First ATS Model)  
> **Scope Rule:** Validate with 3–5 Romanian agencies before building paid/regulated features.

---

## 1. Trip Posting & Public Application (ATS "Job Board" Model)

Just like Greenhouse/Lever publishes job postings, an agency publishes **Master Trips** as public trip pages:

| Feature | Priority | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Trip Posting Lifecycle** | P0 | Planned (Phase 1) | `Draft` → `Publicat` → `Locuri epuizate` → `Arhivat` |
| **Agency Public Trip Board** | P0 | Planned (Phase 1) | Branded public URL (`/<agency-slug>`) listing open group trips |
| **Public Trip Page & Apply Form** | P0 | Prototype (`/?apply=`) | Itinerary highlights, dates, remaining spots, price, zero internal cost/profit exposed |
| **Custom Qualification Questions** | P1 | Planned (Phase 1) | Per-trip questions (e.g., fitness level, room preference, visa status, budget) |
| **Auto-Qualification Engine** | P0 | Built (Prototype) | Scores budget fit, pax capacity, and custom rules → `Calificat automat` / `Verifică` / `Sub buget` |
| **OpenGraph / WhatsApp Previews** | P1 | Planned (Phase 1) | Clean title, dates, and cover image when pasted in WhatsApp/Instagram |

---

## 2. Master Trip Economics & Multi-Accommodation Rooming

| Feature | Priority | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Master Trip Profit Calculator** | P0 | Built (Prototype) | Auto-calculates `Cost/pax`, `Preț/pax`, `Cost total`, `Încasări`, `Profit (%)` |
| **Multi-Accommodation Stays** | P0 | Built (Prototype) | Multiple hotels/boats per 1–2 week tour, each with `Double/Twin` & `Single` inventory |
| **Shared Room (`Partajabil`) Pairing** | P0 | Built (Prototype) | Flags unpaired solo travelers (`Caută coleg(ă)`) and over-allocated rooms |
| **Copy Rooming from Stay 1** | P0 | Built (Prototype) | 1-click copy across hotels so agents only adjust exceptions |
| **Hotel-Only Rooming Export** | P0 | Built (Prototype) | Clean CSV/PDF stripped of internal pricing and agency margins |

---

## 3. Supplier Cut-Offs, Payments & Document Story

| Feature | Priority | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Supplier Cut-Off Deadlines** | P1 | Planned (Phase 0.5) | Hotel room-block release dates ("drop-dead dates") & flight ticketing deadlines |
| **Deposit & Payment Tranches** | P1 | Planned (Phase 0.5) | Track `Avans 30%` / `Rest 70%` per applicant and supplier |
| **Document Versioning & Sent Story** | P0 | Built (Prototype) | `v1 → v2` versions, `Client` vs `Furnizor` separation, and timestamped sent log |
| **Offer Master & Print/PDF** | P0 | Built (Prototype) | Romanian offer template + optional anonymized Gemini AI draft + Print/PDF |

---

## 4. Communication & Excel Sync

| Feature | Priority | Status | Notes |
| :--- | :--- | :--- | :--- |
| **WhatsApp / Email Templates** | P0 | Built (Prototype) | 5 Romanian templates with `{client}`, `{sejur}`, `{total}`, `{locuri_ramase}` |
| **Two-Way Local Excel (.csv) Sync** | P0 | Built (Prototype) | File System Access API (`Scrie în Excel` / `Citește din Excel`) |
| **Cloud Google Sheets / Excel Sync** | P1 | Planned (Phase 1) | Background webhook/OAuth sync for teams that keep a live sheet |
| **Two-Way Email Sync (Gmail/IMAP)** | P1 | Planned (Phase 1) | Trip-specific BCC / API sync attaching supplier & client threads to the Trip timeline |

---

## 5. Multi-User, Security & Compliance (Pre-Pilot Gate)

| Feature | Priority | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Authentication & Agency Tenancy** | P0 (Pilot) | Planned (Phase 1) | Email/password or magic link; strict agency data isolation |
| **GDPR Export & Deletion** | P0 (Pilot) | Planned (Phase 1) | Traveler data export, retention policy, and deletion workflow |
| **ANAF / e-Factura / VAT Margin** | P2 | Deferred | Requires Romanian accountant sign-off; export to SmartBill/Saga preferred first |
