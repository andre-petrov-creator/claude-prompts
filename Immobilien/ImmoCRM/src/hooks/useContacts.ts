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
          .select("contact_id, letzter_anruf")
          .is("deleted_at", null),
        supabase
          .from("contact_comments")
          .select("contact_id, created_at"),
      ])
      if (contactsRes.error) throw contactsRes.error
      if (dealsRes.error) throw dealsRes.error
      if (commentsRes.error) throw commentsRes.error

      const dealsCountByContact = new Map<string, number>()
      const lastAnrufByContact = new Map<string, string>()
      for (const d of dealsRes.data ?? []) {
        dealsCountByContact.set(
          d.contact_id,
          (dealsCountByContact.get(d.contact_id) ?? 0) + 1,
        )
        if (d.letzter_anruf) {
          const prev = lastAnrufByContact.get(d.contact_id)
          if (!prev || d.letzter_anruf > prev) {
            lastAnrufByContact.set(d.contact_id, d.letzter_anruf)
          }
        }
      }

      const commentsCountByContact = new Map<string, number>()
      const lastCommentByContact = new Map<string, string>()
      for (const c of commentsRes.data ?? []) {
        commentsCountByContact.set(
          c.contact_id,
          (commentsCountByContact.get(c.contact_id) ?? 0) + 1,
        )
        const prev = lastCommentByContact.get(c.contact_id)
        if (!prev || c.created_at > prev) {
          lastCommentByContact.set(c.contact_id, c.created_at)
        }
      }

      return (contactsRes.data ?? []).map((contact) => {
        const lastAnruf = lastAnrufByContact.get(contact.id) ?? null
        const lastComment = lastCommentByContact.get(contact.id) ?? null
        const lastContact =
          lastAnruf && lastComment
            ? lastAnruf > lastComment.slice(0, 10)
              ? lastAnruf
              : lastComment
            : (lastComment ?? lastAnruf)
        return {
          ...contact,
          last_contact: lastContact,
          deals_count: dealsCountByContact.get(contact.id) ?? 0,
          comments_count: commentsCountByContact.get(contact.id) ?? 0,
        }
      })
    },
  })
}
