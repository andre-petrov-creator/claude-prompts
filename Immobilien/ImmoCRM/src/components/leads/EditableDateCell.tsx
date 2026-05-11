import { useState, useRef, useEffect } from "react"
import { Pencil } from "lucide-react"
import { format } from "date-fns"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { formatDate } from "@/lib/formatters"

type Props = {
  value: string | null
  onSave: (iso: string | null) => void
}

const HOVER_DELAY_MS = 2000

export default function EditableDateCell({ value, onSave }: Props) {
  const [pencilVisible, setPencilVisible] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  const handleEnter = () => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      setPencilVisible(true)
      timerRef.current = null
    }, HOVER_DELAY_MS)
  }

  const handleLeave = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (!pickerOpen) setPencilVisible(false)
  }

  const handleSelect = (date: Date | undefined) => {
    onSave(date ? format(date, "yyyy-MM-dd") : null)
    setPickerOpen(false)
    setPencilVisible(false)
  }

  return (
    <Popover
      open={pickerOpen}
      onOpenChange={(open) => {
        setPickerOpen(open)
        if (!open) setPencilVisible(false)
      }}
    >
      <div
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className="inline-flex items-center gap-1.5 min-w-[90px]"
      >
        <span>{value ? formatDate(value) : ""}</span>
        <PopoverTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            className={`text-zinc-400 hover:text-zinc-700 transition-opacity ${
              pencilVisible ? "opacity-100" : "opacity-0"
            }`}
            aria-label="Bearbeiten"
            title="Datum bearbeiten"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </PopoverTrigger>
      </div>
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
