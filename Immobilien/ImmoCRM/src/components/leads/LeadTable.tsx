import { useMemo, useState } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table"
import type { LeadRow, DealStatus } from "@/types/domain"
import StatusBadge from "./StatusBadge"
import LeadSections from "./LeadSections"
import ContactQuickInfo from "./ContactQuickInfo"
import ExposeLink from "./ExposeLink"
import AnrufCell from "./AnrufCell"
import DealNotesPanel from "./DealNotesPanel"
import {
  formatCurrency,
  formatDate,
  formatM2,
  isOverdue,
} from "@/lib/formatters"
import { cn } from "@/lib/utils"

export default function LeadTable({ data }: { data: LeadRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = useState("")
  const [panelDealId, setPanelDealId] = useState<string | null>(null)
  const [panelDealLabel, setPanelDealLabel] = useState("")

  const openPanel = (row: LeadRow) => {
    setPanelDealId(row.id!)
    setPanelDealLabel(`${row.address ?? "—"} · ${row.contact.name}`)
  }

  const columns = useMemo<ColumnDef<LeadRow>[]>(
    () => [
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
        cell: ({ row }) => (
          <StatusBadge status={row.original.status as DealStatus} />
        ),
      },
      {
        id: "name",
        header: "Name",
        accessorFn: (r) => r.contact.name,
        cell: ({ row }) => (
          <ContactQuickInfo
            name={row.original.contact.name}
            phone={row.original.contact.phone}
            email={row.original.contact.email}
            company={row.original.contact.company}
            position={row.original.contact.position}
          />
        ),
      },
      {
        id: "company",
        header: "Firma",
        accessorFn: (r) => r.contact.company ?? "—",
      },
      {
        id: "phone",
        header: "Telefon",
        accessorFn: (r) => r.contact.phone ?? "—",
      },
      {
        id: "email",
        header: "E-Mail",
        accessorFn: (r) => r.contact.email ?? "—",
      },
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
      {
        id: "besichtigung_datum",
        header: "Besichtigung",
        accessorKey: "besichtigung_datum",
        cell: ({ getValue }) => formatDate(getValue() as string),
      },
      {
        id: "lead_source",
        header: "Lead-Herkunft",
        accessorFn: (r) => r.contact.lead_source ?? "—",
      },
      {
        id: "address",
        header: "Objekt",
        accessorKey: "address",
        cell: ({ getValue }) => (getValue() as string) ?? "—",
      },
      {
        id: "zip_city",
        header: "Adresse",
        accessorFn: (r) => `${r.zip ?? ""} ${r.city ?? ""}`.trim() || "—",
      },
      {
        id: "object_type",
        header: "Verwendung",
        accessorKey: "object_type",
        cell: ({ getValue }) => (getValue() as string) ?? "—",
      },
      {
        id: "wohnflaeche_m2",
        header: "Wohnfläche",
        accessorKey: "wohnflaeche_m2",
        cell: ({ getValue }) => formatM2(getValue() as number),
      },
      {
        id: "preis_kauf",
        header: "Preis",
        accessorKey: "preis_kauf",
        cell: ({ getValue }) => formatCurrency(getValue() as number),
      },
      {
        id: "preis_pro_m2",
        header: "€/m²",
        accessorKey: "preis_pro_m2",
        cell: ({ getValue }) => formatCurrency(getValue() as number),
      },
      {
        id: "kalk_verkaufspreis",
        header: "Kalk Verkauf",
        accessorKey: "kalk_verkaufspreis",
        cell: ({ getValue }) => formatCurrency(getValue() as number),
      },
      {
        id: "kalk_pro_m2",
        header: "Kalk €/m²",
        accessorKey: "kalk_pro_m2",
        cell: ({ getValue }) => formatCurrency(getValue() as number),
      },
      {
        id: "mein_angebot",
        header: "Mein Angebot",
        accessorKey: "mein_angebot",
        cell: ({ getValue }) => formatCurrency(getValue() as number),
      },
      {
        id: "angebot_datum",
        header: "Angebot gültig",
        accessorKey: "angebot_datum",
        cell: ({ getValue }) => formatDate(getValue() as string),
      },
      {
        id: "naechste_nachfass",
        header: "Nächste Nachfass",
        accessorKey: "naechste_nachfass",
        cell: ({ getValue }) => {
          const v = getValue() as string | null
          return (
            <span
              className={cn(isOverdue(v) && "text-red-600 font-semibold")}
            >
              {formatDate(v)}
            </span>
          )
        },
      },
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
      {
        id: "notes",
        header: "Notizen",
        accessorKey: "notes_count",
        cell: ({ row, getValue }) => {
          const n = getValue() as number
          return (
            <button
              className="text-blue-600 hover:underline"
              onClick={(e) => {
                e.stopPropagation()
                openPanel(row.original)
              }}
            >
              {n > 0 ? `${n} Notiz${n > 1 ? "en" : ""}` : "+ Notiz"}
            </button>
          )
        },
      },
    ],
    [],
  )

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, globalFilter },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <>
      <LeadSections
        table={table}
        globalFilter={globalFilter}
        setGlobalFilter={setGlobalFilter}
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
}
