import type { DealStatus } from "@/types/domain"
import { normalizeAddress } from "@/lib/normalize"

export type StatusInputs = {
  preis_kauf: number | null
  wohnflaeche_m2: number | null
  kalk_verkaufspreis: number | null
}

export const computeDefaultStatus = (i: StatusInputs): DealStatus => {
  const complete =
    i.preis_kauf != null &&
    i.preis_kauf > 0 &&
    i.wohnflaeche_m2 != null &&
    i.wohnflaeche_m2 > 0 &&
    i.kalk_verkaufspreis != null &&
    i.kalk_verkaufspreis > 0
  return complete ? "berechnet" : "offen"
}

export type ExistingDeal = {
  id: string
  address: string | null
  zip: string | null
  wohnflaeche_m2: number | null
  status: DealStatus
}

export type DealDuplicateInput = {
  address: string
  zip: string | null
  wohnflaeche_m2: number | null
}

export const findDuplicateDeals = (
  input: DealDuplicateInput,
  existing: ExistingDeal[],
): ExistingDeal[] => {
  const aAddr = normalizeAddress(input.address)
  if (!aAddr) return []
  const aZip = (input.zip ?? "").trim()
  return existing.filter((d) => {
    if (normalizeAddress(d.address) !== aAddr) return false
    if ((d.zip ?? "").trim() !== aZip) return false
    if (input.wohnflaeche_m2 != null && d.wohnflaeche_m2 != null) {
      return Math.abs(input.wohnflaeche_m2 - d.wohnflaeche_m2) <= 1
    }
    return true
  })
}

export type ContactMergePatch = Partial<{
  phone: string
  company: string
  position: string
  lead_source: string
}>

export const computeContactMergePatch = (
  existing: {
    phone: string | null
    company: string | null
    position: string | null
    lead_source: string | null
  },
  form: {
    phone?: string | null
    company?: string | null
    position?: string | null
    lead_source?: string | null
  },
): ContactMergePatch => {
  const patch: ContactMergePatch = {}
  const fill = (
    key: "phone" | "company" | "position" | "lead_source",
  ) => {
    const dbVal = existing[key]
    const formVal = form[key]
    if ((dbVal == null || dbVal.trim() === "") && formVal && formVal.trim()) {
      patch[key] = formVal.trim()
    }
  }
  fill("phone")
  fill("company")
  fill("position")
  fill("lead_source")
  return patch
}
