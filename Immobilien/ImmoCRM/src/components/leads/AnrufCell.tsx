import { useState, useRef, useEffect } from "react"
import { Phone } from "lucide-react"
import { format } from "date-fns"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { useUpdateDealField } from "@/hooks/useUpdateDealField"
import { formatDate } from "@/lib/formatters"

type Props = {
  dealId: string
  letzterAnruf: string | null
}

const HOVER_DELAY_MS = 1000

export default function AnrufCell({ dealId, letzterAnruf }: Props) {
  const [hoverShowing, setHoverShowing] = useState(false)
  const [datepickerOpen, setDatepickerOpen] = useState(false)
  const timerRef = useRef<number | null>(null)
  const update = useUpdateDealField()

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
      setHoverShowing(true)
      timerRef.current = null
    }, HOVER_DELAY_MS)
  }

  const handleLeave = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setHoverShowing(false)
  }

  const setToday = (e: React.MouseEvent) => {
    e.stopPropagation()
    const today = format(new Date(), "yyyy-MM-dd")
    update.mutate({
      dealId,
      patch: { letzter_anruf: today },
      successMessage: "Anruf eingetragen",
    })
    setHoverShowing(false)
  }

  const setCustom = (date: Date | undefined) => {
    if (!date) return
    update.mutate({
      dealId,
      patch: { letzter_anruf: format(date, "yyyy-MM-dd") },
      successMessage: "Anruf-Datum gesetzt",
    })
    setDatepickerOpen(false)
  }

  return (
    <Popover open={datepickerOpen} onOpenChange={setDatepickerOpen}>
      <PopoverTrigger asChild>
        <div
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setDatepickerOpen(true)
          }}
          onClick={(e) => e.stopPropagation()}
          className="inline-block min-w-[110px]"
        >
          {hoverShowing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={setToday}
              className="h-7 px-2 text-xs"
            >
              <Phone className="w-3 h-3 mr-1" />
              Anruf eintragen
            </Button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setDatepickerOpen(true)
              }}
              className="text-left px-1 -mx-1 rounded hover:bg-zinc-100"
            >
              {formatDate(letzterAnruf)}
            </button>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={letzterAnruf ? new Date(letzterAnruf) : undefined}
          onSelect={setCustom}
        />
      </PopoverContent>
    </Popover>
  )
}
