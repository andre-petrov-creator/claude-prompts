import { useMemo, useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type ColumnSizingState,
} from "@tanstack/react-table"
import type { ContactRow, ContactStatus } from "@/types/domain"
import ContactStatusBadge from "./ContactStatusBadge"
import ContactChatPanel from "./ContactChatPanel"
import ContactFilters from "./ContactFilters"
import EditableSelectCell from "@/components/leads/EditableSelectCell"
import EditableComboboxCell from "@/components/leads/EditableComboboxCell"
import EditableTextCell from "@/components/leads/EditableTextCell"
import ClickableDateCell from "@/components/leads/ClickableDateCell"
import CounterCell from "./CounterCell"
import {
  useUpdateContactField,
  type EditableContactField,
} from "@/hooks/useUpdateContactField"
import { useDistinctValues } from "@/hooks/useDistinctValues"
import { CONTACT_STATUS_OPTIONS, LEAD_SOURCE_DEFAULTS } from "@/lib/constants"
import { MessageCircle } from "lucide-react"

const STORAGE_KEYS = {
  columnSizing: "immo-crm.contactTable.columnSizing",
  columnVisibility: "immo-crm.contactTable.columnVisibility",
  sorting: "immo-crm.contactTable.sorting",
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
    // ignore
  }
}

