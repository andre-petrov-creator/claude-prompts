import { useMemo, useState, useEffect } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type ColumnSizingState,
} from "@tanstack/react-table"
import type { LeadRow, DealStatus } from "@/types/domain"
import StatusBadge from "./StatusBadge"
import LeadSections from "./LeadSections"
import ContactQuickInfo from "./ContactQuickInfo"
import AnrufCell from "./AnrufCell"
import BesichtigungCell from "./BesichtigungCell"
import ClickableDateCell from "./ClickableDateCell"
import EditableTextCell from "./EditableTextCell"
import EditableNumberCell from "./EditableNumberCell"
import EditableSelectCell from "./EditableSelectCell"
import EditableComboboxCell from "./EditableComboboxCell"
import EditableAddressCell from "./EditableAddressCell"
import EditableExposeCell from "./EditableExposeCell"
import DealNotesPanel from "./DealNotesPanel"
import {
  formatCurrency,
  formatDate,
  formatM2,
  isOverdue,
} from "@/lib/formatters"
import { cn } from "@/lib/utils"
import {
  useUpdateDealField,
  type EditableDealField,
} from "@/hooks/useUpdateDealField"
import {
  useUpdateContactField,
  type EditableContactField,
} from "@/hooks/useUpdateContactField"
import { useDistinctValues } from "@/hooks/useDistinctValues"

const STATUS_OPTIONS: { value: DealStatus; label: string }[] = [
  { value: "offen", label: "Offen" },
  { value: "berechnet", label: "Berechnet" },
  { value: "absage", label: "Absage" },
]

const OBJECT_TYPE_DEFAULTS = ["MFH", "ETW", "REH", "EFH", "DHH", "Bungalow"]
const VERWENDUNG_DEFAULTS = ["B&H", "F&F"]
const LEAD_SOURCE_DEFAULTS = [
  "Online",
  "Off-Market",
  "Entrümpler",
  "Direktkontakt",
  "Auktion",
]

const STORAGE_KEYS = {
  columnSizing: "immo-crm.leadTable.columnSizing",
  columnVisibility: "immo-crm.leadTable.columnVisibility",
  sorting: "immo-crm.leadTable.sorting",
} as const

const dedupSorted = (a: string[], b: string[]) =>
  Array.from(new Set([...a, ...b])).sort((x, y) => x.localeCompare(y))

const loadJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

const saveJson = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // localStorage full or disabled — silently ignore
  }
}

