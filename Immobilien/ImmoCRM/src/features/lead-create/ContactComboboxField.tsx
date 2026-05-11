import { useState, useEffect, useRef } from "react"
import { Plus, Check, User } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { useContactSearch, type ContactSearchResult } from "./useContactSearch"
import { normalizeName } from "@/lib/normalize"

type Props = {
  value: string
  onChange: (name: string) => void
  onSelectExisting: (contact: ContactSearchResult) => void
  onClearSelection: () => void
  selectedContactId?: string
}

export default function ContactComboboxField({
  value,
  onChange,
  onSelectExisting,
  onClearSelection,
  selectedContactId,
}: Props) {
  const { data: contacts } = useContactSearch(true)
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const q = value.trim()
  const matches =
    q.length >= 2 && contacts
      ? contacts.filter(
          (c) =>
            c.name.toLowerCase().includes(q.toLowerCase()) ||
            (c.email ?? "").toLowerCase().includes(q.toLowerCase()) ||
            (c.company ?? "").toLowerCase().includes(q.toLowerCase()),
        )
      : []

  useEffect(() => {
    if (selectedContactId) {
      const sel = contacts?.find((c) => c.id === selectedContactId)
      if (sel && normalizeName(sel.name) !== normalizeName(value)) {
        onClearSelection()
      }
    }
  }, [value, selectedContactId, contacts, onClearSelection])

  return (
    <Popover open={open && matches.length > 0} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative">
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => {
              onChange(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Maklername eingeben…"
            autoComplete="off"
          />
          {selectedContactId && (
            <span
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-green-700 flex items-center gap-1 pointer-events-none"
              title="Bestehender Kontakt ausgewählt"
            >
              <User className="w-3 h-3" /> verlinkt
            </span>
          )}
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-1"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="max-h-60 overflow-y-auto">
          {matches.map((c) => (
            <button
              type="button"
              key={c.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelectExisting(c)
                setOpen(false)
              }}
              className="w-full px-2 py-1.5 text-left text-sm rounded hover:bg-zinc-100 flex items-start justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{c.name}</div>
                <div className="text-xs text-zinc-500 truncate">
                  {[c.company, c.email].filter(Boolean).join(" · ")}
                </div>
              </div>
              {selectedContactId === c.id && (
                <Check className="w-3.5 h-3.5 text-green-600 mt-1 shrink-0" />
              )}
            </button>
          ))}
          {q.length >= 2 && matches.length === 0 && (
            <div className="px-2 py-1.5 text-sm text-blue-700 flex items-center gap-2">
              <Plus className="w-3.5 h-3.5" />
              "{q}" wird neu angelegt
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
