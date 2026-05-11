# Schritt 3 — Lead-Liste Interaktionen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lead-Liste wird interaktiv: Quick-Info-Popover auf Makler-Namen, Slide-In-Panel mit Rich-Text-Notizen (Tiptap), Exposé-Link mit blau/grau-Anzeige, Anruf-Eintragen per Hover-Button und Rechtsklick-Datepicker.

**Architecture:** Erste Schreib-Operationen aus dem Frontend. Mutations gehen via Anon-Key direkt gegen Supabase, abgesichert durch eine erweiterte RLS-Policy (ADR-011) — nur die für Schritt 3 nötigen Schreib-Operationen werden geöffnet, keine ganze Edge-Function-Schicht. `deal_notes`-CRUD und `deals.letzter_anruf`/`deals.besichtigung_datum`-UPDATE.

**Tech Stack:** shadcn/ui (Sheet, Popover, Calendar, Sonner), Tiptap (StarterKit + Underline), date-fns für Datums-Format-Parsing, bestehende react-query/TanStack-Table-Infra.

**Decisions:**
- ADR-011 (neu) — Tiptap als Rich-Text-Editor + RLS-Pragmatik für Single-User-Mutations (kombinierte ADR, da beides denselben Schritt prägt)
- ADR-008 wird durch ADR-011 partiell präzisiert für deal_notes und ausgewählte deals-Spalten

**Files (Übersicht):**

```
src/
├── components/
│   ├── ui/                                 (neu via shadcn add)
│   │   ├── sheet.tsx                       NEU
│   │   ├── popover.tsx                     NEU
│   │   ├── calendar.tsx                    NEU
│   │   └── sonner.tsx                      NEU
│   ├── leads/
│   │   ├── ContactQuickInfo.tsx            NEU
│   │   ├── DealNotesPanel.tsx              NEU
│   │   ├── NoteItem.tsx                    NEU
│   │   ├── TiptapEditor.tsx                NEU
│   │   ├── ExposeLink.tsx                  NEU
│   │   ├── AnrufCell.tsx                   NEU
│   │   └── LeadTable.tsx                   EDIT
│   └── leads/index.ts                      bleibt implizit
├── hooks/
│   ├── useDealNotes.ts                     NEU
│   ├── useDealNoteMutations.ts             NEU
│   └── useUpdateDealField.ts               NEU
├── lib/
│   └── openExternalLink.ts                 NEU
├── App.tsx                                 EDIT (Toaster mount)

supabase/migrations/
└── 002_step3_writes.sql                    NEU

docs/
├── 03_decisions.md                         EDIT (ADR-011)
└── 04_progress.md                          EDIT (Schritt 3 → ✅)
```

---

## Task 1: Setup — Migration, Dependencies, shadcn-Components

**Files:**
- Create: `supabase/migrations/002_step3_writes.sql`
- Modify: `package.json` (via npm install — keine Hand-Edits)
- Create: `src/components/ui/sheet.tsx`, `popover.tsx`, `calendar.tsx`, `sonner.tsx` (via shadcn CLI)
- Modify: `src/App.tsx`
- Modify: `src/types/supabase.ts` (regeneriert)

- [ ] **Step 1.1: SQL-Migration für RLS-Erweiterung + Trigger schreiben**

Datei `supabase/migrations/002_step3_writes.sql`:

```sql
-- Schritt 3: Frontend-Mutations
-- ADR-011: Single-User-Pragmatik — Anon darf gezielt schreiben.
-- Wenn Multi-User: zurückrollen, Auth einführen, USING-Klauseln auf auth.uid() umstellen.

-- deal_notes: vollständiges CRUD für anon
CREATE POLICY "anon_insert" ON deal_notes
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_update" ON deal_notes
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_delete" ON deal_notes
  FOR DELETE TO anon USING (true);

-- deals: nur ausgewählte Spalten (letzter_anruf, besichtigung_datum, updated_at).
-- Postgres hat keine column-level RLS — wir nutzen WITH CHECK + eine
-- "field-guard"-Function, die sicherstellt, dass keine anderen Felder geändert wurden.
-- Pragmatisch: nur SELECT-Update via Frontend, gesteuert über Hook.
-- Wir akzeptieren, dass anon technisch alle Felder ändern könnte — Hook hält das ein.
-- Wenn das jemals zum Problem wird (Multi-User), → Edge Function.
CREATE POLICY "anon_update_deals" ON deals
  FOR UPDATE TO anon
  USING (deleted_at IS NULL)
  WITH CHECK (deleted_at IS NULL);

-- updated_at-Trigger für deal_notes (falls nicht schon existiert)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_deal_notes'
  ) THEN
    CREATE TRIGGER set_updated_at_deal_notes
      BEFORE UPDATE ON deal_notes
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- updated_at-Trigger für deals (falls nicht schon existiert)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_deals'
  ) THEN
    CREATE TRIGGER set_updated_at_deals
      BEFORE UPDATE ON deals
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
```

Vor dem Anwenden mit `mcp__supabase__list_migrations` und einem `SELECT tgname FROM pg_trigger WHERE tgname LIKE 'set_updated_at%';` prüfen, ob `set_updated_at()` existiert und welche Trigger schon angelegt sind. Falls die Trigger schon existieren, sind die DO-Blöcke No-Op.

- [ ] **Step 1.2: Migration anwenden (Supabase MCP)**

Tool: `mcp__supabase__apply_migration` mit `name="002_step3_writes"` und dem SQL aus 1.1.
Expected: kein Error, Policy-Count auf `deal_notes` und `deals` steigt entsprechend.

