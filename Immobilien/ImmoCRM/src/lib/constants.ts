import type { DealStatus } from "@/types/domain"

export const STATUS_LABELS: Record<DealStatus, string> = {
  offen: "Offen",
  berechnet: "Berechnet",
  absage: "Absage",
}

export const STATUS_COLORS: Record<DealStatus, string> = {
  offen: "bg-orange-100 text-orange-800 border-orange-200",
  berechnet: "bg-green-100 text-green-800 border-green-200",
  absage: "bg-red-100 text-red-800 border-red-200",
}

export const SECTION_ORDER: DealStatus[] = ["berechnet", "offen", "absage"]

export const OBJECT_TYPE_DEFAULTS = ["MFH", "ETW", "REH", "EFH", "DHH", "Bungalow"]
export const VERWENDUNG_DEFAULTS = ["B&H", "F&F"]
export const LEAD_SOURCE_DEFAULTS = [
  "Online",
  "Off-Market",
  "Entrümpler",
  "Direktkontakt",
  "Auktion",
]
