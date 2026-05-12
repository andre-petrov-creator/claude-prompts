import type { Table } from "@tanstack/react-table"
import { Columns3 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
import type { ContactRow, ContactStatus } from "@/types/domain"
import { CONTACT_STATUS_OPTIONS } from "@/lib/constants"

type Props = {
  table: Table<ContactRow>
  globalFilter: string
  setGlobalFilter: (v: string) => void
  statusFilter: ContactStatus | "all"
  setStatusFilter: (v: ContactStatus | "all") => void
  leadSourceFilter: string | "all"
  setLeadSourceFilter: (v: string | "all") => void
  leadSourceOptions: string[]
}

export default function ContactFilters({
  table,
  globalFilter,
  setGlobalFilter,
  statusFilter,
  setStatusFilter,
  leadSourceFilter,
  setLeadSourceFilter,
  leadSourceOptions,
}: Props) {
  return (
    <div className="flex gap-2 items-center flex-wrap">
      <Input
        placeholder="Suche…"
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
        className="w-64"
      />
      <select
        value={statusFilter}
        onChange={(e) =>
          setStatusFilter(e.target.value as ContactStatus | "all")
        }
        className="h-9 px-2 text-sm border rounded bg-white"
      >
        <option value="all">Alle Status</option>
        {CONTACT_STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        value={leadSourceFilter}
        onChange={(e) => setLeadSourceFilter(e.target.value)}
        className="h-9 px-2 text-sm border rounded bg-white"
      >
        <option value="all">Alle Herkünfte</option>
        {leadSourceOptions.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
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
              {typeof col.columnDef.header === "string"
                ? col.columnDef.header
                : col.id}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
