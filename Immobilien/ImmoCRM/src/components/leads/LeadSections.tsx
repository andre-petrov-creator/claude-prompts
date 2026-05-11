import { useState } from "react"
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

type Props = {
  table: Table<LeadRow>
  globalFilter: string
  setGlobalFilter: (v: string) => void
  onRowClick?: (row: LeadRow) => void
}

export default function LeadSections({
  table,
  globalFilter,
  setGlobalFilter,
  onRowClick,
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

  const [open, setOpen] = useState<Record<DealStatus, boolean>>({
    berechnet: true,
    offen: true,
    absage: false,
  })

  const total = table.getRowModel().rows.length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Leads</h2>
          <p className="text-sm text-zinc-500">{total} insgesamt</p>
        </div>
        <LeadFilters
          table={table}
          globalFilter={globalFilter}
          setGlobalFilter={setGlobalFilter}
        />
      </div>

      {SECTION_ORDER.map((status) => (
        <Collapsible
          key={status}
          open={open[status]}
          onOpenChange={(v) => setOpen((prev) => ({ ...prev, [status]: v }))}
        >
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 font-medium hover:bg-zinc-50">
            <ChevronDown
              className={`w-4 h-4 transition-transform ${
                open[status] ? "" : "-rotate-90"
              }`}
            />
            {STATUS_LABELS[status]} ({rowsByStatus[status].length})
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="overflow-x-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50">
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((h) => (
                        <th
                          key={h.id}
                          className="px-3 py-2 text-left font-medium border-b cursor-pointer hover:bg-zinc-100 whitespace-nowrap"
                          onClick={h.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            h.column.columnDef.header,
                            h.getContext(),
                          )}
                          {{ asc: " ↑", desc: " ↓" }[
                            h.column.getIsSorted() as string
                          ] ?? ""}
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
                      <tr
                        key={row.id}
                        className={`border-b hover:bg-zinc-50 ${
                          onRowClick ? "cursor-pointer" : ""
                        }`}
                        onClick={() => onRowClick?.(row.original)}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className="px-3 py-2 whitespace-nowrap"
                          >
                            {cell.column.columnDef.cell
                              ? flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext(),
                                )
                              : String(cell.getValue() ?? "—")}
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
