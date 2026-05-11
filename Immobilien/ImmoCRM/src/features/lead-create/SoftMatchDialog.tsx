import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

type Candidate = {
  id: string
  name: string
  company: string | null
  email: string | null
}

type Props = {
  open: boolean
  candidates: Candidate[]
  onMerge: (contactId: string) => void
  onCreateNew: () => void
  onCancel: () => void
}

export default function SoftMatchDialog({
  open,
  candidates,
  onMerge,
  onCreateNew,
  onCancel,
}: Props) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Bereits vorhandener Kontakt?</AlertDialogTitle>
          <AlertDialogDescription>
            {candidates.length === 1
              ? "Es gibt bereits einen Kontakt mit diesem Namen:"
              : `Es gibt ${candidates.length} Kontakte mit diesem Namen:`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2 max-h-64 overflow-y-auto">
          {candidates.map((c) => (
            <button
              type="button"
              key={c.id}
              onClick={() => onMerge(c.id)}
              className="w-full text-left p-3 rounded border hover:bg-zinc-50 hover:border-blue-400"
            >
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-zinc-500">
                {[c.company, c.email].filter(Boolean).join(" · ") ||
                  "(keine weiteren Daten)"}
              </div>
              <div className="text-xs text-blue-700 mt-1">
                → Mit diesem Kontakt verknüpfen
              </div>
            </button>
          ))}
        </div>

        <AlertDialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button variant="outline" onClick={onCreateNew}>
            Trotzdem neu anlegen
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