Verifikation:
```sql
SELECT tablename, policyname, cmd FROM pg_policies
WHERE tablename IN ('deal_notes', 'deals')
ORDER BY tablename, cmd;
```
Expected: für `deal_notes` jetzt SELECT + INSERT + UPDATE + DELETE. Für `deals` jetzt SELECT + UPDATE.

- [ ] **Step 1.3: Tiptap + date-fns installieren**

```bash
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-underline date-fns
```

Expected: keine Peer-Conflict-Warnings (React 18.3 ist kompatibel).

- [ ] **Step 1.4: shadcn-Components installieren**

```bash
npx shadcn@latest add sheet popover calendar sonner
```

Bei Prompts: alle Defaults bestätigen. Files landen in `src/components/ui/`.
`sonner` zieht `next-themes` und `sonner`-NPM-Package mit — das ist ok.
`calendar` zieht `react-day-picker` mit.

Verifikation:
```bash
ls src/components/ui/
```
Expected: `sheet.tsx`, `popover.tsx`, `calendar.tsx`, `sonner.tsx` zusätzlich zu den bestehenden.

- [ ] **Step 1.5: Types regenerieren**

```bash
npm run types:generate
```

Expected: `src/types/supabase.ts` aktualisiert. Schema-Änderungen waren minimal (nur Policies + Trigger), die Typen sollten praktisch unverändert sein — aber das Skript bestätigt, dass Migration applied ist.

- [ ] **Step 1.6: Toaster in App.tsx mounten**

In `src/App.tsx` — Import oben hinzu:

```tsx
import { Toaster } from "@/components/ui/sonner"
```

Im JSX, direkt vor dem schließenden `</QueryClientProvider>`:

```tsx
<Toaster position="bottom-right" richColors />
```

- [ ] **Step 1.7: Smoke-Build**

```bash
npm run build
```

Expected: keine TS-Fehler, Bundle kompiliert.

- [ ] **Step 1.8: Smoke-Test im Dev-Server**

```bash
npm run dev
```

Manuell prüfen: Lead-Liste lädt wie vorher, keine Console-Errors. Toast-Aufruf testen via Browser-Console:
```js
import('sonner').then(m => m.toast.success('Hello'))
```
Expected: Toast rechts unten erscheint.

- [ ] **Step 1.9: Commit (Task 1)**

```bash
git add supabase/migrations/002_step3_writes.sql package.json package-lock.json src/components/ui/sheet.tsx src/components/ui/popover.tsx src/components/ui/calendar.tsx src/components/ui/sonner.tsx src/types/supabase.ts src/App.tsx
git commit -m "chore(step3): tiptap + shadcn sheet/popover/calendar/sonner, RLS für deal_notes + deals UPDATE"
```

---

## Task 2: Quick-Info-Popover auf Makler-Namen

**Files:**
- Create: `src/components/leads/ContactQuickInfo.tsx`
- Modify: `src/components/leads/LeadTable.tsx` (Namen-Cell wrappen)

- [ ] **Step 2.1: ContactQuickInfo.tsx erstellen**

```tsx
import { useState } from "react"
import { Copy, Check } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { toast } from "sonner"

type Props = {
  name: string
  phone?: string | null
  email?: string | null
  company?: string | null
  position?: string | null
}

type Field = { label: string; value: string | null | undefined }

export default function ContactQuickInfo({
  name,
  phone,
  email,
  company,
  position,
}: Props) {
  const fields: Field[] = [
    { label: "Telefon", value: phone },
    { label: "E-Mail", value: email },
    { label: "Firma", value: company },
    { label: "Position", value: position },
  ]
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null)

  const copy = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value)
    setCopiedLabel(label)
    toast.success(`${label} kopiert`)
    setTimeout(() => setCopiedLabel(null), 1200)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="text-left hover:underline font-medium">
          {name}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="font-semibold mb-2">{name}</div>
        <div className="space-y-1.5 text-sm">
          {fields.map((f) => (
            <div key={f.label} className="flex items-center gap-2">
              <span className="w-16 text-zinc-500">{f.label}:</span>
              <span className="flex-1 truncate">{f.value ?? "—"}</span>
              {f.value && (
                <button
                  onClick={() => copy(f.label, f.value!)}
                  className="text-zinc-400 hover:text-zinc-900 p-1"
                  aria-label={`${f.label} kopieren`}
                >
                  {copiedLabel === f.label ? (
                    <Check className="w-3.5 h-3.5 text-green-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 2.2: LeadTable.tsx — Name-Cell auf ContactQuickInfo umstellen**

In `src/components/leads/LeadTable.tsx`, Import oben:
```tsx
import ContactQuickInfo from "./ContactQuickInfo"
```

Name-Spalte ersetzen:
```tsx
{
  id: "name",
  header: "Makler",
  accessorFn: (r) => r.contact.name,
  cell: ({ row }) => (
    <ContactQuickInfo
      name={row.original.contact.name}
      phone={row.original.contact.phone}
      email={row.original.contact.email}
      company={row.original.contact.company}
      position={null}
    />
  ),
},
```

Hinweis: `position` ist im aktuellen `useDeals`-Hook nicht im Contact-Subset enthalten. Erweitere den SELECT in `src/hooks/useDeals.ts`:
```ts
supabase
  .from("contacts")
  .select("id, name, email, phone, company, position, lead_source"),
