# Schritt 2 — Lead-Liste UI (read-only) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Read-only Lead-Liste mit allen 21 Spalten gemäß 01_projektbeschreibung.md §4.1, gefetcht aus `deals_with_followup` View, mit Sortierung, globaler Suche, Spalten-Filtern, Spalten-Sichtbarkeit, Status-Badges und kollabierbaren Sektionen (Berechnet/Offen/Absage).

**Architecture:** React Router DOM v7 als URL-Routing (`/leads` ↔ `/contacts`-Stub). `@tanstack/react-query` als Server-State-Cache (GUIDELINES §State). `@tanstack/react-table` als Tabellen-Engine. shadcn-Components für Atoms (Badge, DropdownMenu, Input, Collapsible). Demo-Daten via MCP-Seed (3 Makler + 5 Deals + 2 Comments) direkt in Live-DB.

**Tech Stack:** Vite + React 18 + TS · React Router DOM v7 · @tanstack/react-table v8 · @tanstack/react-query v5 · shadcn/ui · Tailwind

---

## Context

**Warum:** Schritt 1 (DB-Schema) ist live, aber DB ist leer und Frontend zeigt nur einen Hello-World-Button. Schritt 2 macht die Lead-Liste sichtbar — die zentrale Arbeitsoberfläche. Read-only, weil Edit-Interaktionen (Notizen, Anruf-Button, Quick-Info-Popover) erst in Schritt 3 kommen.

**Ausgangslage:**
- DB-Schema applied (6 Tabellen + View)
- TS-Types generiert (`src/types/supabase.ts`)
- `src/lib/supabase.ts` mit `createClient<Database>` typisiert
- `src/components/ui/button.tsx` von shadcn da, sonst nichts
- `src/App.tsx` zeigt einen Button mit Alert (Schritt 0 Smoke)

**Critical Decisions (aus Brainstorming):**
- Routing: React Router DOM (kein Single-Page Tabs)
- Server-State: react-query (GUIDELINES §State)
- Demo-Daten: MCP-Seed (kein Migration 002 — wird in Schritt 9 durch echte Excel-Daten ersetzt)
- Date-Format: native `Intl.DateTimeFormat('de-DE')` — keine extra Dep

---

## Spalten-Mapping (21 Spalten → DB-Felder)

| # | UI-Spalte | DB-Quelle | Format |
|---|---|---|---|
| 1 | Status | `deals.status` | Badge (offen/orange, berechnet/grün, absage/rot) |
| 2 | Name (Makler) | `contacts.name` (via FK) | Text |
| 3 | Firma | `contacts.company` | Text |
| 4 | Telefon | `contacts.phone` | Text |
| 5 | E-Mail | `contacts.email` | Text |
| 6 | Anruf | `deals.letzter_anruf` | Datum DD.MM.YYYY |
| 7 | Besichtigung | `deals.besichtigung_datum` | Datum DD.MM.YYYY |
| 8 | Lead-Herkunft | `contacts.lead_source` | Text |
| 9 | Objekt | `deals.address` | Text (Straße+Hausnr) |
| 10 | Adresse | `deals.zip` + `deals.city` | Text "PLZ Stadt" |
| 11 | Verwendung | `deals.object_type` | Text (WHG/MFH/REH/…) |
| 12 | Wohnfläche | `deals.wohnflaeche_m2` | "120 m²" (1 Nachkomma) |
| 13 | Preis | `deals.preis_kauf` | "250.000 €" |
| 14 | €/m² | `deals.preis_pro_m2` | "2.500 €" |
| 15 | Kalk Verkaufspreis | `deals.kalk_verkaufspreis` | "350.000 €" |
| 16 | €/m² (kalk) | `deals.kalk_pro_m2` | "3.500 €" |
| 17 | Mein Angebot | `deals.mein_angebot` | "275.000 €" |
| 18 | Angebot gültig | `deals.angebot_datum` | Datum DD.MM.YYYY |
| 19 | Nächste Nachfass | `deals_with_followup.naechste_nachfass` | Datum, rot wenn < heute |
| 20 | Exposé | `deals.expose_url` / `expose_local_path` | Icon (blau/grau) |
| 21 | Notiz | (Aggregat aus `deal_notes`) | "n Notizen" oder "—" |

