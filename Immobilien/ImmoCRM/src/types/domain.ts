import type { Database } from "@/types/supabase"

export type Contact = Database["public"]["Tables"]["contacts"]["Row"]
export type Deal = Database["public"]["Tables"]["deals"]["Row"]
export type DealWithFollowup = Database["public"]["Views"]["deals_with_followup"]["Row"]
export type ContactComment = Database["public"]["Tables"]["contact_comments"]["Row"]
export type DealNote = Database["public"]["Tables"]["deal_notes"]["Row"]

export type ContactStatus = Database["public"]["Enums"]["contact_status"]
export type DealStatus = Database["public"]["Enums"]["deal_status"]

export type LeadRow = DealWithFollowup & {
  contact: Pick<
    Contact,
    "id" | "name" | "email" | "phone" | "company" | "position" | "lead_source"
  >
  notes_count: number
}

export type ContactRow = Contact & {
  last_contact: string | null
  deals_count: number
  comments_count: number
}
