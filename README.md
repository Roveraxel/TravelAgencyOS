# TravelAgencyOS (Prototip local MVP)

Spațiu de lucru operațional în limba română pentru agenții de turism independente din România (1–5 persoane) care își coordonează în prezent cererile, ofertele, rezervările și follow-up-urile în Excel, WhatsApp și email.

> **Atenție:** Acesta este un **prototip local** cu date salvate exclusiv în `localStorage` din browser. Nu există autentificare, backend partajat sau criptare at-rest. **Nu introduceți date personale reale ale turiștilor** (CNP, pașaport, email/telefon real) până la implementarea backend-ului securizat și a reviziei de conformitate.

## Pornire rapidă (Node.js 20+)

```bash
npm start
```

Deschideți în browser: `http://127.0.0.1:4173`

Pentru teste automate (fără dependențe externe):

```bash
npm test
```

## Funcționalități incluse în prototip

- **Panou general:** indicatori pentru cereri active, rezervări active, valoare pe monede (`EUR` / `RON` / `USD`) și sarcini prioritare.
- **Cereri de ofertă:** căutare, filtrare după status, creare/editare, **conversie directă în rezervare**, adăugare rapidă de sarcină și preluare în **Schiță ofertă**.
- **Rezervări:** furnizor, dată plecare, valoare cu monedă explicită, scadență plată, status și sarcini legate.
- **Clienți (date demo sintetice):** evidență simplă și număr de cereri/rezervări asociate.
- **Sarcini & Follow-up:** bifare rapidă, filtrare și legare de cereri sau rezervări.
- **Schițe ofertă & Print/PDF:** brief anonimizat, șablon local instant (funcționează offline), apel opțional Gemini prin `server.mjs` (necesită `GEMINI_API_KEY` în `.env`), salvare/editare și vizualizare curată pentru Print / Salvare PDF.
- **Import / Export CSV:** export UTF-8 BOM (compatibil Excel cu diacritice) pentru cereri, rezervări și clienți; import CSV pentru cereri cu previzualizare, validare per rând și gestionare duplicate.

## Documentație proiect

- [`CLAUDE.md`](./CLAUDE.md) — instrucțiuni de lucru pentru agenți (Antigravity & Claude).
- [`HANDOFF.md`](./HANDOFF.md) — jurnal de predare-primire cu stadiul curent și pașii următori.
- [`PRD.md`](./PRD.md) — cerințe MVP și criterii de acceptare.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — arhitectura curentă vs. arhitectura propusă pentru pilot.
- [`COMPLIANCE.md`](./COMPLIANCE.md) — fluxul de conformitate România / UE (ANAF, e-Factura, GDPR, pachete de servicii).
- [`DISCOVERY.md`](./DISCOVERY.md) — cercetare competitori (cu separarea afirmațiilor publice de faptele verificate).
- [`ROADMAP.md`](./ROADMAP.md) — fazele proiectului, buget (~€1.000) și timp (10–15h/săptămână).