Datenquelle: `deals_with_followup` View JOIN `contacts` + LEFT JOIN (SELECT count(*) FROM deal_notes GROUP BY deal_id). Im useDeals-Hook als Single-Query.

---

## File Structure

| Aktion | Datei | Zweck |
|---|---|---|
| Modify | `package.json` | + react-router-dom, @tanstack/react-table, @tanstack/react-query |
| Add (shadcn CLI) | `src/components/ui/badge.tsx` | Status-Badge-Primitive |
| Add (shadcn CLI) | `src/components/ui/input.tsx` | Search-Input |
| Add (shadcn CLI) | `src/components/ui/dropdown-menu.tsx` | Spalten-Visibility-Menü |
| Add (shadcn CLI) | `src/components/ui/collapsible.tsx` | Sektionen |
| Create | `src/types/domain.ts` | `Deal`, `Contact`, `DealWithFollowup` Domain-Types |
| Create | `src/lib/formatters.ts` | `formatCurrency`, `formatDate`, `formatM2` |
| Create | `src/lib/constants.ts` | `STATUS_COLORS`, `STATUS_LABELS` |
| Modify | `src/lib/supabase.ts` | (bleibt) |
| Create | `src/hooks/useDeals.ts` | react-query hook |
| Create | `src/pages/LeadList.tsx` | Lead-Liste Top-Level Page |
| Create | `src/pages/ContactList.tsx` | Stub für Schritt 6 |
| Create | `src/components/leads/LeadTable.tsx` | TanStack Table mit allen 21 Spalten |
| Create | `src/components/leads/StatusBadge.tsx` | Status-Badge mit Farbe |
| Create | `src/components/leads/LeadFilters.tsx` | Search + Status/Lead-Herkunft-Filter + Column-Visibility |
| Create | `src/components/leads/LeadSections.tsx` | Collapsible-Gruppierung |
| Create | `src/components/Layout.tsx` | Top-Nav mit /leads, /contacts |
| Modify | `src/App.tsx` | Router + QueryClient-Provider |
| Modify | `src/main.tsx` | (evtl. unverändert) |
| Modify | `docs/04_progress.md` | Schritt 2 → ✅ |

---

## Tasks

### Task 1: Dependencies installieren

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1:** `npm i react-router-dom @tanstack/react-table @tanstack/react-query`
- [ ] **Step 2:** `npm ls react-router-dom @tanstack/react-table @tanstack/react-query` (verify)
- [ ] **Step 3:** Commit: `chore(deps): react-router + tanstack-table + tanstack-query`

### Task 2: shadcn-Components hinzufügen

**Files:** `src/components/ui/{badge,input,dropdown-menu,collapsible}.tsx`

- [ ] **Step 1:** `npx shadcn@latest add badge input dropdown-menu collapsible`
- [ ] **Step 2:** Verify dass Files unter `src/components/ui/` angelegt sind
- [ ] **Step 3:** Commit: `chore(ui): badge, input, dropdown-menu, collapsible von shadcn`

### Task 3: Demo-Daten via MCP seeden

**Files:** keine — direkt in Live-DB

- [ ] **Step 1:** Via `mcp__supabase__execute_sql` 3 Contacts + 5 Deals + 2 Comments anlegen:

