import { useState, useRef, useEffect } from "react"
import EditableCellShell from "./EditableCellShell"

type Props = {
  value: string | null
  onSave: (next: string | null) => void
  display?: (value: string | null) => React.ReactNode
  type?: "text" | "number" | "email"
  placeholder?: string
  align?: "left" | "right"
}

export default function EditableTextCell({
  value,
  onSave,
  display,
  type = "text",
  placeholder,
  align = "left",
}: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const start = () => {
    setDraft(value ?? "")
    setEditing(true)
  }

  const commit = () => {
    const trimmed = draft.trim()
    const next = trimmed === "" ? null : trimmed
    if (next !== (value ?? null)) onSave(next)
    setEditing(false)
  }

  const cancel = () => setEditing(false)

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      commit()
    } else if (e.key === "Escape") {
      e.preventDefault()
      cancel()
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        defaultValue={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKey}
        onClick={(e) => e.stopPropagation()}
        placeholder={placeholder}
        className={`w-full bg-white border border-blue-400 rounded px-2 py-1 text-sm outline-none ${
          align === "right" ? "text-right" : ""
        }`}
      />
    )
  }

  return (
    <EditableCellShell
      display={display ? display(value) : (value ?? "")}
      onActivate={start}
      className={align === "right" ? "justify-end" : ""}
    />
  )
}
