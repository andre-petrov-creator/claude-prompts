import { useState, useRef, useEffect } from "react"
import { Plus, Check } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from "@/components/ui/popover"

type Props = {
  value: string | null
  options: string[]
  onSave: (next: string | null) => void
  emptyLabel?: string
}

export default function EditableComboboxCell({
  value,
  options,
  onSave,
  emptyLabel = "(leer)",
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
    if (!open) setQuery("")
  }, [open])

  const q = query.trim()
  const filtered = options.filter((o) =>
    o.toLowerCase().includes(q.toLowerCase()),
  )
  const showAddNew =
    q.length > 0 &&
    !options.some((o) => o.toLowerCase() === q.toLowerCase())

  const choose = (next: string | null) => {
    onSave(next)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setOpen(true)
          }}
          className="w-full text-left min-h-[1.5rem] px-1 -mx-1 rounded hover:bg-zinc-100 flex items-center"
        >
          <span className="flex-1 truncate">{value ?? ""}</span>
        </button>
      </PopoverAnchor>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="p-2 border-b">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suchen oder neu…"
            className="w-full px-2 py-1 text-sm border rounded outline-none focus:border-blue-400"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                if (showAddNew) choose(q)
                else if (filtered.length === 1) choose(filtered[0])
              } else if (e.key === "Escape") {
                setOpen(false)
              }
            }}
          />
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {filtered.map((opt) => (
            <button
              key={opt}
              onClick={() => choose(opt)}
              className="w-full px-2 py-1.5 text-left text-sm rounded hover:bg-zinc-100 flex items-center justify-between"
            >
              <span>{opt}</span>
              {value === opt && (
                <Check className="w-3.5 h-3.5 text-green-600" />
              )}
            </button>
          ))}
          {showAddNew && (
            <button
              onClick={() => choose(q)}
              className="w-full px-2 py-1.5 text-left text-sm rounded hover:bg-blue-50 text-blue-700 flex items-center gap-2 border-t mt-1 pt-2"
            >
              <Plus className="w-3.5 h-3.5" />
              "{q}" hinzufügen
            </button>
          )}
          {value && (
            <button
              onClick={() => choose(null)}
              className="w-full px-2 py-1.5 text-left text-sm rounded hover:bg-zinc-100 text-zinc-500 border-t mt-1 pt-2"
            >
              {emptyLabel}
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
