import { useState } from "react"
import { Pencil, Trash2, Check, X } from "lucide-react"
import { format } from "date-fns"
import { de } from "date-fns/locale"
import type { ContactComment } from "@/types/domain"

type Props = {
  comment: ContactComment
  onUpdate: (id: string, text: string) => void
  onDelete: (id: string) => void
}

export default function ContactChatItem({ comment, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.text)

  const stamp = format(new Date(comment.created_at), "dd.MM.yyyy HH:mm", {
    locale: de,
  })
  const edited = comment.updated_at !== comment.created_at

  const saveEdit = () => {
    const t = draft.trim()
    if (t.length === 0 || t === comment.text) {
      setEditing(false)
      setDraft(comment.text)
      return
    }
    onUpdate(comment.id, t)
    setEditing(false)
  }

  const cancelEdit = () => {
    setDraft(comment.text)
    setEditing(false)
  }

  const handleDelete = () => {
    if (window.confirm("Kommentar wirklich löschen?")) onDelete(comment.id)
  }

  return (
    <div className="group py-2">
      <div className="flex items-center justify-between mb-1 px-1">
        <div className="text-xs text-zinc-500">
          {stamp}
          {edited && " (bearbeitet)"}
        </div>
        {!editing && (
          <div className="opacity-0 group-hover:opacity-100 transition flex gap-1">
            <button
              onClick={() => setEditing(true)}
              className="p-1 hover:bg-zinc-100 rounded"
              aria-label="Bearbeiten"
              title="Bearbeiten"
            >
              <Pencil className="w-3.5 h-3.5 text-zinc-500" />
            </button>
            <button
              onClick={handleDelete}
              className="p-1 hover:bg-red-50 rounded"
              aria-label="Löschen"
              title="Löschen"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
            </button>
          </div>
        )}
      </div>
      {editing ? (
        <div className="flex flex-col gap-1">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                saveEdit()
              } else if (e.key === "Escape") {
                cancelEdit()
              }
            }}
            autoFocus
            rows={3}
            className="w-full px-3 py-2 text-sm border rounded resize-none outline-none focus:border-blue-400"
          />
          <div className="flex justify-end gap-1">
            <button
              onClick={cancelEdit}
              className="p-1.5 hover:bg-zinc-100 rounded"
              aria-label="Abbrechen"
              title="Abbrechen"
            >
              <X className="w-4 h-4 text-zinc-500" />
            </button>
            <button
              onClick={saveEdit}
              className="p-1.5 hover:bg-green-50 rounded"
              aria-label="Speichern"
              title="Speichern"
            >
              <Check className="w-4 h-4 text-green-600" />
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-zinc-100 rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words">
          {comment.text}
        </div>
      )}
    </div>
  )
}