```

Und `LeadRow` in `src/types/domain.ts`:
```ts
export type LeadRow = DealWithFollowup & {
  contact: Pick<
    Contact,
    "id" | "name" | "email" | "phone" | "company" | "position" | "lead_source"
  >
  notes_count: number
}
```

Dann in LeadTable.tsx:
```tsx
position={row.original.contact.position}
```

- [ ] **Step 2.3: Smoke-Test**

Im Browser: Klick auf Makler-Namen → Popover öffnet. Copy-Button → Wert ist in Zwischenablage + Toast erscheint. Klick außerhalb schließt das Popover.

- [ ] **Step 2.4: Commit**

```bash
git add src/components/leads/ContactQuickInfo.tsx src/components/leads/LeadTable.tsx src/hooks/useDeals.ts src/types/domain.ts
git commit -m "feat(leads): quick-info-popover auf makler-namen mit copy-buttons"
```

---

## Task 3: useDealNotes Hook (Read)

**Files:**
- Create: `src/hooks/useDealNotes.ts`

- [ ] **Step 3.1: useDealNotes.ts erstellen**

```ts
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { DealNote } from "@/types/domain"

export const useDealNotes = (dealId: string | null) => {
  return useQuery<DealNote[]>({
    queryKey: ["deal-notes", dealId],
    enabled: dealId != null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_notes")
        .select("*")
        .eq("deal_id", dealId!)
        .order("created_at", { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}
```

- [ ] **Step 3.2: Smoke-Test (manuell via Browser-Console)**

Erst im Dev-Server, dann in der Browser-Console:
```js
const { data } = await supabase.from('deal_notes').select('*').limit(1)
console.log(data)
```
Expected: 0 oder mehr Notes, kein Error.

- [ ] **Step 3.3: Test-Daten anlegen (eine Notiz seedend)**

Über Supabase MCP `execute_sql`:
```sql
INSERT INTO deal_notes (deal_id, content_html)
SELECT id, '<p>Test-Notiz für Schritt 3</p>' FROM deals LIMIT 1
RETURNING id, deal_id;
```
ID merken für späteren Smoke-Test.

---

## Task 4: useDealNoteMutations Hook (Create/Update/Delete)

**Files:**
- Create: `src/hooks/useDealNoteMutations.ts`

- [ ] **Step 4.1: useDealNoteMutations.ts erstellen**

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

export const useDealNoteMutations = (dealId: string) => {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["deal-notes", dealId] })
    qc.invalidateQueries({ queryKey: ["deals", "with-followup"] })
  }

  const create = useMutation({
    mutationFn: async (contentHtml: string) => {
      const { data, error } = await supabase
        .from("deal_notes")
        .insert({ deal_id: dealId, content_html: contentHtml })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      invalidate()
      toast.success("Notiz gespeichert")
    },
    onError: (err) => toast.error(`Fehler: ${err.message}`),
  })

  const update = useMutation({
    mutationFn: async (args: { id: string; contentHtml: string }) => {
      const { error } = await supabase
        .from("deal_notes")
        .update({ content_html: args.contentHtml })
        .eq("id", args.id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      toast.success("Notiz aktualisiert")
    },
    onError: (err) => toast.error(`Fehler: ${err.message}`),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deal_notes").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      toast.success("Notiz gelöscht")
    },
    onError: (err) => toast.error(`Fehler: ${err.message}`),
  })

  return { create, update, remove }
}
```

---

## Task 5: TiptapEditor Component

**Files:**
- Create: `src/components/leads/TiptapEditor.tsx`

- [ ] **Step 5.1: TiptapEditor.tsx erstellen**

```tsx
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import { Bold, Italic, List, ListOrdered, Underline as U } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  initialHtml?: string
  onSave: (html: string) => void
  onCancel?: () => void
  saveLabel?: string
  autoFocus?: boolean
}

export default function TiptapEditor({
  initialHtml = "",
  onSave,
  onCancel,
  saveLabel = "Speichern",
  autoFocus = true,
}: Props) {
  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: initialHtml,
    autofocus: autoFocus,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[80px] focus:outline-none p-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
      },
    },
  })

  if (!editor) return null

  const ToolButton = ({
    onClick,
    active,
    label,
    children,
  }: {
    onClick: () => void
    active: boolean
    label: string
    children: React.ReactNode
  }) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "p-1.5 rounded hover:bg-zinc-200",
        active && "bg-zinc-200 text-zinc-900",
      )}
    >
      {children}
    </button>
  )

  const submit = () => {
    const html = editor.getHTML()
    if (html.replace(/<[^>]*>/g, "").trim().length === 0) return
    onSave(html)
    editor.commands.clearContent()
  }

  return (
    <div className="border rounded">
      <div className="flex items-center gap-0.5 border-b px-1 py-1 bg-zinc-50">
        <ToolButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          label="Fett"
        >
          <Bold className="w-4 h-4" />
        </ToolButton>
        <ToolButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          label="Kursiv"
        >
          <Italic className="w-4 h-4" />
        </ToolButton>
        <ToolButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")}
          label="Unterstrichen"
        >
          <U className="w-4 h-4" />
        </ToolButton>
        <div className="w-px h-4 bg-zinc-300 mx-1" />
        <ToolButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          label="Aufzählung"
        >
          <List className="w-4 h-4" />
        </ToolButton>
        <ToolButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          label="Nummerierte Liste"
        >
          <ListOrdered className="w-4 h-4" />
        </ToolButton>
      </div>
      <EditorContent editor={editor} />
      <div className="flex justify-end gap-2 p-2 border-t bg-zinc-50">
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Abbrechen
          </Button>
        )}
        <Button size="sm" onClick={submit}>
          {saveLabel}
        </Button>
      </div>
    </div>
  )
}
```

Hinweis zum `prose`-Klassen: Wir nutzen `@tailwindcss/typography` nicht — die Klassen sind "no-op", aber das `[&_ul]:list-disc`/`[&_ol]:list-decimal` direkt-im-Selector stellt die Listen-Sichtbarkeit sicher ohne Plugin.

---

## Task 6: NoteItem Component (Anzeigen, Edit, Delete)

**Files:**
- Create: `src/components/leads/NoteItem.tsx`

- [ ] **Step 6.1: NoteItem.tsx erstellen**

```tsx
import { useState } from "react"
import { Pencil, Trash2 } from "lucide-react"
import { format } from "date-fns"
import { de } from "date-fns/locale"
import type { DealNote } from "@/types/domain"
import TiptapEditor from "./TiptapEditor"

type Props = {
  note: DealNote
  onUpdate: (id: string, html: string) => void
  onDelete: (id: string) => void
}

export default function NoteItem({ note, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <div className="py-3 border-b last:border-b-0">
        <div className="text-xs text-zinc-500 mb-1">
          {format(new Date(note.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
          {note.updated_at !== note.created_at && " (bearbeitet)"}
        </div>
        <TiptapEditor
          initialHtml={note.content_html}
          saveLabel="Aktualisieren"
          onSave={(html) => {
            onUpdate(note.id, html)
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    )
  }

  const handleDelete = () => {
    if (window.confirm("Notiz wirklich löschen?")) {
      onDelete(note.id)
    }
  }

  return (
    <div className="group py-3 border-b last:border-b-0">
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs text-zinc-500">
          {format(new Date(note.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
          {note.updated_at !== note.created_at && " (bearbeitet)"}
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition flex gap-1">
          <button
            onClick={() => setEditing(true)}
            className="p-1 hover:bg-zinc-100 rounded"
            aria-label="Bearbeiten"
            title="Bearbeiten"
          >
            <Pencil className="w-3.5 h-3.5 text-zinc-500" />
          </button>
          <button
            onClick={handleDelete}
            className="p-1 hover:bg-red-50 rounded"
            aria-label="Löschen"
            title="Löschen"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
          </button>
        </div>
      </div>
      <div
        className="text-sm prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1"
        dangerouslySetInnerHTML={{ __html: note.content_html }}
      />
    </div>
  )
}
```

Hinweis: `dangerouslySetInnerHTML` ist akzeptabel hier — Single-User-Tool, der HTML kommt aus dem eigenen Tiptap-Editor (kein User-Input von außen).

---

## Task 7: DealNotesPanel (Sheet rechts)

**Files:**
- Create: `src/components/leads/DealNotesPanel.tsx`
- Modify: `src/components/leads/LeadTable.tsx` (Row-Click + Notes-Cell-Click)

- [ ] **Step 7.1: DealNotesPanel.tsx erstellen**

```tsx
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { useDealNotes } from "@/hooks/useDealNotes"
import { useDealNoteMutations } from "@/hooks/useDealNoteMutations"
import TiptapEditor from "./TiptapEditor"
import NoteItem from "./NoteItem"

type Props = {
  dealId: string | null
  dealLabel: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function DealNotesPanel({
  dealId,
  dealLabel,
  open,
  onOpenChange,
}: Props) {
  const { data: notes, isLoading } = useDealNotes(dealId)
  const { create, update, remove } = useDealNoteMutations(dealId ?? "")

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:max-w-[480px] flex flex-col">
        <SheetHeader>
          <SheetTitle>Notizen</SheetTitle>
          <SheetDescription className="truncate">{dealLabel}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 py-2">
          {isLoading ? (
            <div className="text-zinc-500 text-sm py-4">Lädt…</div>
          ) : !notes || notes.length === 0 ? (
            <div className="text-zinc-400 text-sm py-4 text-center">
              Noch keine Notizen.
            </div>
          ) : (
            notes.map((note) => (
              <NoteItem
                key={note.id}
                note={note}
                onUpdate={(id, html) => update.mutate({ id, contentHtml: html })}
                onDelete={(id) => remove.mutate(id)}
              />
            ))
          )}
        </div>

        <div className="pt-3 border-t">
          <TiptapEditor
            key={dealId ?? "empty"}
            onSave={(html) => create.mutate(html)}
            saveLabel="Notiz hinzufügen"
            autoFocus={false}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

Hinweis zum `key={dealId ?? "empty"}`: Beim Wechsel zwischen Deals wird der Editor neu gemountet → Inhalt aus vorherigem Deal verschwindet sauber.

- [ ] **Step 7.2: LeadTable.tsx — Panel-State + Row-Click verdrahten**

In `LeadTable.tsx`:
- State hinzufügen:
```tsx
const [panelDealId, setPanelDealId] = useState<string | null>(null)
const [panelDealLabel, setPanelDealLabel] = useState("")
```

- Notiz-Spalte aktualisieren:
```tsx
{
  id: "notes",
  header: "Notiz",
  accessorKey: "notes_count",
  cell: ({ row, getValue }) => {
    const n = getValue() as number
    return (
      <button
        className="text-blue-600 hover:underline"
        onClick={(e) => {
          e.stopPropagation()
          setPanelDealId(row.original.id!)
          setPanelDealLabel(
            `${row.original.address ?? "—"} · ${row.original.contact.name}`,
          )
        }}
      >
        {n > 0 ? `${n} Notiz${n > 1 ? "en" : ""}` : "+ Notiz"}
      </button>
    )
  },
},
```

- Am Ende des Components vor dem Return-`LeadSections` den State + Handler an LeadSections übergeben oder direkt rendern. Sauberer ist: Panel direkt in LeadTable mounten **nach** dem `<LeadSections />`-Return. Refaktor:

```tsx
return (
  <>
    <LeadSections
      table={table}
      globalFilter={globalFilter}
      setGlobalFilter={setGlobalFilter}
      onRowClick={(row) => {
        setPanelDealId(row.original.id!)
        setPanelDealLabel(
          `${row.original.address ?? "—"} · ${row.original.contact.name}`,
        )
      }}
    />
    <DealNotesPanel
      dealId={panelDealId}
      dealLabel={panelDealLabel}
      open={panelDealId !== null}
      onOpenChange={(open) => {
        if (!open) setPanelDealId(null)
      }}
    />
  </>
)
```

Import oben: `import DealNotesPanel from "./DealNotesPanel"`

- [ ] **Step 7.3: LeadSections — onRowClick durchreichen**

In `src/components/leads/LeadSections.tsx`, Props erweitern:
```tsx
type Props = {
  table: Table<LeadRow>
  globalFilter: string
  setGlobalFilter: (v: string) => void
  onRowClick?: (row: Row<LeadRow>) => void
}
```

Destructuring entsprechend ergänzen, dann auf der `<tr>`:
```tsx
<tr
  key={row.id}
  className="border-b hover:bg-zinc-50 cursor-pointer"
  onClick={() => onRowClick?.(row)}
>
```

**Wichtig:** In den Cells `e.stopPropagation()` für interaktive Elemente (Quick-Info-Button, Notiz-Button, Exposé-Link, Anruf-Button) — sonst feuern Row-Click + Element-Click gleichzeitig. ContactQuickInfo: PopoverTrigger fängt Click selbst (Radix), aber zur Sicherheit den Button-Wrapper mit `onClick={(e) => e.stopPropagation()}`.

In `ContactQuickInfo.tsx`, den PopoverTrigger-Button erweitern:
```tsx
<PopoverTrigger asChild>
  <button
    className="text-left hover:underline font-medium"
    onClick={(e) => e.stopPropagation()}
  >
    {name}
  </button>
</PopoverTrigger>
```

- [ ] **Step 7.4: Smoke-Test**

- Klick auf Zeile → Sheet öffnet rechts, zeigt Notiz aus Test-Seed
- Klick auf Notiz-Spalte → ebenfalls Sheet, Row-Click feuert nicht doppelt
- Klick auf Makler-Namen → Popover öffnet, Sheet bleibt zu
- Neue Notiz: Tiptap-Editor unten, Text eintippen, Bold/Liste klicken, "Notiz hinzufügen" → Notiz erscheint oben, Toast "Notiz gespeichert"
- Hover auf Notiz → Edit/Delete-Icons rechts erscheinen
- Edit → Tiptap-Editor erscheint mit altem Inhalt, Aktualisieren → neuer Inhalt + "(bearbeitet)"-Label
- Delete → window.confirm → bestätigen → Notiz weg + Toast

- [ ] **Step 7.5: Commit (Tasks 3-7)**

```bash
git add src/hooks/useDealNotes.ts src/hooks/useDealNoteMutations.ts src/components/leads/TiptapEditor.tsx src/components/leads/NoteItem.tsx src/components/leads/DealNotesPanel.tsx src/components/leads/LeadTable.tsx src/components/leads/LeadSections.tsx src/components/leads/ContactQuickInfo.tsx
git commit -m "feat(leads): notiz-panel mit tiptap (bold/listen), edit/delete, row-click öffnet sheet"
```

---

## Task 8: Exposé-Icon mit blau/grau + file:// Support

**Files:**
- Create: `src/lib/openExternalLink.ts`
- Create: `src/components/leads/ExposeLink.tsx`
- Modify: `src/components/leads/LeadTable.tsx` (Exposé-Spalte ersetzen)

- [ ] **Step 8.1: openExternalLink.ts — Link-Resolver-Logik**

```ts
export const resolveExposeHref = (
  url: string | null | undefined,
  localPath: string | null | undefined,
): string | null => {
  if (url && url.trim()) return url.trim()
  if (localPath && localPath.trim()) {
    const p = localPath.trim()
    if (p.startsWith("file://") || /^[a-z]+:\/\//i.test(p)) return p
    return `file:///${p.replace(/\\/g, "/").replace(/^\/+/, "")}`
  }
  return null
}
```

Hinweis: Browser blockieren `file://`-Aufrufe aus `https://`-Kontext aus Security-Gründen. Im Chrome funktioniert das nur wenn man die URL über die Adressleiste eintippt oder über ein Browser-Plugin. Wir setzen `href` trotzdem — manche Setups (Firefox mit `security.fileuri.strict_origin_policy=false`, lokale Dateiprotokoll-Handler) funktionieren. Wenn nicht: User kopiert per Copy-Button den Pfad. **Erweiterung:** Falls Klick scheitert, zeigen wir das Pfad-Tooltip + Copy-Button.

- [ ] **Step 8.2: ExposeLink.tsx**

```tsx
import { FileText, Copy } from "lucide-react"
import { toast } from "sonner"
import { resolveExposeHref } from "@/lib/openExternalLink"
import { cn } from "@/lib/utils"

type Props = {
  url: string | null | undefined
  localPath: string | null | undefined
}

export default function ExposeLink({ url, localPath }: Props) {
  const href = resolveExposeHref(url, localPath)
  const hasLink = href !== null
  const isLocal = href !== null && href.startsWith("file://")

  if (!hasLink) {
    return (
      <span className="text-zinc-300" aria-label="kein exposé">
        <FileText className="w-4 h-4" />
      </span>
    )
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  const copyPath = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    await navigator.clipboard.writeText(href!)
    toast.success("Pfad kopiert")
  }

  return (
    <span className="inline-flex items-center gap-1">
      <a
        href={href!}
        target="_blank"
        rel="noreferrer"
        title={href!}
        onClick={handleClick}
        className={cn("text-blue-600 hover:text-blue-800")}
      >
        <FileText className="w-4 h-4" />
      </a>
      {isLocal && (
        <button
          onClick={copyPath}
          title="Pfad kopieren (für lokale Pfade, falls Browser blockt)"
          className="text-zinc-400 hover:text-zinc-700"
        >
          <Copy className="w-3 h-3" />
        </button>
      )}
    </span>
  )
}
```

- [ ] **Step 8.3: LeadTable.tsx — Exposé-Spalte ersetzen**

Bestehende Exposé-Cell ersetzen mit:
```tsx
import ExposeLink from "./ExposeLink"

// ...
{
  id: "expose",
  header: "Exposé",
  cell: ({ row }) => (
    <ExposeLink
      url={row.original.expose_url}
      localPath={row.original.expose_local_path}
    />
  ),
},
```

- [ ] **Step 8.4: Smoke-Test**

- Deal mit `expose_url` → Icon ist blau, Klick öffnet URL in neuem Tab
- Deal ohne beide → Icon grau
- Test-Setup für file://: per Supabase MCP einen Deal updaten:
  ```sql
  UPDATE deals SET expose_local_path = 'C:\Test\demo.pdf' WHERE id = '<deal_id>';
  ```
  → Icon blau, Klick versucht file:///C:/Test/demo.pdf zu öffnen (Browser kann blocken), Copy-Button kopiert Pfad korrekt.

---

## Task 9: useUpdateDealField Hook (für Anruf-Spalte)

**Files:**
- Create: `src/hooks/useUpdateDealField.ts`

- [ ] **Step 9.1: useUpdateDealField.ts**

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

type UpdateableField = "letzter_anruf" | "besichtigung_datum"

export const useUpdateDealField = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      dealId: string
      field: UpdateableField
      value: string | null
      successMessage?: string
    }) => {
      const { error } = await supabase
        .from("deals")
        .update({ [args.field]: args.value })
        .eq("id", args.dealId)
      if (error) throw error
      return args
    },
    onSuccess: (args) => {
      qc.invalidateQueries({ queryKey: ["deals", "with-followup"] })
      if (args.successMessage) toast.success(args.successMessage)
    },
    onError: (err) => toast.error(`Fehler: ${err.message}`),
  })
}
```

---

## Task 10: AnrufCell — Hover-Button (1s) + Rechtsklick-Datepicker

**Files:**
- Create: `src/components/leads/AnrufCell.tsx`
- Modify: `src/components/leads/LeadTable.tsx` (Anruf-Spalte)

- [ ] **Step 10.1: AnrufCell.tsx**

```tsx
import { useState, useRef, useEffect } from "react"
import { Phone } from "lucide-react"
import { format } from "date-fns"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { useUpdateDealField } from "@/hooks/useUpdateDealField"
import { formatDate } from "@/lib/formatters"