```sql
WITH
  c AS (
    INSERT INTO contacts (name, email, phone, company, position, status, lead_source) VALUES
      ('Hansjürgen Potthoff', 'potthoff@example.de', '+49 201 1234567', 'Potthoff Immobilien', 'Inhaber', 'warm',  'Online'),
      ('Maria Bauer',         'bauer@ev.de',          '+49 211 9876543', 'Engel & Völkers',     'Maklerin', 'kalt',  'Online'),
      ('Frank Schmidt',       NULL,                   '+49 230 5556789', NULL,                  'Eigentümer', 'heiß', 'Direktkontakt')
    RETURNING id, name
  ),
  c_hansj AS (SELECT id FROM c WHERE name = 'Hansjürgen Potthoff'),
  c_maria AS (SELECT id FROM c WHERE name = 'Maria Bauer'),
  c_frank AS (SELECT id FROM c WHERE name = 'Frank Schmidt'),
  ins_deals AS (
    INSERT INTO deals (contact_id, status, object_type, einheiten, address, city, zip, wohnflaeche_m2, preis_kauf, kalk_verkaufspreis, mein_angebot, angebot_datum, letzter_anruf, besichtigung_datum, expose_url) VALUES
      ((SELECT id FROM c_hansj), 'berechnet', 'MFH', 6,  'Koppelstr 29',  'Essen',    '45128', 350,  890000,  1250000, 950000,  '2026-05-08', '2026-05-09', NULL,         'https://example.com/koppel29'),
      ((SELECT id FROM c_hansj), 'offen',     'MFH', 4,  'Talstr 10',     'Essen',    '45136', 240,  580000,  NULL,    NULL,    NULL,         NULL,         NULL,         NULL),
      ((SELECT id FROM c_maria), 'absage',    'REH', NULL,'Kolmarer 6',   'Bochum',   '44805', 180,  420000,  500000,  450000,  '2026-04-22', '2026-04-25', '2026-04-29', NULL),
      ((SELECT id FROM c_frank), 'berechnet', 'MFH', 8,  'Bismarckstr 5', 'Mülheim',  '45478', 320,  720000,  1100000, NULL,    NULL,         NULL,         '2026-05-12', 'https://example.com/bismarck5'),
      ((SELECT id FROM c_maria), 'berechnet', 'WHG', NULL,'Hauptstr 12',  'Dortmund', '44137', 90,   195000,  275000,  220000,  '2026-05-05', '2026-05-06', NULL,         'https://example.com/haupt12')
    RETURNING id, address
  )
INSERT INTO contact_comments (contact_id, text)
SELECT (SELECT id FROM c_hansj), 'Macht regelmäßig Off-Market-Deals, Koppelstr war Empfehlung'
UNION ALL
SELECT (SELECT id FROM c_frank), 'Eigentümer direkt, kein Makler-Vermittlung';
```

- [ ] **Step 2:** Verify counts: `SELECT (SELECT count(*) FROM contacts) c, (SELECT count(*) FROM deals) d, (SELECT count(*) FROM contact_comments) cc;` → expect `c=3, d=5, cc=2`
- [ ] **Step 3:** View-Smoke: `SELECT id, status, address, naechste_nachfass FROM deals_with_followup ORDER BY status;` → erwarte naechste_nachfass für 'berechnet' und 'offen', NULL für 'absage'

### Task 4: Domain-Types + Formatters + Constants

**Files:** Create `src/types/domain.ts`, `src/lib/formatters.ts`, `src/lib/constants.ts`

- [ ] **Step 1:** `src/types/domain.ts`:

```typescript
import type { Database } from '@/types/supabase'

export type Contact = Database['public']['Tables']['contacts']['Row']
export type Deal = Database['public']['Tables']['deals']['Row']
export type DealWithFollowup = Database['public']['Views']['deals_with_followup']['Row']
export type ContactComment = Database['public']['Tables']['contact_comments']['Row']
export type DealNote = Database['public']['Tables']['deal_notes']['Row']

export type ContactStatus = Database['public']['Enums']['contact_status']
export type DealStatus = Database['public']['Enums']['deal_status']

export type LeadRow = DealWithFollowup & {
  contact: Pick<Contact, 'id' | 'name' | 'email' | 'phone' | 'company' | 'lead_source'>
  notes_count: number
}
```

- [ ] **Step 2:** `src/lib/formatters.ts`:

```typescript
const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const m2 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 })
const date = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

export const formatCurrency = (v: number | string | null | undefined): string =>
  v == null ? '—' : eur.format(typeof v === 'string' ? Number(v) : v)

export const formatM2 = (v: number | string | null | undefined): string =>
  v == null ? '—' : `${m2.format(typeof v === 'string' ? Number(v) : v)} m²`

export const formatDate = (v: string | null | undefined): string =>
  v == null ? '—' : date.format(new Date(v))

export const isOverdue = (v: string | null | undefined): boolean => {
  if (!v) return false
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return new Date(v) < today
}
```

