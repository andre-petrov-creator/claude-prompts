# ImmoCRM — Development Guidelines

Coding-Standards, Naming, Patterns. Gilt für alle Implementierungs-Schritte.

---

## Sprache

- **Code & Identifier:** Englisch (`Contact`, `Deal`, `useDeals`, `fetchContacts`)
- **Domain-Begriffe (DB-Spalten, Status-Enums, UI-Strings):** Deutsch wo etabliert
  - Status-Enums: `offen | berechnet | absage`, `kalt | warm | heiß | nr1`
  - Spalten: `wohnflaeche_m2`, `preis_kauf`, `mein_angebot`, `naechste_nachfass`
- **UI-Texte:** Deutsch (Labels, Buttons, Toasts, Mail-Briefing)
- **Code-Kommentare:** Deutsch wenn fachlicher Kontext, sonst Englisch — generell sparsam, nur wenn das WHY nicht aus dem Code lesbar ist

---

## Datei-Struktur (`src/`)

```
src/
├── components/        # React-Components (PascalCase)
│   ├── ui/            # shadcn-Primitive (Button, Dialog, Sheet, …)
│   ├── leads/         # Lead-Liste, Quick-Info, Notiz-Panel
│   ├── crm/           # Kontakt-Tabelle, Chat-Stream
│   └── shared/        # Status-Badge, Datepicker-Wrapper, …
├── features/          # Feature-Module (Lead-Anlegen, PDF-Extract, Mail-Briefing)
├── hooks/             # use*-Hooks (useDeals, useContacts, useNextFollowup)
├── lib/               # supabase.ts, utils.ts, formatters.ts
├── types/             # DB-Types (von Supabase generiert) + Domain-Types
├── pages/             # Routen-Top-Level (LeadList, ContactList)
└── main.tsx
```

---

## Naming

| Was | Konvention | Beispiel |
|-----|------------|----------|
| Components | PascalCase | `LeadTable`, `ContactQuickInfo` |
| Hooks | `use` + camelCase | `useDeals`, `useNextFollowup` |
| Utility-Functions | camelCase | `formatCurrency`, `computePricePerSqm` |
| Konstanten | SCREAMING_SNAKE_CASE | `STATUS_COLORS`, `FOLLOWUP_SCHEMA_DAYS` |
| DB-Tabellen | snake_case (Postgres-Idiom) | `contacts`, `deal_notes` |
| Files für Components | PascalCase | `LeadTable.tsx` |
| Files für Hooks/Utils | camelCase | `useDeals.ts`, `formatters.ts` |

---

## TypeScript

- **`strict: true`** in `tsconfig.json` — kein Opt-out
- Keine `any`. `unknown` + Narrowing wo Typ tatsächlich offen ist
- DB-Types via Supabase CLI generieren (`supabase gen types typescript`) — nie manuell tippen
- Domain-Types in `src/types/` zentralisieren, von DB-Types ableiten:
  ```ts
  type Deal = Database['public']['Tables']['deals']['Row']
  ```

---

## React

- Function-Components only, keine Class-Components
- Hooks-Reihenfolge: State → Refs → Derived → Effects → Handlers → Render
- Props-Interfaces lokal pro Component (`type Props = { … }`), kein globales Props-Sammelsurium
- Kein `useEffect` für Datenfetching — `@tanstack/react-query` (entscheiden in Schritt 1)
- Keine prop-drilling tiefer als 2 Ebenen — Context oder Composition

---

## Forms & Validation

- **react-hook-form** für State, **zod** für Schemas
- Zod-Schemas spiegeln DB-Constraints (Pflichtfelder, Enum-Werte)
- Conditional Validation (z. B. `einheiten` Pflicht bei `object_type === 'MFH'`) im Schema, nicht in der Component

---

## Supabase

- Ein Client-Singleton in `src/lib/supabase.ts`, nicht pro Component instanzieren
- Queries gekapselt in `hooks/use*.ts`, nicht inline in Components
- RLS-Policies auch im Single-User-Setup definiert (Vorbereitung Multi-User)
- Migrations als SQL-Files unter `supabase/migrations/` — nie Schema im Dashboard editieren

---

## Styling

- Tailwind utility-first, keine Custom-CSS-Files außer `globals.css` für Design-Tokens
- shadcn-Components per CLI generieren, dann in `components/ui/` editierbar
- Status-Farben **einmal** definieren (in `tailwind.config.ts` oder `lib/constants.ts`):
  - `offen` → orange
  - `berechnet` → grün
  - `absage` → rot

---

## State / Data Flow

- Server-State (Supabase-Daten): react-query
- UI-State (Modals, Selection, Filter): React-State / `useState`
- Globaler UI-State falls nötig: Zustand (entscheiden bei Bedarf, ADR in `03_decisions.md`)

---

## Error-Handling

- Boundary-Component am Routen-Top-Level (`pages/*`)
- User-Facing-Errors als Toast (shadcn `sonner`), nie als blanker `alert()`
- Supabase-Errors loggen + Toast, nicht swallowen
- Keine try/catch ohne tatsächliche Fehlerbehandlung — fail loud

---

## Tests

- MVP: keine Pflicht-Test-Coverage. Kritische Logik testen:
  - `computeNextFollowup` (Nachfass-Schema)
  - Duplikat-Check (Email + Name)
  - Status-Default-Logik (berechnet vs offen)
- Test-Runner: Vitest (kommt mit Vite mit)
- E2E-Tests: nicht im MVP

---

## Performance

- Pagination ab >500 Leads (Schritt 10 Polish)
- TanStack Table virtualisiert, wenn Performance bei großer Tabelle einbricht
- Keine pre-mature Optimierung — erst messen, dann optimieren

---

## Git / Commits

- Conventional-Style-Commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- Scope optional: `feat(leads): ...`, `fix(crm): ...`
- Body knapp, deutsch, beschreibt **Warum**, nicht Was
- Push direkt auf `main` (Single-User-Repo, Mono-Repo `meine-projekte`)
- Nach jedem Bau-Schritt: `docs/04_progress.md` updaten und in den Commit aufnehmen

---

## Was wir nicht tun

- Keine Kommentare wie `// fetch contacts` über `fetchContacts()`
- Kein dead code "für später" — git history ist das Archiv
- Keine Feature Flags ohne konkreten Grund
- Keine Backwards-Compat-Shims für Code, der noch nie released war
- Keine Doku-Files ohne expliziten Auftrag
- Keine `--no-verify`-Commits
