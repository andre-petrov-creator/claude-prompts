import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { DealNote } from "@/types/domain"

export const useDealNotes = (dealId: string | null) => {
  return useQuery<DealNote[]>({
    queryKey: ["deal-notes", dealId],
    enabled: dealId != null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_notes")
        .select("*")
        .eq("deal_id", dealId!)
        .order("created_at", { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}