- [ ] **Step 3:** `src/lib/constants.ts`:

```typescript
import type { DealStatus } from '@/types/domain'

export const STATUS_LABELS: Record<DealStatus, string> = {
  offen: 'Offen',
  berechnet: 'Berechnet',
  absage: 'Absage',
}

export const STATUS_COLORS: Record<DealStatus, string> = {
  offen: 'bg-orange-100 text-orange-800 border-orange-200',
  berechnet: 'bg-green-100 text-green-800 border-green-200',
  absage: 'bg-red-100 text-red-800 border-red-200',
}

export const SECTION_ORDER: DealStatus[] = ['berechnet', 'offen', 'absage']
```

- [ ] **Step 4:** Commit: `feat(leads): domain types, formatters, constants`

### Task 5: react-query Setup + useDeals hook

**Files:** Modify `src/App.tsx`; Create `src/hooks/useDeals.ts`

- [ ] **Step 1:** `src/hooks/useDeals.ts`:

```typescript
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { LeadRow } from '@/types/domain'

export const useDeals = () => {
  return useQuery<LeadRow[]>({
    queryKey: ['deals', 'with-followup'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals_with_followup')
        .select(`
          *,
          contact:contacts!deals_contact_id_fkey (id, name, email, phone, company, lead_source),
          deal_notes (id)
        `)
      if (error) throw error
      return (data ?? []).map((d: any) => ({
        ...d,
        notes_count: d.deal_notes?.length ?? 0,
      })) as LeadRow[]
    },
  })
}
```

> Note: Supabase-js Embedded-Select via `!fkey` braucht den FK-Constraint-Name. Wenn `deals_contact_id_fkey` nicht funktioniert, fallback auf `contact:contacts (...)`.

