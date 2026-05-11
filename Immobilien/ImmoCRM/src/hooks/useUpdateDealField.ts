import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

type UpdateableField = "letzter_anruf" | "besichtigung_datum"

export const useUpdateDealField = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      dealId: string
      field: UpdateableField
      value: string | null
      successMessage?: string
    }) => {
      const patch =
        args.field === "letzter_anruf"
          ? { letzter_anruf: args.value }
          : { besichtigung_datum: args.value }
      const { error } = await supabase
        .from("deals")
        .update(patch)
        .eq("id", args.dealId)
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
