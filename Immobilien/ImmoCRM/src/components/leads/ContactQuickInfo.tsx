import { useState } from "react"
import { Copy, Check } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { toast } from "sonner"

type Props = {
  name: string
  phone?: string | null
  email?: string | null
  company?: string | null
  position?: string | null
}

type Field = { label: string; value: string | null | undefined }

export default function ContactQuickInfo({
  name,
  phone,
  email,
  company,
  position,
}: Props) {
  const fields: Field[] = [
    { label: "Telefon", value: phone },
    { label: "E-Mail", value: email },
    { label: "Firma", value: company },
    { label: "Position", value: position },
  ]
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null)

  const copy = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value)
    setCopiedLabel(label)
    toast.success(`${label} kopiert`)
    setTimeout(() => setCopiedLabel(null), 1200)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="text-left hover:underline font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          {name}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-semibold mb-2">{name}</div>
        <div className="space-y-1.5 text-sm">
          {fields.map((f) => (
            <div key={f.label} className="flex items-center gap-2">
              <span className="w-16 text-zinc-500">{f.label}:</span>
              <span className="flex-1 truncate">{f.value ?? "—"}</span>
              {f.value && (
                <button
                  onClick={() => copy(f.label, f.value!)}
                  className="text-zinc-400 hover:text-zinc-900 p-1"
                  aria-label={`${f.label} kopieren`}
                >
                  {copiedLabel === f.label ? (
                    <Check className="w-3.5 h-3.5 text-green-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
