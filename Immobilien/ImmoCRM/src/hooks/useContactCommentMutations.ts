import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

export const useContactCommentMutations = (contactId: string) => {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["contact-comments", contactId] })
    qc.invalidateQueries({ queryKey: ["contacts", "aggregated"] })
  }

  const create = useMutation({
    mutationFn: async (text: string) => {
      const { data, error } = await supabase
        .from("contact_comments")
        .insert({ contact_id: contactId, text })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: invalidate,
    onError: (err) => toast.error(`Fehler: ${err.message}`),
  })

  const update = useMutation({
    mutationFn: async (args: { id: string; text: string }) => {
      const { error } = await supabase
        .from("contact_comments")
        .update({ text: args.text, updated_at: new Date().toISOString() })
        .eq("id", args.id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      toast.success("Kommentar aktualisiert")
    },
    onError: (err) => toast.error(`Fehler: ${err.message}`),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("contact_comments")
        .delete()
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      toast.success("Kommentar gelöscht")
    },
    onError: (err) => toast.error(`Fehler: ${err.message}`),
  })

  return { create, update, remove }
}
