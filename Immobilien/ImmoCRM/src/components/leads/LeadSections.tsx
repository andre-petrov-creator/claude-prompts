import { useState, useEffect } from "react"
import { flexRender, type Table, type Row } from "@tanstack/react-table"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronDown } from "lucide-react"
import type { LeadRow, DealStatus } from "@/types/domain"
import { SECTION_ORDER, STATUS_LABELS } from "@/lib/constants"
import LeadFilters from "./LeadFilters"
import LeadCreateModal from "@/features/lead-create/LeadCreateModal"

type Props = {
  table: Table<LeadRow>
  globalFilter: string
  setGlobalFilter: (v: string) => void
}

export default function LeadSections({
  table,
  globalFilter,
  setGlobalFilter,
}: Props) {
  const rowsByStatus: Record<DealStatus, Row<LeadRow>[]> = {
    offen: [],
    berechnet: [],
    absage: [],
  }
  for (const row of table.getRowModel().rows) {
    const s = row.original.status as DealStatus | null
    if (s && s in rowsByStatus) rowsByStatus[s].push(row)
  }

  const SECTION_OPEN_KEY = "immo-crm.leadTable.sectionOpen"
  const [open, setOpen] = useState<Record<DealStatus, boolean>>(() => {
    try {
      const raw = localStorage.getItem(SECTION_OPEN_KEY)
      if (raw) return JSON.parse(raw) as Record<DealStatus, boolean>
    } catch {
      // ignore
    }
    return { berechnet: true, offen: true, absage: false }
  })

  useEffect(() => {
    try {
      localStorage.setItem(SECTION_OPEN_KEY, JSON.stringify(open))
    } catch {
      // ignore
    }
  }, [open])

  const total = table.getRowModel().rows.length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Leads</h2>
          <p className="text-sm text-zinc-500">{total} insgesamt</p>
        </div>
        <div className="flex items-center gap-3">
          <LeadFilters
            table={table}
            globalFilter={globalFilter}
            setGlobalFilter={setGlobalFilter}
          />
          <LeadCreateModal />
        </div>
      </div>

      {SECTION_ORDER.map((status) => (
        <Collapsible
          key={status}
          open={open[status]}
          onOpenChange={(v) => setOpen((prev) => ({ ...prev, [status]: v }))}
        >
          <CollapsibleTrigger className="inline-flex items-center gap-2 text-left py-2 font-medium hover:bg-zinc-50 px-2 -ml-2 rounded">
            <ChevronDown
              className={`w-4 h-4 transition-transform ${
                open[status] ? "" : "-rotate-90"
              }`}
            />
            {STATUS_LABELS[status]} ({rowsByStatus[status].length})
          </CollapsibleTrigger>
          <CollapsibleContent>
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
                            {flexRender(
                              h.column.columnDef.header,
                              h.getContext(),
                            )}
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
                  {rowsByStatus[status].length === 0 ? (
                    <tr>
                      <td
                        colSpan={table.getAllLeafColumns().length}
                        className="px-3 py-4 text-zinc-400 text-center"
                      >
                        Keine Leads in dieser Sektion.
                      </td>
                    </tr>
                  ) : (
                    rowsByStatus[status].map((row) => (
                      <tr key={row.id} className="border-b hover:bg-zinc-50">
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className="px-3 py-2 truncate"
                          >
                            {cell.column.columnDef.cell
                              ? flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext(),
                                )
                              : String(cell.getValue() ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  )
}
