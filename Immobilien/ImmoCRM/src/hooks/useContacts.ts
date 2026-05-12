import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { ContactRow } from "@/types/domain"

export const useContacts = () => {
  return useQuery<ContactRow[]>({
    queryKey: ["contacts", "aggregated"],
    queryFn: async () => {
      const [contactsRes, dealsRes, commentsRes] = await Promise.all([
        supabase
          .from("contacts")
          .select("*")
          .is("deleted_at", null),
        supabase
          .from("deals")
          .select("contact_id")
          .is("deleted_at", null),
        supabase.from("contact_comments").select("contact_id"),
      ])
      if (contactsRes.error) throw contactsRes.error
      if (dealsRes.error) throw dealsRes.error
      if (commentsRes.error) throw commentsRes.error

      const dealsCount = new Map<string, number>()
      for (const d of dealsRes.data ?? []) {
        dealsCount.set(d.contact_id, (dealsCount.get(d.contact_id) ?? 0) + 1)
      }
      const commentsCount = new Map<string, number>()
      for (const c of commentsRes.data ?? []) {
        commentsCount.set(
          c.contact_id,
          (commentsCount.get(c.contact_id) ?? 0) + 1,
        )
      }

      return (contactsRes.data ?? []).map((contact) => ({
        ...contact,
        last_contact: contact.letzter_kontakt,
        deals_count: dealsCount.get(contact.id) ?? 0,
        comments_count: commentsCount.get(contact.id) ?? 0,
      }))
    },
  })
}
