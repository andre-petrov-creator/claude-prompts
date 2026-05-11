import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import type { Database } from "@/types/supabase"

type DealUpdate = Database["public"]["Tables"]["deals"]["Update"]

export type EditableDealField =
  | "status"
  | "letzter_anruf"
  | "besichtigung_datum"
  | "angebot_datum"
  | "object_type"
  | "verwendung"
  | "address"
  | "zip"
  | "city"
  | "wohnflaeche_m2"
  | "preis_kauf"
  | "kalk_verkaufspreis"
  | "mein_angebot"
  | "expose_url"
  | "expose_local_path"

export const useUpdateDealField = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      dealId: string
      patch: Partial<Record<EditableDealField, string | number | null>>
      successMessage?: string
    }) => {
      const { error } = await supabase
        .from("deals")
        .update(args.patch as DealUpdate)
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
