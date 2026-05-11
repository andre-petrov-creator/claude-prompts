import { useState } from "react"
import { format } from "date-fns"
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { formatDate, isOverdue } from "@/lib/formatters"
import { cn } from "@/lib/utils"

type Props = {
  value: string | null
  onSave: (iso: string | null) => void
  highlightOverdue?: boolean
}

export default function ClickableDateCell({
  value,
  onSave,
  highlightOverdue = false,
}: Props) {
  const [open, setOpen] = useState(false)

  const handleSelect = (date: Date | undefined) => {
    onSave(date ? format(date, "yyyy-MM-dd") : null)
    setOpen(false)
  }

  const overdue = highlightOverdue && isOverdue(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setOpen(true)
          }}
          className={cn(
            "w-full text-left min-h-[1.5rem] px-1 -mx-1 rounded hover:bg-zinc-100",
            overdue && "text-red-600 font-semibold",
          )}
        >
          {value ? formatDate(value) : ""}
        </button>
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
