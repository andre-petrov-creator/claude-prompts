import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

export const useDealNoteMutations = (dealId: string) => {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["deal-notes", dealId] })
    qc.invalidateQueries({ queryKey: ["deals", "with-followup"] })
  }

  const create = useMutation({
    mutationFn: async (contentHtml: string) => {
      const { data, error } = await supabase
        .from("deal_notes")
        .insert({ deal_id: dealId, content_html: contentHtml })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      invalidate()
      toast.success("Notiz gespeichert")
    },
    onError: (err) => toast.error(`Fehler: ${err.message}`),
  })

  const update = useMutation({
    mutationFn: async (args: { id: string; contentHtml: string }) => {
      const { error } = await supabase
        .from("deal_notes")
        .update({ content_html: args.contentHtml })
        .eq("id", args.id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      toast.success("Notiz aktualisiert")
    },
    onError: (err) => toast.error(`Fehler: ${err.message}`),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deal_notes").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      toast.success("Notiz gelöscht")
    },
    onError: (err) => toast.error(`Fehler: ${err.message}`),
  })

  return { create, update, remove }
}
