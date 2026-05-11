import { useState } from "react"
import { format } from "date-fns"
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { formatDate } from "@/lib/formatters"
import EditableCellShell from "./EditableCellShell"

type Props = {
  value: string | null
  onSave: (iso: string | null) => void
}

export default function EditableDateCell({ value, onSave }: Props) {
  const [open, setOpen] = useState(false)

  const handleSelect = (date: Date | undefined) => {
    onSave(date ? format(date, "yyyy-MM-dd") : null)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div>
          <EditableCellShell
            display={value ? formatDate(value) : ""}
            onActivate={() => setOpen(true)}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value ? new Date(value) : undefined}
          onSelect={handleSelect}
        />
      </PopoverContent>
    </Popover>
  )
}
