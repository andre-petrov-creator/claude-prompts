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
import BesichtigungCell from "./BesichtigungCell"
import DealNotesPanel from "./DealNotesPanel"
import {
  formatCurrency,
  formatDate,
  formatM2,
  isOverdue,
} from "@/lib/formatters"
import { cn } from "@/lib/utils"

const dash = (v: unknown) => (v == null || v === "" ? "" : String(v))

const formatAddress = (
  street: string | null | undefined,
  zip: string | null | undefined,
  city: string | null | undefined,
): string => {
  const top = (street ?? "").trim()
  const bottomParts = [zip, city].filter(Boolean).join(" ").trim()
  if (top && bottomParts) return `${top}, ${bottomParts}`
  return top || bottomParts
}

export default function LeadTable({ data }: { data: LeadRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = useState("")
  const [panelDealId, setPanelDealId] = useState<string | null>(null)
  const [panelDealLabel, setPanelDealLabel] = useState("")

  const openPanel = (row: LeadRow) => {
    setPanelDealId(row.id!)
    setPanelDealLabel(
      `${formatAddress(row.address, row.zip, row.city) || "—"} · ${row.contact.name}`,
    )
  }

  const columns = useMemo<ColumnDef<LeadRow>[]>(
    () => [
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
        size: 100,
        cell: ({ row }) => (
          <StatusBadge status={row.original.status as DealStatus} />
        ),
      },
      {
        id: "name",
        header: "Name",
        accessorFn: (r) => r.contact.name,
        size: 160,
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
        accessorFn: (r) => r.contact.company ?? "",
        size: 140,
        cell: ({ getValue }) => dash(getValue()),
      },
      {
        id: "phone",
        header: "Telefon",
        accessorFn: (r) => r.contact.phone ?? "",
        size: 130,
        cell: ({ getValue }) => dash(getValue()),
      },
      {
        id: "email",
        header: "E-Mail",
        accessorFn: (r) => r.contact.email ?? "",
        size: 200,
        cell: ({ getValue }) => dash(getValue()),
      },
      {
        id: "letzter_anruf",
        header: "Anruf",
        accessorKey: "letzter_anruf",
        size: 130,
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
        size: 130,
        cell: ({ row }) => (
          <BesichtigungCell
            dealId={row.original.id!}
            value={row.original.besichtigung_datum}
          />
        ),
      },
      {
        id: "lead_source",
        header: "Lead-Herkunft",
        accessorFn: (r) => r.contact.lead_source ?? "",
        size: 130,
        cell: ({ getValue }) => dash(getValue()),
      },
      {
        id: "address_full",
        header: "Adresse",
        accessorFn: (r) => formatAddress(r.address, r.zip, r.city),
        size: 220,
        cell: ({ row }) => {
          const top = (row.original.address ?? "").trim()
          const bottomParts = [row.original.zip, row.original.city]
            .filter(Boolean)
            .join(" ")
            .trim()
          if (!top && !bottomParts) return ""
          return (
            <div className="leading-tight">
              {top && <div>{top}</div>}
              {bottomParts && (
                <div className="text-xs text-zinc-500">{bottomParts}</div>
              )}
            </div>
          )
        },
      },
      {
        id: "object_type",
        header: "Verwendung",
        accessorKey: "object_type",
        size: 110,
        cell: ({ getValue }) => dash(getValue()),
      },
      {
        id: "wohnflaeche_m2",
        header: "Wohnfläche",
        accessorKey: "wohnflaeche_m2",
        size: 110,
        cell: ({ getValue }) => {
          const v = getValue()
          return v == null || v === "" ? "" : formatM2(v as number)
        },
      },
      {
        id: "preis_kauf",
        header: "Preis",
        accessorKey: "preis_kauf",
        size: 110,
        cell: ({ getValue }) => {
          const v = getValue()
          return v == null || v === "" ? "" : formatCurrency(v as number)
        },
      },
      {
        id: "preis_pro_m2",
        header: "€/m²",
        accessorKey: "preis_pro_m2",
        size: 90,
        cell: ({ getValue }) => {
          const v = getValue()
          return v == null || v === "" ? "" : formatCurrency(v as number)
        },
      },
      {
        id: "kalk_verkaufspreis",
        header: "Kalk Verkauf",
        accessorKey: "kalk_verkaufspreis",
        size: 120,
        cell: ({ getValue }) => {
          const v = getValue()
          return v == null || v === "" ? "" : formatCurrency(v as number)
        },
      },
      {
        id: "kalk_pro_m2",
        header: "Kalk €/m²",
        accessorKey: "kalk_pro_m2",
        size: 100,
        cell: ({ getValue }) => {
          const v = getValue()
          return v == null || v === "" ? "" : formatCurrency(v as number)
        },
      },
      {
        id: "mein_angebot",
        header: "Mein Angebot",
        accessorKey: "mein_angebot",
        size: 120,
        cell: ({ getValue }) => {
          const v = getValue()
          return v == null || v === "" ? "" : formatCurrency(v as number)
        },
      },
      {
        id: "angebot_datum",
        header: "Angebot gültig",
        accessorKey: "angebot_datum",
        size: 120,
        cell: ({ getValue }) => {
          const v = getValue() as string | null
          return v ? formatDate(v) : ""
        },
      },
      {
        id: "naechste_nachfass",
        header: "Nächste Nachfass",
        accessorKey: "naechste_nachfass",
        size: 130,
        cell: ({ getValue }) => {
          const v = getValue() as string | null
          if (!v) return ""
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
        size: 80,
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
        size: 100,
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
