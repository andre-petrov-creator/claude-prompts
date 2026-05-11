import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { formatM2 } from "@/lib/formatters"
import { STATUS_LABELS } from "@/lib/constants"
import type { ExistingDeal } from "./leadCreateLogic"

type Props = {
  open: boolean
  duplicates: ExistingDeal[]
  onProceedAnyway: () => void
  onCancel: () => void
}

export default function DealDuplicateDialog({
  open,
  duplicates,
  onProceedAnyway,
  onCancel,
}: Props) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Lead existiert bereits</AlertDialogTitle>
          <AlertDialogDescription>
            Für diesen Makler ist bereits ein Deal mit dieser Adresse angelegt:
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          {duplicates.map((d) => (
            <div key={d.id} className="p-3 rounded border bg-zinc-50">
              <div className="font-medium">{d.address ?? "(keine Adresse)"}</div>
              <div className="text-xs text-zinc-600 mt-1">
                {[
                  d.zip,
                  d.wohnflaeche_m2 != null ? formatM2(d.wohnflaeche_m2) : null,
                  STATUS_LABELS[d.status],
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
          ))}
        </div>

        <AlertDialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button variant="outline" onClick={onProceedAnyway}>
            Trotzdem anlegen
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
