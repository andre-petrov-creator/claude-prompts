import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { LeadRow } from "@/types/domain"

export const useDeals = () => {
  return useQuery<LeadRow[]>({
    queryKey: ["deals", "with-followup"],
    queryFn: async () => {
      const [dealsRes, contactsRes, notesRes, pipelineRes] = await Promise.all([
        supabase.from("deals_with_followup").select("*"),
        supabase
          .from("contacts")
          .select("id, name, email, phone, company, position, lead_source"),
        supabase.from("deal_notes").select("deal_id"),
        supabase
          .from("deals")
          .select("id, priority_score, priority_reason, workspace_path, expose_source"),
      ])
      if (dealsRes.error) throw dealsRes.error
      if (contactsRes.error) throw contactsRes.error
      if (notesRes.error) throw notesRes.error
      if (pipelineRes.error) throw pipelineRes.error

      const contactsById = new Map(
        (contactsRes.data ?? []).map((c) => [c.id, c]),
      )
      const notesCountByDeal = new Map<string, number>()
      for (const n of notesRes.data ?? []) {
        notesCountByDeal.set(n.deal_id, (notesCountByDeal.get(n.deal_id) ?? 0) + 1)
      }
      const pipelineById = new Map(
        (pipelineRes.data ?? []).map((p) => [p.id, p]),
      )

      return (dealsRes.data ?? [])
        .filter((d) => d.id != null && d.contact_id != null)
        .map((d) => {
          const pipe = pipelineById.get(d.id!)
          return {
            ...d,
            contact: contactsById.get(d.contact_id!) ?? {
              id: d.contact_id!,
              name: "(unbekannt)",
              email: null,
              phone: null,
              company: null,
              position: null,
              lead_source: null,
            },
            notes_count: notesCountByDeal.get(d.id!) ?? 0,
            priority_score: pipe?.priority_score ?? null,
            priority_reason: pipe?.priority_reason ?? null,
            workspace_path: pipe?.workspace_path ?? null,
            expose_source: pipe?.expose_source ?? null,
          }
        }) as LeadRow[]
    },
  })
}
