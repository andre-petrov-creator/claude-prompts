import { useEffect, useRef } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { useDealNotes } from "@/hooks/useDealNotes"
import { useDealNoteMutations } from "@/hooks/useDealNoteMutations"
import TiptapEditor from "./TiptapEditor"
import NoteItem from "./NoteItem"

type Props = {
  dealId: string | null
  dealLabel: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function DealNotesPanel({
  dealId,
  dealLabel,
  open,
  onOpenChange,
}: Props) {
  const { data: notes, isLoading } = useDealNotes(dealId)
  const { create, update, remove } = useDealNoteMutations(dealId ?? "")
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current && notes && notes.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [notes?.length, open])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:max-w-[480px] flex flex-col">
        <SheetHeader>
          <SheetTitle>Notizen</SheetTitle>
          <SheetDescription className="truncate">{dealLabel}</SheetDescription>
        </SheetHeader>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto -mx-6 px-6 py-2"
        >
          {isLoading ? (
            <div className="text-zinc-500 text-sm py-4">Lädt…</div>
          ) : !notes || notes.length === 0 ? (
            <div className="text-zinc-400 text-sm py-4 text-center">
              Noch keine Notizen.
            </div>
          ) : (
            notes.map((note) => (
              <NoteItem
                key={note.id}
                note={note}
                onUpdate={(id, html) =>
                  update.mutate({ id, contentHtml: html })
                }
                onDelete={(id) => remove.mutate(id)}
              />
            ))
          )}
        </div>

        <div className="pt-3 border-t">
          <TiptapEditor
            key={dealId ?? "empty"}
            onSave={(html) => create.mutate(html)}
            saveLabel="Notiz hinzufügen"
            autoFocus={false}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