export default function ContactTable({ data }: { data: ContactRow[] }) {
  const navigate = useNavigate()
  const [sorting, setSorting] = useState<SortingState>(() =>
    loadJson(STORAGE_KEYS.sorting, [
      { id: "last_contact", desc: true },
    ] as SortingState),
  )
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    () => loadJson(STORAGE_KEYS.columnVisibility, {} as VisibilityState),
  )
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() =>
    loadJson(STORAGE_KEYS.columnSizing, {} as ColumnSizingState),
  )
  const [globalFilter, setGlobalFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState<ContactStatus | "all">("all")
  const [leadSourceFilter, setLeadSourceFilter] = useState<string | "all">("all")
  const [panelContact, setPanelContact] = useState<ContactRow | null>(null)

  useEffect(() => saveJson(STORAGE_KEYS.columnSizing, columnSizing), [columnSizing])
  useEffect(
    () => saveJson(STORAGE_KEYS.columnVisibility, columnVisibility),
    [columnVisibility],
  )
  useEffect(() => saveJson(STORAGE_KEYS.sorting, sorting), [sorting])

  const updateContact = useUpdateContactField()
  const { data: leadSourceValues } = useDistinctValues("contacts", "lead_source")
  const leadSourceOptions = useMemo(
    () => dedupSorted(LEAD_SOURCE_DEFAULTS, leadSourceValues ?? []),
    [leadSourceValues],
  )

  const patch = (
    contactId: string,
    p: Partial<
      Record<EditableContactField, string | ContactStatus | number | null>
    >,
    successMessage = "Gespeichert",
  ) => updateContact.mutate({ contactId, patch: p, successMessage })

  const filtered = useMemo(() => {
    return data.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false
      if (leadSourceFilter !== "all" && c.lead_source !== leadSourceFilter)
        return false
      return true
    })
  }, [data, statusFilter, leadSourceFilter])

  const columns = useMemo<ColumnDef<ContactRow>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        accessorKey: "name",
        size: 180,
        cell: ({ row }) => (
          <EditableTextCell
            value={row.original.name}
            onSave={(next) =>
              patch(row.original.id, { name: next ?? "" }, "Name geändert")
            }
          />
        ),
      },
      {
        id: "company",
        header: "Firma",
        accessorKey: "company",
        size: 160,
        cell: ({ row }) => (
          <EditableTextCell
            value={row.original.company}
            onSave={(next) =>
              patch(row.original.id, { company: next }, "Firma geändert")
            }
          />
        ),
      },
      {
        id: "position",
        header: "Funktion",
        accessorKey: "position",
        size: 130,
        cell: ({ row }) => (
          <EditableTextCell
            value={row.original.position}
            onSave={(next) =>
              patch(row.original.id, { position: next }, "Funktion geändert")
            }
          />
        ),
      },
      {
        id: "phone",
        header: "Telefon",
        accessorKey: "phone",
        size: 140,
        cell: ({ row }) => (
          <EditableTextCell
            value={row.original.phone}
            onSave={(next) =>
              patch(row.original.id, { phone: next }, "Telefon geändert")
            }
          />
        ),
      },
      {
        id: "email",
        header: "E-Mail",
        accessorKey: "email",
        size: 220,
        cell: ({ row }) => (
          <EditableTextCell
            value={row.original.email}
            type="email"
            onSave={(next) =>
              patch(row.original.id, { email: next }, "E-Mail geändert")
            }
          />
        ),
      },
      {
        id: "last_contact",
        header: "Letzter Kontakt",
        accessorKey: "last_contact",
        size: 140,
        cell: ({ row }) => (
          <ClickableDateCell
            value={row.original.last_contact}
            onSave={(iso) =>
              patch(
                row.original.id,
                iso
                  ? {
                      letzter_kontakt: iso,
                      kontakt_count: row.original.kontakt_count + 1,
                    }
                  : { letzter_kontakt: null },
                "Letzter Kontakt geändert",
              )
            }
          />
        ),
      },
      {
        id: "kontakt_count",
        header: "Anzahl",
        accessorKey: "kontakt_count",
        size: 110,
        cell: ({ row, getValue }) => (
          <CounterCell
            value={getValue() as number}
            onChange={(next) =>
              updateContact.mutate({
                contactId: row.original.id,
                patch: { kontakt_count: next },
              })
            }
          />
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
        size: 110,
        cell: ({ row }) => (
          <EditableSelectCell<ContactStatus>
            value={row.original.status}
            options={CONTACT_STATUS_OPTIONS}
            onSave={(next) =>
              patch(row.original.id, { status: next }, "Status geändert")
            }
            display={(v) =>
              v ? (
                <ContactStatusBadge status={v} />
              ) : (
                <span className="text-zinc-300">—</span>
              )
            }
          />
        ),
      },
      {
        id: "lead_source",
        header: "Lead-Herkunft",
        accessorKey: "lead_source",
        size: 140,
        cell: ({ row }) => (
          <EditableComboboxCell
            value={row.original.lead_source}
            options={leadSourceOptions}
            onSave={(next) =>
              patch(
                row.original.id,
                { lead_source: next },
                "Lead-Herkunft geändert",
              )
            }
          />
        ),
      },
      {
        id: "deals_count",
        header: "Deals",
        accessorKey: "deals_count",
        size: 90,
        cell: ({ row, getValue }) => {
          const n = getValue() as number
          if (n === 0) return <span className="text-zinc-400">0</span>
          return (
            <button
              className="text-blue-600 hover:underline font-medium"
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/leads?contact=${row.original.id}`)
              }}
              title={`${n} Lead${n > 1 ? "s" : ""} dieses Maklers anzeigen`}
            >
              {n}
            </button>
          )
        },
      },
      {
        id: "comments_count",
        header: "Notizen",
        accessorKey: "comments_count",
        size: 100,
        cell: ({ row, getValue }) => {
          const n = getValue() as number
          return (
            <button
              className="inline-flex items-center gap-1 text-blue-600 hover:underline"
              onClick={(e) => {
                e.stopPropagation()
                setPanelContact(row.original)
              }}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              {n}
            </button>
          )
        },
      },
    ],
    [leadSourceOptions, navigate],
  )

  const table = useReactTable({
    data: filtered,
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

  const visibleRows = table.getRowModel().rows

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">Kontakte</h2>
          <p className="text-sm text-zinc-500">
            {visibleRows.length} von {data.length}
          </p>
        </div>
        <ContactFilters
          table={table}
          globalFilter={globalFilter}
          setGlobalFilter={setGlobalFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          leadSourceFilter={leadSourceFilter}
          setLeadSourceFilter={setLeadSourceFilter}
          leadSourceOptions={leadSourceOptions}
        />
      </div>

      <div className="overflow-x-auto rounded border">
        <table
          className="text-sm"
          style={{ tableLayout: "fixed", width: "max-content" }}
        >
          <colgroup>
            {table.getVisibleLeafColumns().map((col) => (
              <col key={col.id} style={{ width: `${col.getSize()}px` }} />
            ))}
          </colgroup>
          <thead className="bg-zinc-50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="relative px-3 py-2 text-left font-medium border-b whitespace-nowrap overflow-hidden text-ellipsis select-none"
                  >
                    <span
                      onClick={h.column.getToggleSortingHandler()}
                      className="cursor-pointer hover:text-zinc-900"
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {{ asc: " ↑", desc: " ↓" }[
                        h.column.getIsSorted() as string
                      ] ?? ""}
                    </span>
                    {h.column.getCanResize() && (
                      <span
                        onMouseDown={h.getResizeHandler()}
                        onTouchStart={h.getResizeHandler()}
                        onClick={(e) => e.stopPropagation()}
                        className={`absolute top-0 right-0 h-full w-1.5 cursor-col-resize select-none touch-none hover:bg-blue-400 ${
                          h.column.getIsResizing() ? "bg-blue-500" : ""
                        }`}
                      />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td
                  colSpan={table.getAllLeafColumns().length}
                  className="px-3 py-4 text-zinc-400 text-center"
                >
                  Keine Kontakte gefunden.
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <tr key={row.id} className="border-b hover:bg-zinc-50">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2 truncate">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ContactChatPanel
        contactId={panelContact?.id ?? null}
        contactName={panelContact?.name ?? ""}
        contactSubtitle={
          panelContact
            ? [panelContact.company, panelContact.position]
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
        open={panelContact !== null}
        onOpenChange={(open) => {
          if (!open) setPanelContact(null)
        }}
      />
    </div>
  )
}
