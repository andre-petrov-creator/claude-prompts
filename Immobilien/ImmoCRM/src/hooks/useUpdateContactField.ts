import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import type { Database } from "@/types/supabase"

type ContactUpdate = Database["public"]["Tables"]["contacts"]["Update"]

export type EditableContactField =
  | "name"
  | "company"
  | "phone"
  | "email"
  | "lead_source"
  | "position"

export const useUpdateContactField = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      contactId: string
      patch: Partial<Record<EditableContactField, string | null>>
      successMessage?: string
    }) => {
      const { error } = await supabase
        .from("contacts")
        .update(args.patch as ContactUpdate)
        .eq("id", args.contactId)
      if (error) throw error
      return args
    },
    onSuccess: (args) => {
      qc.invalidateQueries({ queryKey: ["deals", "with-followup"] })
      if (args.successMessage) toast.success(args.successMessage)
    },
    onError: (err) => toast.error(`Fehler: ${err.message}`),
  })
}