- [ ] **Step 2:** `src/App.tsx` mit `QueryClient` + Router (siehe Task 6 für Router-Setup):

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Layout from '@/components/Layout'
import LeadList from '@/pages/LeadList'
import ContactList from '@/pages/ContactList'

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 30_000 } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/leads" replace />} />
            <Route path="/leads" element={<LeadList />} />
            <Route path="/contacts" element={<ContactList />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 3:** Smoke: `npm run dev` → öffnen, URL sollte automatisch auf `/leads` redirecten

### Task 6: Layout + Stub-Pages

**Files:** Create `src/components/Layout.tsx`, `src/pages/LeadList.tsx`, `src/pages/ContactList.tsx`

- [ ] **Step 1:** `src/components/Layout.tsx`:

```typescript
import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="border-b bg-zinc-50 px-6 py-3 flex gap-4 items-center">
        <h1 className="font-semibold mr-6">ImmoCRM</h1>
        <NavLink to="/leads" className={({ isActive }) =>
          cn('px-3 py-1.5 rounded text-sm font-medium', isActive ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-200')}>
          Leads
        </NavLink>
        <NavLink to="/contacts" className={({ isActive }) =>
          cn('px-3 py-1.5 rounded text-sm font-medium', isActive ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-200')}>
          Kontakte
        </NavLink>
      </nav>
      <main className="flex-1 p-6"><Outlet /></main>
    </div>
  )
}
```

- [ ] **Step 2:** `src/pages/ContactList.tsx` als Stub:

```typescript
export default function ContactList() {
  return <div className="text-zinc-500">Kontakte — Schritt 6</div>
}
```

- [ ] **Step 3:** `src/pages/LeadList.tsx` als Wireframe (Daten anzeigen, kein Polish):

```typescript
import { useDeals } from '@/hooks/useDeals'
import LeadTable from '@/components/leads/LeadTable'

export default function LeadList() {
  const { data, isLoading, error } = useDeals()
  if (isLoading) return <div>Lädt…</div>
  if (error) return <div className="text-red-600">Fehler: {String(error)}</div>
  return <LeadTable data={data ?? []} />
}
```

- [ ] **Step 4:** `npm run dev` smoke: Layout sichtbar, `/leads` ruft Hook auf (sieht ohne LeadTable noch nichts, Error möglich — als nächstes Task 7 fixt das)

### Task 7: LeadTable Basis (21 Spalten, Status-Badge, Sektionen)

**Files:** Create `src/components/leads/LeadTable.tsx`, `src/components/leads/StatusBadge.tsx`, `src/components/leads/LeadSections.tsx`

- [ ] **Step 1:** `src/components/leads/StatusBadge.tsx`:

```typescript
import { cn } from '@/lib/utils'
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/constants'
import type { DealStatus } from '@/types/domain'

export default function StatusBadge({ status }: { status: DealStatus }) {
  return (
    <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-medium border', STATUS_COLORS[status])}>
      {STATUS_LABELS[status]}
    </span>
  )
}
```

- [ ] **Step 2:** `src/components/leads/LeadTable.tsx` mit TanStack-Table-Setup, allen 21 Spalten als ColumnDefs, gruppiert über SECTION_ORDER (Berechnet/Offen/Absage). Code-Skeleton:

```typescript
import { useMemo, useState } from 'react'
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel,
  type ColumnDef, type SortingState, type VisibilityState,
  flexRender,
} from '@tanstack/react-table'
import type { LeadRow, DealStatus } from '@/types/domain'
import StatusBadge from './StatusBadge'
import LeadSections from './LeadSections'
import { formatCurrency, formatDate, formatM2, isOverdue } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export default function LeadTable({ data }: { data: LeadRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = useState('')

  const columns = useMemo<ColumnDef<LeadRow>[]>(() => [
    { id: 'status', header: 'Status', accessorKey: 'status',
      cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { id: 'name', header: 'Makler', accessorFn: (r) => r.contact.name },
    { id: 'company', header: 'Firma', accessorFn: (r) => r.contact.company ?? '—' },
    { id: 'phone', header: 'Telefon', accessorFn: (r) => r.contact.phone ?? '—' },
    { id: 'email', header: 'E-Mail', accessorFn: (r) => r.contact.email ?? '—' },
    { id: 'letzter_anruf', header: 'Anruf', accessorKey: 'letzter_anruf',
      cell: ({ getValue }) => formatDate(getValue() as string) },
    { id: 'besichtigung_datum', header: 'Besichtigung', accessorKey: 'besichtigung_datum',
      cell: ({ getValue }) => formatDate(getValue() as string) },
    { id: 'lead_source', header: 'Lead-Herkunft', accessorFn: (r) => r.contact.lead_source ?? '—' },
    { id: 'address', header: 'Objekt', accessorKey: 'address' },
    { id: 'zip_city', header: 'Adresse', accessorFn: (r) => `${r.zip ?? ''} ${r.city ?? ''}`.trim() || '—' },
    { id: 'object_type', header: 'Verwendung', accessorKey: 'object_type' },
    { id: 'wohnflaeche_m2', header: 'Wohnfläche', accessorKey: 'wohnflaeche_m2',
      cell: ({ getValue }) => formatM2(getValue() as number) },
    { id: 'preis_kauf', header: 'Preis', accessorKey: 'preis_kauf',
      cell: ({ getValue }) => formatCurrency(getValue() as number) },
    { id: 'preis_pro_m2', header: '€/m²', accessorKey: 'preis_pro_m2',
      cell: ({ getValue }) => formatCurrency(getValue() as number) },
    { id: 'kalk_verkaufspreis', header: 'Kalk Verkauf', accessorKey: 'kalk_verkaufspreis',
      cell: ({ getValue }) => formatCurrency(getValue() as number) },
    { id: 'kalk_pro_m2', header: 'Kalk €/m²', accessorKey: 'kalk_pro_m2',
      cell: ({ getValue }) => formatCurrency(getValue() as number) },
    { id: 'mein_angebot', header: 'Mein Angebot', accessorKey: 'mein_angebot',
      cell: ({ getValue }) => formatCurrency(getValue() as number) },
    { id: 'angebot_datum', header: 'Angebot gültig', accessorKey: 'angebot_datum',
      cell: ({ getValue }) => formatDate(getValue() as string) },
    { id: 'naechste_nachfass', header: 'Nächste Nachfass', accessorKey: 'naechste_nachfass',
      cell: ({ getValue }) => {
        const v = getValue() as string | null
        return <span className={cn(isOverdue(v) && 'text-red-600 font-semibold')}>{formatDate(v)}</span>
      } },
    { id: 'expose', header: 'Exposé',
      cell: ({ row }) => {
        const url = row.original.expose_url || row.original.expose_local_path
        return url
          ? <a href={url} target="_blank" rel="noreferrer" className="text-blue-600 underline">🔗</a>
          : <span className="text-zinc-300">—</span>
      } },
    { id: 'notes', header: 'Notiz', accessorKey: 'notes_count',
      cell: ({ getValue }) => {
        const n = getValue() as number
        return n > 0 ? `${n} Notiz${n > 1 ? 'en' : ''}` : '—'
      } },
  ], [])

  const table = useReactTable({
    data, columns,
    state: { sorting, columnVisibility, globalFilter },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return <LeadSections table={table} setGlobalFilter={setGlobalFilter} globalFilter={globalFilter} />
}
```

- [ ] **Step 3:** `src/components/leads/LeadSections.tsx` mit Collapsibles für `SECTION_ORDER`:

```typescript
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import type { Table } from '@tanstack/react-table'
import type { LeadRow, DealStatus } from '@/types/domain'
import { SECTION_ORDER, STATUS_LABELS } from '@/lib/constants'
import { flexRender } from '@tanstack/react-table'
import { Input } from '@/components/ui/input'
import LeadFilters from './LeadFilters'

export default function LeadSections({ table, globalFilter, setGlobalFilter }: {
  table: Table<LeadRow>
  globalFilter: string
  setGlobalFilter: (v: string) => void
}) {
  const rowsByStatus: Record<DealStatus, typeof table.getRowModel.prototype.rows> = {
    offen: [], berechnet: [], absage: [],
  } as any
  for (const row of table.getRowModel().rows) {
    rowsByStatus[row.original.status].push(row)
  }
  const [open, setOpen] = useState<Record<DealStatus, boolean>>({ berechnet: true, offen: true, absage: false })

  const total = table.getRowModel().rows.length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Leads</h2>
          <p className="text-sm text-zinc-500">{total} insgesamt</p>
        </div>
        <LeadFilters table={table} globalFilter={globalFilter} setGlobalFilter={setGlobalFilter} />
      </div>

      {SECTION_ORDER.map((status) => (
        <Collapsible key={status} open={open[status]} onOpenChange={(v) => setOpen({ ...open, [status]: v })}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 font-medium hover:bg-zinc-50">
            <ChevronDown className={`w-4 h-4 transition-transform ${open[status] ? '' : '-rotate-90'}`} />
            {STATUS_LABELS[status]} ({rowsByStatus[status].length})
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="overflow-x-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 sticky top-0">
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((h) => (
                        <th
                          key={h.id}
                          className="px-3 py-2 text-left font-medium border-b cursor-pointer hover:bg-zinc-100"
                          onClick={h.column.getToggleSortingHandler()}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {{ asc: ' ↑', desc: ' ↓' }[h.column.getIsSorted() as string] ?? ''}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {rowsByStatus[status].map((row) => (
                    <tr key={row.id} className="border-b hover:bg-zinc-50">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-3 py-2 whitespace-nowrap">
                          {flexRender(cell.column.columnDef.cell ?? cell.column.columnDef.header, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  )
}
```

- [ ] **Step 4:** Smoke: `npm run dev`, Browser auf http://localhost:5173/leads — Tabelle zeigt 5 Deals in 3 Sektionen.

### Task 8: LeadFilters (Search + Spalten-Sichtbarkeit)

**Files:** Create `src/components/leads/LeadFilters.tsx`

- [ ] **Step 1:** Skeleton:

```typescript
import { Input } from '@/components/ui/input'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Columns3 } from 'lucide-react'
import type { Table } from '@tanstack/react-table'
import type { LeadRow } from '@/types/domain'

export default function LeadFilters({ table, globalFilter, setGlobalFilter }: {
  table: Table<LeadRow>
  globalFilter: string
  setGlobalFilter: (v: string) => void
}) {
  return (
    <div className="flex gap-2 items-center">
      <Input
        placeholder="Suche…"
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
        className="w-64"
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Columns3 className="w-4 h-4 mr-2" /> Spalten
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-96 overflow-auto">
          {table.getAllLeafColumns().map((col) => (
            <DropdownMenuCheckboxItem
              key={col.id}
              checked={col.getIsVisible()}
              onCheckedChange={(v) => col.toggleVisibility(!!v)}
            >
              {typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
```

- [ ] **Step 2:** Smoke: Suche und Spalten-Sichtbarkeit funktionieren visuell.

### Task 9: Visual-Test + Bugfix-Loop

**Files:** keine (User-Aktion + ggf. Fixes)

- [ ] **Step 1:** `npm run dev` → User öffnet http://localhost:5173/leads
- [ ] **Step 2:** Manuelle Checks:
  - Routing: /leads zeigt Tabelle, /contacts zeigt Stub, / redirected auf /leads
  - 5 Deals sichtbar, 3 Sektionen mit korrekten Counts (Berechnet: 3, Offen: 1, Absage: 1)
  - Status-Badges in 3 Farben
  - `naechste_nachfass` für überfällige Daten in Rot
  - Sortierung per Header-Klick
  - Suche filtert (z.B. "Bismarck")
  - Spalten-Sichtbarkeit-Menü blendet ein/aus
- [ ] **Step 3:** Bei Bugs: fix + re-run dev. Bei Erfolg: weiter.

### Task 10: Doku-Update + Commit + Push

**Files:** Modify `docs/04_progress.md`, `C:\meine-projekte\README.md`

- [ ] **Step 1:** `docs/04_progress.md` Schritt 2 → ✅ + Datum
- [ ] **Step 2:** README.md Historie-Eintrag ergänzen
- [ ] **Step 3:** `git add … && git commit -m "feat(leads): Schritt 2 — read-only Lead-Liste mit Sortierung, Suche, Sektionen"`
- [ ] **Step 4:** `git push origin main`

---

## Verification

### Visual (im Browser, `npm run dev`)

| Check | Erwartet |
|---|---|
| / | redirected auf /leads |
| /leads | Tabelle mit 5 Deals |
| Sektionen | 3 Collapsibles (Berechnet: 3 / Offen: 1 / Absage: 1), Absage default zu |
| Status-Spalte | Badges Orange/Grün/Rot |
| Sortierung | Header-Klick sortiert; zweiter Klick reverse |
| Suche "Bismarck" | filtert auf 1 Zeile (Frank Schmidt Deal) |
| Suche "Maria" | filtert auf 2 Zeilen (Kolmarer + Hauptstr) |
| Spalten-Menü | Checkboxen blenden Spalten aus/ein |
| Nächste Nachfass | rot wenn < heute (heute = 2026-05-11) |
| Exposé-Spalte | blauer Link bei Deals A, D, E; — bei Deal B, C |
| Notiz-Spalte | "—" überall (keine deal_notes, nur contact_comments im Seed) |

### Build

- `npm run build` → exit 0, keine TS-Errors

---

## Anhang — Open Items

- **Schritt 3** (Quick-Info, Notiz-Panel, Anruf-Button) baut auf dieser Tabelle auf
- **Filter pro Datums-Spalte** (Plan-Aufgabe 6 in 02_implementierungsplan.md): in Plan zurückgestellt — Search + Status-Sektionen decken 80% ab; granulare Datums-Filter kommen in Schritt 10 (Polish) oder bei Bedarf
- **Pagination**: ab >500 Leads (Schritt 10, Plan-Aufgabe 7)
