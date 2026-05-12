import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { ContactComment } from "@/types/domain"

export const useContactComments = (contactId: string | null) => {
  return useQuery<ContactComment[]>({
    queryKey: ["contact-comments", contactId],
    enabled: contactId != null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_comments")
        .select("*")
        .eq("contact_id", contactId!)
        .order("created_at", { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}
