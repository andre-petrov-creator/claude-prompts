import type { DealStatus, ContactStatus } from "@/types/domain"

export const STATUS_LABELS: Record<DealStatus, string> = {
  pre_screened: "Pre-Screened",
  offen: "Offen",
  berechnet: "Berechnet",
  absage: "Absage",
}

export const STATUS_COLORS: Record<DealStatus, string> = {
  pre_screened: "bg-purple-100 text-purple-800 border-purple-300",
  offen: "bg-orange-100 text-orange-800 border-orange-200",
  berechnet: "bg-green-100 text-green-800 border-green-200",
  absage: "bg-red-100 text-red-800 border-red-200",
}

export const SECTION_ORDER: DealStatus[] = ["pre_screened", "berechnet", "offen", "absage"]

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  kalt: "Kalt",
  warm: "Warm",
  heiß: "Heiß",
  nr1: "Nr. 1",
}

export const CONTACT_STATUS_COLORS: Record<ContactStatus, string> = {
  kalt: "bg-zinc-100 text-zinc-700 border-zinc-200",
  warm: "bg-yellow-100 text-yellow-800 border-yellow-200",
  heiß: "bg-orange-100 text-orange-800 border-orange-200",
  nr1: "bg-red-100 text-red-800 border-red-200",
}

export const CONTACT_STATUS_OPTIONS: { value: ContactStatus; label: string }[] = [
  { value: "kalt", label: "Kalt" },
  { value: "warm", label: "Warm" },
  { value: "heiß", label: "Heiß" },
  { value: "nr1", label: "Nr. 1" },
]

export const OBJECT_TYPE_DEFAULTS = ["MFH", "ETW", "REH", "EFH", "DHH", "Bungalow"]
export const VERWENDUNG_DEFAULTS = ["B&H", "F&F"]
export const LEAD_SOURCE_DEFAULTS = [
  "Online",
  "Off-Market",
  "Entrümpler",
  "Direktkontakt",
  "Auktion",
]
