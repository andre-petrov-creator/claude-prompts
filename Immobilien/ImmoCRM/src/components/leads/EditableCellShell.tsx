import { useState, useRef, useEffect, type ReactNode } from "react"
import { Pencil } from "lucide-react"

type Props = {
  display: ReactNode
  onActivate: () => void
  hoverDelayMs?: number
  className?: string
}

const DEFAULT_DELAY = 2000

export default function EditableCellShell({
  display,
  onActivate,
  hoverDelayMs = DEFAULT_DELAY,
  className,
}: Props) {
  const [pencilVisible, setPencilVisible] = useState(false)
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
    }, hoverDelayMs)
  }

  const handleLeave = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setPencilVisible(false)
  }

  const activate = (e: React.MouseEvent) => {
    e.stopPropagation()
    onActivate()
  }

  return (
    <div
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onClick={activate}
      className={`group flex items-center gap-1.5 cursor-pointer min-h-[1.5rem] ${className ?? ""}`}
    >
      <span className="flex-1 truncate">{display}</span>
      <Pencil
        className={`w-3.5 h-3.5 text-zinc-400 transition-opacity flex-shrink-0 ${
          pencilVisible ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  )
}
