import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { normalizeEmail, normalizeName } from "@/lib/normalize"
import {
  computeDefaultStatus,
  computeContactMergePatch,
  findDuplicateDeals,
  type ExistingDeal,
} from "./leadCreateLogic"
import type { QuickLeadParsed } from "./leadCreateSchema"

export type CreateLeadResolution =
  | { kind: "no_match" }
  | { kind: "hard_match"; contactId: string; contactName: string }
  | {
      kind: "soft_match_pending"
      candidates: Array<{
        id: string
        name: string
        company: string | null
        email: string | null
      }>
    }
  | { kind: "soft_match_merge"; contactId: string }
  | { kind: "soft_match_new" }

export type DealDuplicateResolution =
  | { kind: "no_dup" }
  | { kind: "dup_pending"; duplicates: ExistingDeal[] }
  | { kind: "dup_proceed_anyway" }

type CreateLeadInput = {
  values: QuickLeadParsed
  contactResolution: CreateLeadResolution
  dealResolution: DealDuplicateResolution
}

type CreateLeadResult = {
  contactId: string
  dealId: string
  contactWasUpdated: boolean
  contactWasCreated: boolean
}

export const useCreateLead = () => {
  const qc = useQueryClient()

  return useMutation<CreateLeadResult, Error, CreateLeadInput>({
    mutationFn: async ({ values, contactResolution, dealResolution }) => {
      if (
        dealResolution.kind === "dup_pending" ||
        contactResolution.kind === "soft_match_pending"
      ) {
        throw new Error("Resolution offen — UI sollte erst auflösen.")
      }

      let contactId: string
      let contactWasCreated = false
      let contactWasUpdated = false

      if (
        contactResolution.kind === "hard_match" ||
        contactResolution.kind === "soft_match_merge"
      ) {
        contactId = contactResolution.contactId

        const { data: existing, error: loadErr } = await supabase
          .from("contacts")
          .select("phone, company, position, lead_source")
          .eq("id", contactId)
          .single()
        if (loadErr) throw loadErr

        const patch = computeContactMergePatch(
          {
            phone: existing.phone,
            company: existing.company,
            position: existing.position,
            lead_source: existing.lead_source,
          },
          {
            phone: values.contact_phone ?? null,
            company: values.contact_company ?? null,
            position: values.contact_position ?? null,
            lead_source: values.lead_source,
          },
        )
        if (Object.keys(patch).length > 0) {
          const { error: updErr } = await supabase
            .from("contacts")
            .update(patch)
            .eq("id", contactId)
          if (updErr) throw updErr
          contactWasUpdated = true
        }
      } else {
        const { data: ins, error: insErr } = await supabase
          .from("contacts")
          .insert({
            name: values.contact_name,
            email: values.contact_email ?? null,
            phone: values.contact_phone ?? null,
            company: values.contact_company ?? null,
            position: values.contact_position ?? "Makler",
            lead_source: values.lead_source,
          })
          .select("id")
          .single()
        if (insErr) throw insErr
        contactId = ins.id
        contactWasCreated = true
      }

      const status = computeDefaultStatus({
        preis_kauf: values.preis_kauf ?? null,
        wohnflaeche_m2: values.wohnflaeche_m2 ?? null,
        kalk_verkaufspreis: values.kalk_verkaufspreis ?? null,
      })

      const { data: deal, error: dealErr } = await supabase
        .from("deals")
        .insert({
          contact_id: contactId,
          address: values.address,
          city: values.city ?? null,
          zip: values.zip ?? null,
          object_type: values.object_type,
          einheiten: values.einheiten ?? null,
          wohnflaeche_m2: values.wohnflaeche_m2 ?? null,
          preis_kauf: values.preis_kauf ?? null,
          kalk_verkaufspreis: values.kalk_verkaufspreis ?? null,
          expose_url: values.expose_url ?? null,
          status,
        })
        .select("id")
        .single()
      if (dealErr) throw dealErr

      const { error: logErr } = await supabase.from("activity_log").insert({
        type: "new_lead",
        contact_id: contactId,
        deal_id: deal.id,
      })
      if (logErr) {
        console.warn("activity_log insert failed:", logErr.message)
      }

      return {
        contactId,
        dealId: deal.id,
        contactWasCreated,
        contactWasUpdated,
      }
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["deals", "with-followup"] })
      qc.invalidateQueries({ queryKey: ["contacts"] })
      qc.invalidateQueries({ queryKey: ["distinct"] })
      const msg = res.contactWasCreated
        ? "Lead angelegt"
        : res.contactWasUpdated
          ? "Lead angelegt, Kontakt ergänzt"
          : "Lead angelegt, bestehenden Kontakt verwendet"
      toast.success(msg)
    },
    onError: (err) => toast.error(`Fehler: ${err.message}`),
  })
}

export const resolveContactMatch = async (
  formName: string,
  formEmail: string | null | undefined,
): Promise<CreateLeadResolution> => {
  const normEmail = normalizeEmail(formEmail)
  if (normEmail) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, name")
      .eq("email_normalized", normEmail)
      .is("deleted_at", null)
      .limit(1)
    if (error) throw error
    if (data && data.length > 0) {
      return {
        kind: "hard_match",
        contactId: data[0].id,
        contactName: data[0].name,
      }
    }
    return { kind: "no_match" }
  }

  const normName = normalizeName(formName)
  if (!normName) return { kind: "no_match" }
  const { data, error } = await supabase
    .from("contacts")
    .select("id, name, company, email")
    .is("deleted_at", null)
  if (error) throw error
  const candidates = (data ?? []).filter(
    (c) => normalizeName(c.name) === normName,
  )
  if (candidates.length === 0) return { kind: "no_match" }
  return { kind: "soft_match_pending", candidates }
}

export const resolveDealDuplicate = async (
  contactId: string,
  address: string,
  zip: string | null,
  wohnflaeche_m2: number | null,
): Promise<DealDuplicateResolution> => {
  const { data, error } = await supabase
    .from("deals")
    .select("id, address, zip, wohnflaeche_m2, status")
    .eq("contact_id", contactId)
    .is("deleted_at", null)
  if (error) throw error
  const duplicates = findDuplicateDeals(
    { address, zip, wohnflaeche_m2 },
    (data ?? []) as ExistingDeal[],
  )
  if (duplicates.length === 0) return { kind: "no_dup" }
  return { kind: "dup_pending", duplicates }
}
