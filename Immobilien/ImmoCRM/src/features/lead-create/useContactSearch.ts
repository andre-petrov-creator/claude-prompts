import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { Contact } from "@/types/domain"

export type ContactSearchResult = Pick<
  Contact,
  "id" | "name" | "email" | "phone" | "company" | "position" | "lead_source"
>

export const useContactSearch = (enabled: boolean) => {
  return useQuery<ContactSearchResult[]>({
    queryKey: ["contacts", "search-all"],
    enabled,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, email, phone, company, position, lead_source")
        .is("deleted_at", null)
        .order("name", { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}