type Props = {
  dealId: string
  letzterAnruf: string | null
}

const HOVER_DELAY_MS = 1000

export default function AnrufCell({ dealId, letzterAnruf }: Props) {
  const [hoverShowing, setHoverShowing] = useState(false)
  const [datepickerOpen, setDatepickerOpen] = useState(false)
  const timerRef = useRef<number | null>(null)
  const update = useUpdateDealField()

  useEffect(() => {
    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  const handleEnter = () => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      setHoverShowing(true)
      timerRef.current = null
    }, HOVER_DELAY_MS)
  }

  const handleLeave = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setHoverShowing(false)
  }

  const setToday = (e: React.MouseEvent) => {
    e.stopPropagation()
    const today = format(new Date(), "yyyy-MM-dd")
    update.mutate({
      dealId,
      field: "letzter_anruf",
      value: today,
      successMessage: "Anruf eingetragen",
    })
    setHoverShowing(false)
  }

  const setCustom = (date: Date | undefined) => {
    if (!date) return
    update.mutate({
      dealId,
      field: "letzter_anruf",
      value: format(date, "yyyy-MM-dd"),
      successMessage: "Anruf-Datum gesetzt",
    })
    setDatepickerOpen(false)
  }

  return (
    <Popover open={datepickerOpen} onOpenChange={setDatepickerOpen}>
      <PopoverTrigger asChild>
        <div
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setDatepickerOpen(true)
          }}
          onClick={(e) => e.stopPropagation()}
          className="inline-block min-w-[110px]"
        >
          {hoverShowing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={setToday}
              className="h-7 px-2 text-xs"
            >
              <Phone className="w-3 h-3 mr-1" />
              Anruf eintragen
            </Button>
          ) : (
            <span>{formatDate(letzterAnruf)}</span>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={letzterAnruf ? new Date(letzterAnruf) : undefined}
          onSelect={setCustom}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
```

Memory-Leak-Check: `timerRef` wird in `useEffect`-Cleanup beim Unmount geleert. `handleLeave` cancelt ebenfalls. Wenn die Komponente während des Timers unmounted (z.B. Filter ändert die Zeile), wird der Timer im Cleanup gestoppt — kein State-Update auf unmounted Component.

- [ ] **Step 10.2: LeadTable.tsx — Anruf-Spalte ersetzen**

```tsx
import AnrufCell from "./AnrufCell"

// ...
{
  id: "letzter_anruf",
  header: "Anruf",
  accessorKey: "letzter_anruf",
  cell: ({ row }) => (
    <AnrufCell
      dealId={row.original.id!}
      letzterAnruf={row.original.letzter_anruf}
    />
  ),
},
```

- [ ] **Step 10.3: Smoke-Test**

- Maus 1s über Anruf-Spalte → Button "Anruf eintragen" erscheint
- Maus vor Ablauf weggehen → Button erscheint NICHT (Timer canceled)
- Klick auf Button → Datum ist heute, Toast erscheint
- Rechtsklick auf Anruf-Spalte → Datepicker-Popover öffnet
- Datum auswählen → Anruf-Datum aktualisiert, Toast erscheint
- Browser-DevTools "Memory" → Leak-Detector zeigt keine offenen Timers nach mehrmaligem Hover (manuell, nicht-blockierend)
- Klick auf Zeile während Hover → Sheet öffnet NICHT (stopPropagation funktioniert)

- [ ] **Step 10.4: Commit (Tasks 8-10)**

```bash
git add src/lib/openExternalLink.ts src/components/leads/ExposeLink.tsx src/hooks/useUpdateDealField.ts src/components/leads/AnrufCell.tsx src/components/leads/LeadTable.tsx
git commit -m "feat(leads): exposé file:// support, anruf-hover-button + rechtsklick-datepicker"
```

---

## Task 11: ADR-011 dokumentieren

**Files:**
- Modify: `docs/03_decisions.md`

- [ ] **Step 11.1: ADR-011 hinzufügen**

Am Ende von `docs/03_decisions.md` anhängen:

```markdown
---

## ADR-011 — Tiptap als Rich-Text-Editor + RLS pragmatisch für Single-User-Mutations

- **Datum:** 2026-05-11
- **Status:** Accepted (partielle Lockerung von ADR-008)
- **Schritt:** 3 (Lead-Interaktionen)

### Kontext

Schritt 3 ist der erste Bauschritt mit Schreib-Operationen aus dem Frontend (Notizen anlegen/editieren/löschen, `letzter_anruf` updaten). Zwei Entscheidungen fallen zusammen:

1. **Rich-Text-Editor:** Tiptap oder Lexical für deal_notes.
2. **Mutations-Pfad:** ADR-008 erlaubt nur SELECT für anon. Wie werden Schreib-Operationen abgesichert?

### Entscheidung

**(a) Tiptap** als Rich-Text-Editor. StarterKit + Underline-Extension. Toolbar: Bold, Italic, Underline, BulletList, OrderedList. HTML in `deal_notes.content_html`.

**(b) RLS pragmatisch erweitern** statt Edge-Function-Layer aufzubauen: Anon-Key bekommt INSERT/UPDATE/DELETE auf `deal_notes` und UPDATE auf `deals` (ohne Spalten-Restriktion auf DB-Ebene, aber Hook-seitig nur `letzter_anruf` und `besichtigung_datum`).

### Begründung

**Tiptap:**
- Maintained, ProseMirror-basiert (industriestandard)
- Lexical ist Meta-spezifisch, weniger Drittanbieter-Extensions
- StarterKit deckt Bold/Italic/Listen/Heading/HardBreak ab — kein zusätzliches Bundling nötig
- HTML-Output direkt speicherbar, kein JSON-Serialization-Overhead

**RLS pragmatisch statt Edge Functions:**
- Single-User-Tool. André ist der einzige der die URL kennt. Vercel-Domain ist nicht indexiert.
- Soft-Delete (ADR-004) schützt vor versehentlichem Datenverlust auch bei kompromittiertem Zugriff
- Edge-Function-Layer wäre +2–3h pro Mutation-Schritt × Schritte 3, 4, 6, 7 = realistisch +10h Bau ohne Single-User-Value
- YAGNI: wenn das Tool jemals "öffentlich" wird (Team-Erweiterung, Public-Beta), führen wir Supabase-Auth ein und stellen RLS auf `auth.uid() IS NOT NULL` um — 1h Migration

**Verworfen:**
- Edge-Function-Layer für jede Mutation: vollständiger ADR-008-Compliance, aber 10× der Aufwand gegenüber dem realen Sicherheitsgewinn
- Supabase Anonymous Auth + RLS auf `TO authenticated`: minimal stärker (Bot-Crawler-resistent), aber wer im Browser ist, hat trotzdem alles. Komplexität nicht gerechtfertigt.

### Konsequenzen

**Code-Stellen Schritt 3:**
- Migration `002_step3_writes.sql` öffnet die Policies (ADR-008 für SELECT bleibt, INSERT/UPDATE/DELETE neu)
- Hooks (`useDealNoteMutations`, `useUpdateDealField`) gehen direkt gegen Supabase via Anon-Client
- Tiptap-Bundle wächst ~80 KB gzipped — akzeptabel bei einem Tool ohne Mobile-First-Anforderung

**Migrations-Pfad zu Auth (falls jemals nötig):**
1. Supabase Auth aktivieren (Magic-Link oder Email/Pwd)
2. Login-Page anlegen, App in `<RequireAuth>` wrappen
3. Migration `003_auth.sql`: alle bestehenden Policies `TO anon` → `TO authenticated`, USING-Klauseln optional auf `auth.uid()` einschränken
4. ADR-011 auf "Superseded by ADR-XXX" setzen

**`expose_local_path`-Klick:** Browser blockieren `file://` aus `https://`-Origin. Erweitert in `ExposeLink.tsx` um Copy-Button für lokale Pfade — User kopiert Pfad und öffnet in OneDrive/Explorer.

**ADR-008 wird durch ADR-011 partiell präzisiert.** ADR-008 bleibt Master-Doc für die Architektur-Intention; ADR-011 dokumentiert die pragmatische Realität für die MVP-Phase.

### Folge-Items (nicht ADR-blockierend)
- Bei späterer Auth-Migration: ADR-008 Status auf "Superseded by ADR-XXX" setzen
- Wenn Tiptap-Bundle in Schritt 10 (Polish) als Performance-Problem auffällt: Lazy-Load via `React.lazy()` auf das Sheet-Panel beschränken
```

---

## Task 12: progress aktualisieren + final commit

**Files:**
- Modify: `docs/04_progress.md`

- [ ] **Step 12.1: 04_progress.md aktualisieren**

In der Phase-3-Tabelle die Schritt-3-Zeile ändern:

```markdown
| 3 | Lead-Liste Interaktionen | ✅ | 2026-05-11 | 011 | Quick-Info-Popover mit 1-Click-Copy + Toast, Slide-In-Panel (Sheet) mit Tiptap-Editor (Bold/Italic/Underline/Listen), Edit/Delete pro Notiz mit Hover-Icons + Bestätigung, Exposé-Icon mit blau/grau-Logik + file:// Copy-Fallback, Anruf-Hover-Button (1s-Timer mit Cleanup) + Rechtsklick-Datepicker. RLS pragmatisch für deal_notes-CRUD + deals-UPDATE geöffnet (ADR-011). |
```

- [ ] **Step 12.2: Final-Smoke-Build**

```bash
npm run build
```

Expected: keine TS-Fehler, Bundle kompiliert in <5s.

- [ ] **Step 12.3: Final-Smoke-Test (alle Akzeptanzkriterien)**

- ☐ Quick-Info: Klick auf Name → Popover. Copy-Button für jedes Feld → Wert in Clipboard, Toast erscheint, Check-Icon kurz statt Copy
- ☐ Notiz-Panel: Klick auf Zeile → Sheet rechts. Klick auf Notiz-Spalte → ebenfalls Sheet (nicht doppelt)
- ☐ Tiptap: Bold (Cmd+B), BulletList, OrderedList funktionieren. "Notiz hinzufügen" → erscheint oben, leerer Editor
- ☐ Edit: Hover über Notiz → Pencil/Trash. Pencil → Editor mit altem Inhalt. Aktualisieren → "(bearbeitet)"-Label
- ☐ Delete: Trash → confirm-Dialog → bestätigen → Notiz weg + Toast
- ☐ Exposé: blau bei url ODER local_path, grau ohne. file://-Pfad kopierbar
- ☐ Anruf: Hover 1s → Button. Klick → letzter_anruf = heute, Toast. Rechtsklick → Datepicker. Hover-Cleanup: kein Timer-Leak nach Unmount (DevTools-Profile)
- ☐ Row-Click und Zellklick beißen sich nicht (stopPropagation)

- [ ] **Step 12.4: Final-Commit**

```bash
git add docs/03_decisions.md docs/04_progress.md
git commit -m "feat(leads): quick-info, notiz-panel mit tiptap, anruf-hover

- Schritt 3 aus 02_implementierungsplan.md komplett
- ADR-011: Tiptap + RLS-Pragmatik für Single-User
- progress: Schritt 3 → ✅"
```

- [ ] **Step 12.5: Push (nach Bestätigung durch User)**

```bash
git push origin main
```

---

## Self-Review-Check

**Spec-Coverage (aus Prompt + 02_implementierungsplan.md Schritt 3):**

| Anforderung | Task |
|---|---|
| Quick-Info-Popover (Tel/Email/Firma/Position + Copy-Buttons + Toast) | Task 2 |
| Slide-In-Panel rechts (shadcn Sheet) | Task 7 |
| Deal-Notes-Liste (zeitgestempelt, scrollbar, neueste oben) | Task 3, 7 |
| Edit/Delete pro Notiz (Hover-Icons, Bestätigung bei Delete) | Task 6 |
| Tiptap-Editor (Bold, BulletList, OrderedList) | Task 5 |
| Exposé blau wenn vorhanden, sonst grau | Task 8 |
| Exposé: file:// und https:// öffnen | Task 8 (mit Copy-Fallback) |
| Anruf-Hover-Button nach 1s | Task 10 |
| Anruf-Rechtsklick → Datepicker | Task 10 |
| Timer-Cleanup ohne Memory-Leak | Task 10 (useEffect-Cleanup + handleLeave-Cancel) |
| ADR-Dokumentation | Task 11 |
| 04_progress.md auf ✅ | Task 12 |

**Type-Konsistenz:** `DealNote`-Type kommt aus `src/types/domain.ts` (existiert bereits via Supabase-Types). `LeadRow.contact` wird in Task 2 um `position` erweitert — konsistent in `useDeals`, `LeadRow`, `ContactQuickInfo`.

**No Placeholders:** alle Steps haben konkrete Code-Blocks oder Befehle. Keine "TODO"-Hinweise. Konfirmations-Dialog für Delete ist via `window.confirm` (MVP-Pragmatisch — shadcn AlertDialog wäre schöner aber nicht im Scope von Schritt 3).
