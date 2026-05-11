import { useState } from "react"
import { Pencil, Trash2 } from "lucide-react"
import { format } from "date-fns"
import { de } from "date-fns/locale"
import type { DealNote } from "@/types/domain"
import TiptapEditor from "./TiptapEditor"

type Props = {
  note: DealNote
  onUpdate: (id: string, html: string) => void
  onDelete: (id: string) => void
}

export default function NoteItem({ note, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <div className="py-3 border-b last:border-b-0">
        <div className="text-xs text-zinc-500 mb-1">
          {format(new Date(note.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
          {note.updated_at !== note.created_at && " (bearbeitet)"}
        </div>
        <TiptapEditor
          initialHtml={note.content_html}
          saveLabel="Aktualisieren"
          onSave={(html) => {
            onUpdate(note.id, html)
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    )
  }

  const handleDelete = () => {
    if (window.confirm("Notiz wirklich löschen?")) {
      onDelete(note.id)
    }
  }

  return (
    <div className="group py-3 border-b last:border-b-0">
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs text-zinc-500">
          {format(new Date(note.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
          {note.updated_at !== note.created_at && " (bearbeitet)"}
        </div>
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
      </div>
      <div
        className="text-sm prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1"
        dangerouslySetInnerHTML={{ __html: note.content_html }}
      />
    </div>
  )
}