export default function LeadTable({ data }: { data: LeadRow[] }) {
  const [sorting, setSorting] = useState<SortingState>(() =>
    loadJson(STORAGE_KEYS.sorting, [] as SortingState),
  )
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    () => loadJson(STORAGE_KEYS.columnVisibility, {} as VisibilityState),
  )
  const [globalFilter, setGlobalFilter] = useState("")
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() =>
    loadJson(STORAGE_KEYS.columnSizing, {} as ColumnSizingState),
  )
  const [panelDealId, setPanelDealId] = useState<string | null>(null)
  const [panelDealLabel, setPanelDealLabel] = useState("")

  useEffect(() => {
    saveJson(STORAGE_KEYS.columnSizing, columnSizing)
  }, [columnSizing])

  useEffect(() => {
    saveJson(STORAGE_KEYS.columnVisibility, columnVisibility)
  }, [columnVisibility])

  useEffect(() => {
    saveJson(STORAGE_KEYS.sorting, sorting)
  }, [sorting])

  const updateDeal = useUpdateDealField()
  const updateContact = useUpdateContactField()
  const { data: leadSourceValues } = useDistinctValues("contacts", "lead_source")
  const { data: objectTypeValues } = useDistinctValues("deals", "object_type")
  const { data: verwendungValues } = useDistinctValues("deals", "verwendung")

  const leadSourceOptions = useMemo(
    () => dedupSorted(LEAD_SOURCE_DEFAULTS, leadSourceValues ?? []),
    [leadSourceValues],
  )
  const objectTypeOptions = useMemo(
    () => dedupSorted(OBJECT_TYPE_DEFAULTS, objectTypeValues ?? []),
    [objectTypeValues],
  )
  const verwendungOptions = useMemo(
    () => dedupSorted(VERWENDUNG_DEFAULTS, verwendungValues ?? []),
    [verwendungValues],
  )

  const patchDeal = (
    dealId: string,
    patch: Partial<Record<EditableDealField, string | number | null>>,
    successMessage = "Gespeichert",
  ) => updateDeal.mutate({ dealId, patch, successMessage })

  const patchContact = (
    contactId: string,
    patch: Partial<Record<EditableContactField, string | null>>,
    successMessage = "Gespeichert",
  ) => updateContact.mutate({ contactId, patch, successMessage })

  const openPanel = (row: LeadRow) => {
    setPanelDealId(row.id!)
    const top = (row.address ?? "").trim()
    const bottom = [row.zip, row.city].filter(Boolean).join(" ").trim()
    const addr = [top, bottom].filter(Boolean).join(", ") || "—"
    setPanelDealLabel(`${addr} · ${row.contact.name}`)
  }

  const columns = useMemo<ColumnDef<LeadRow>[]>(
    () => [
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
        size: 110,
        cell: ({ row }) => (
          <EditableSelectCell<DealStatus>
            value={row.original.status as DealStatus}
            options={STATUS_OPTIONS}
            onSave={(next) =>
              patchDeal(row.original.id!, { status: next }, "Status geändert")
            }
            display={(v) =>
              v ? <StatusBadge status={v} /> : <span className="text-zinc-300">—</span>
            }
          />
        ),
      },
      {
        id: "name",
        header: "Name",
        accessorFn: (r) => r.contact.name,
        size: 170,
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
        size: 150,
        cell: ({ row }) => (
          <EditableTextCell
            value={row.original.contact.company}
            onSave={(next) =>
              patchContact(
                row.original.contact.id,
                { company: next },
                "Firma geändert",
              )
            }
          />
        ),
      },
      {
        id: "phone",
        header: "Telefon",
        accessorFn: (r) => r.contact.phone ?? "",
        size: 140,
        cell: ({ row }) => (
          <EditableTextCell
            value={row.original.contact.phone}
            onSave={(next) =>
              patchContact(
                row.original.contact.id,
                { phone: next },
                "Telefon geändert",
              )
            }
          />
        ),
      },
      {
        id: "email",
        header: "E-Mail",
        accessorFn: (r) => r.contact.email ?? "",
        size: 210,
        cell: ({ row }) => (
          <EditableTextCell
            value={row.original.contact.email}
            type="email"
            onSave={(next) =>
              patchContact(
                row.original.contact.id,
                { email: next },
                "E-Mail geändert",
              )
            }
          />
        ),
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
        size: 120,
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
        size: 140,
        cell: ({ row }) => (
          <EditableComboboxCell
            value={row.original.contact.lead_source}
            options={leadSourceOptions}
            onSave={(next) =>
              patchContact(
                row.original.contact.id,
                { lead_source: next },
                "Lead-Herkunft geändert",
              )
            }
          />
        ),
      },
      {
        id: "object_type",
        header: "Objekt",
        accessorKey: "object_type",
        size: 110,
        cell: ({ row }) => (
          <EditableComboboxCell
            value={row.original.object_type}
            options={objectTypeOptions}
            onSave={(next) =>
              patchDeal(
                row.original.id!,
                { object_type: next },
                "Objekt geändert",
              )
            }
          />
        ),
      },
      {
        id: "address_full",
        header: "Adresse",
        accessorFn: (r) => `${r.address ?? ""} ${r.zip ?? ""} ${r.city ?? ""}`,
        size: 230,
        cell: ({ row }) => (
          <EditableAddressCell
            address={row.original.address}
            zip={row.original.zip}
            city={row.original.city}
            onSave={(patch) =>
              patchDeal(row.original.id!, patch, "Adresse geändert")
            }
          />
        ),
      },
      {
        id: "verwendung",
        header: "Verwendung",
        accessorKey: "verwendung",
        size: 110,
        cell: ({ row }) => (
          <EditableComboboxCell
            value={row.original.verwendung ?? null}
            options={verwendungOptions}
            onSave={(next) =>
              patchDeal(
                row.original.id!,
                { verwendung: next },
                "Verwendung geändert",
              )
            }
          />
        ),
      },
      {
        id: "wohnflaeche_m2",
        header: "Wohnfläche",
        accessorKey: "wohnflaeche_m2",
        size: 120,
        cell: ({ row }) => (
          <EditableNumberCell
            value={row.original.wohnflaeche_m2}
            onSave={(next) =>
              patchDeal(
                row.original.id!,
                { wohnflaeche_m2: next },
                "Wohnfläche geändert",
              )
            }
            display={(v) => (v == null ? "" : formatM2(v))}
          />
        ),
      },
      {
        id: "preis_kauf",
        header: "Preis",
        accessorKey: "preis_kauf",
        size: 120,
        cell: ({ row }) => (
          <EditableNumberCell
            value={row.original.preis_kauf}
            onSave={(next) =>
              patchDeal(
                row.original.id!,
                { preis_kauf: next },
                "Preis geändert",
              )
            }
            display={(v) => (v == null ? "" : formatCurrency(v))}
          />
        ),
      },
      {
        id: "preis_pro_m2",
        header: "€/m²",
        accessorKey: "preis_pro_m2",
        size: 100,
        cell: ({ getValue }) => {
          const v = getValue() as number | null
          return v == null ? "" : (
            <span className="text-zinc-500">{formatCurrency(v)}</span>
          )
        },
      },
      {
        id: "kalk_verkaufspreis",
        header: "Kalk Verkauf",
        accessorKey: "kalk_verkaufspreis",
        size: 130,
        cell: ({ row }) => (
          <EditableNumberCell
            value={row.original.kalk_verkaufspreis}
            onSave={(next) =>
              patchDeal(
                row.original.id!,
                { kalk_verkaufspreis: next },
                "Kalk-Verkauf geändert",
              )
            }
            display={(v) => (v == null ? "" : formatCurrency(v))}
          />
        ),
      },
      {
        id: "kalk_pro_m2",
        header: "Kalk €/m²",
        accessorKey: "kalk_pro_m2",
        size: 110,
        cell: ({ getValue }) => {
          const v = getValue() as number | null
          return v == null ? "" : (
            <span className="text-zinc-500">{formatCurrency(v)}</span>
          )
        },
      },
      {
        id: "mein_angebot",
        header: "Mein Angebot",
        accessorKey: "mein_angebot",
        size: 130,
        cell: ({ row }) => (
          <EditableNumberCell
            value={row.original.mein_angebot}
            onSave={(next) =>
              patchDeal(
                row.original.id!,
                { mein_angebot: next },
                "Angebot geändert",
              )
            }
            display={(v) => (v == null ? "" : formatCurrency(v))}
          />
        ),
      },
      {
        id: "angebot_datum",
        header: "Angebot gültig",
        accessorKey: "angebot_datum",
        size: 130,
        cell: ({ row }) => (
          <ClickableDateCell
            value={row.original.angebot_datum}
            onSave={(iso) =>
              patchDeal(
                row.original.id!,
                { angebot_datum: iso },
                "Angebots-Datum geändert",
              )
            }
          />
        ),
      },
      {
        id: "naechste_nachfass",
        header: "Nächste Nachfass",
        accessorKey: "naechste_nachfass",
        size: 140,
        cell: ({ getValue }) => {
          const v = getValue() as string | null
          if (!v) return ""
          return (
            <span
              className={cn(
                "text-zinc-500",
                isOverdue(v) && "text-red-600 font-semibold",
              )}
            >
              {formatDate(v)}
            </span>
          )
        },
      },
      {
        id: "expose",
        header: "Exposé",
        size: 90,
        cell: ({ row }) => (
          <EditableExposeCell
            url={row.original.expose_url}
            localPath={row.original.expose_local_path}
            onSave={(patch) =>
              patchDeal(row.original.id!, patch, "Exposé geändert")
            }
          />
        ),
      },
      {
        id: "notes",
        header: "Notizen",
        accessorKey: "notes_count",
        size: 110,
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
    [leadSourceOptions, objectTypeOptions, verwendungOptions],
  )

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, globalFilter, columnSizing },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onColumnSizingChange: setColumnSizing,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
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
