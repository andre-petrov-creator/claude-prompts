import { useState } from "react"
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import EditableCellShell from "./EditableCellShell"

type Props = {
  address: string | null
  zip: string | null
  city: string | null
  onSave: (patch: {
    address: string | null
    zip: string | null
    city: string | null
  }) => void
}

const norm = (v: string) => (v.trim() === "" ? null : v.trim())

export default function EditableAddressCell({
  address,
  zip,
  city,
  onSave,
}: Props) {
  const [open, setOpen] = useState(false)
  const [a, setA] = useState(address ?? "")
  const [z, setZ] = useState(zip ?? "")
  const [c, setC] = useState(city ?? "")

  const handleOpen = (next: boolean) => {
    if (next) {
      setA(address ?? "")
      setZ(zip ?? "")
      setC(city ?? "")
    }
    setOpen(next)
  }

  const submit = () => {
    onSave({ address: norm(a), zip: norm(z), city: norm(c) })
    setOpen(false)
  }

  const display = () => {
    const top = (address ?? "").trim()
    const bottom = [zip, city].filter(Boolean).join(" ").trim()
    if (!top && !bottom) return ""
    return (
      <div className="leading-tight">
        {top && <div>{top}</div>}
        {bottom && <div className="text-xs text-zinc-500">{bottom}</div>}
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverAnchor asChild>
        <div>
          <EditableCellShell
            display={display()}
            onActivate={() => handleOpen(true)}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-72 p-3"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <div>
            <label className="text-xs text-zinc-500">Straße + Nr</label>
            <input
              autoFocus
              value={a}
              onChange={(e) => setA(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit()
                if (e.key === "Escape") setOpen(false)
              }}
              className="w-full px-2 py-1 text-sm border rounded outline-none focus:border-blue-400"
            />
          </div>
          <div className="flex gap-2">
            <div className="w-24">
              <label className="text-xs text-zinc-500">PLZ</label>
              <input
                value={z}
                onChange={(e) => setZ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit()
                  if (e.key === "Escape") setOpen(false)
                }}
                className="w-full px-2 py-1 text-sm border rounded outline-none focus:border-blue-400"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-zinc-500">Ort</label>
              <input
                value={c}
                onChange={(e) => setC(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit()
                  if (e.key === "Escape") setOpen(false)
                }}
                className="w-full px-2 py-1 text-sm border rounded outline-none focus:border-blue-400"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button size="sm" onClick={submit}>
              Speichern
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
