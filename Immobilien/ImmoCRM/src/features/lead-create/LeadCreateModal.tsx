import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import QuickLeadForm from "./QuickLeadForm"

export default function LeadCreateModal() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm">
        <Plus className="w-4 h-4 mr-1" />
        Neuer Lead
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Neuer Lead</DialogTitle>
            <DialogDescription>
              Off-Market schnell erfassen oder Exposé per PDF einlesen.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="quick" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="quick">Schnell</TabsTrigger>
              <TabsTrigger value="pdf" disabled title="Kommt in Schritt 5">
                Mit PDF
              </TabsTrigger>
            </TabsList>

            <TabsContent value="quick">
              <QuickLeadForm onSuccess={() => setOpen(false)} />
            </TabsContent>

            <TabsContent value="pdf">
              <div className="text-sm text-zinc-500 p-8 text-center">
                Verfügbar ab Schritt 5 (PDF-Drag-Drop).
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  )
}
