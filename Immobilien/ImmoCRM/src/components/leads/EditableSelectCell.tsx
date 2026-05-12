import { useState, type ReactNode } from "react"
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from "@/components/ui/popover"

type Option<T extends string> = {
  value: T
  label: string
}

type Props<T extends string> = {
  value: T | null
  options: Option<T>[]
  onSave: (next: T) => void
  display: (value: T | null) => ReactNode
}

export default function EditableSelectCell<T extends string>({
  value,
  options,
  onSave,
  display,
}: Props<T>) {
  const [open, setOpen] = useState(false)

  const choose = (v: T) => {
    onSave(v)
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
          <span className="flex-1 truncate">{display(value)}</span>
        </button>
      </PopoverAnchor>
      <PopoverContent className="w-44 p-1" align="start">
        <div className="flex flex-col">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => choose(opt.value)}
              className={`px-2 py-1.5 text-left text-sm rounded hover:bg-zinc-100 ${
                value === opt.value ? "bg-zinc-100 font-medium" : ""
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
