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
import type { LeadRow } from "@/types/domain"

type Props = {
  table: Table<LeadRow>
  globalFilter: string
  setGlobalFilter: (v: string) => void
}

export default function LeadFilters({
  table,
  globalFilter,
  setGlobalFilter,
}: Props) {
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
        <DropdownMenuContent
          align="end"
          className="max-h-96 overflow-auto"
        >
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
