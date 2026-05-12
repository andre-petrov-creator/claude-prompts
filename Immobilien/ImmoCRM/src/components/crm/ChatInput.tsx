import { useRef, useState, useEffect } from "react"
import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"

type Props = {
  onSend: (text: string) => void
  resetKey?: string | null
  placeholder?: string
}

export default function ChatInput({
  onSend,
  resetKey,
  placeholder = "Nachricht schreiben…",
}: Props) {
  const [value, setValue] = useState("")
  const taRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    setValue("")
  }, [resetKey])

  const submit = () => {
    const t = value.trim()
    if (t.length === 0) return
    onSend(t)
    setValue("")
    taRef.current?.focus()
  }

  return (
    <div className="flex gap-2 items-end">
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
        }}
        placeholder={placeholder}
        rows={2}
        className="flex-1 px-3 py-2 text-sm border rounded resize-none outline-none focus:border-blue-400 min-h-[60px] max-h-[160px]"
      />
      <Button size="sm" onClick={submit} disabled={value.trim().length === 0}>
        <Send className="w-4 h-4" />
      </Button>
    </div>
  )
}
