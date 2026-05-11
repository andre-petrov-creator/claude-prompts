import { z } from "zod"

const trim = (v: unknown) => (typeof v === "string" ? v.trim() : v)
const optionalTrimmed = z
  .preprocess(trim, z.string().optional())
  .transform((v) => (v && v.length > 0 ? v : undefined))
const requiredTrimmed = (msg: string) =>
  z.preprocess(trim, z.string().min(1, msg))

const numberFromInput = z
  .preprocess(
    (v) => {
      if (v == null || v === "") return undefined
      if (typeof v === "number") return v
      if (typeof v === "string") {
        // Deutsches Format: Komma als Dezimaltrennzeichen, Punkt als Tausender
        const cleaned = v.replace(/\./g, "").replace(",", ".").trim()
        const n = Number(cleaned)
        return Number.isFinite(n) ? n : undefined
      }
      return undefined
    },
    z.number().positive().optional(),
  )

export const OBJECT_TYPES = [
  "MFH",
  "ETW",
  "WHG",
  "REH",
  "EFH",
  "DHH",
  "Bungalow",
  "sonstige",
] as const
export type ObjectType = (typeof OBJECT_TYPES)[number]

export const LEAD_SOURCES = [
  "Online",
  "Off-Market",
  "Entrümpler",
  "Direktkontakt",
  "Auktion",
] as const

export const quickLeadSchema = z
  .object({
    contact_id: z.string().uuid().optional(),
    contact_name: requiredTrimmed("Name ist Pflicht"),
    contact_email: z
      .preprocess(trim, z.string().optional())
      .transform((v) => (v && v.length > 0 ? v : undefined))
      .pipe(z.string().email("Ungültige E-Mail").optional()),
    contact_phone: optionalTrimmed,
    contact_company: optionalTrimmed,
    contact_position: optionalTrimmed,

    address: requiredTrimmed("Adresse ist Pflicht"),
    city: optionalTrimmed,
    zip: optionalTrimmed,
    object_type: z.enum(OBJECT_TYPES, { message: "Objekttyp wählen" }),
    einheiten: numberFromInput,
    lead_source: z.enum(LEAD_SOURCES, { message: "Lead-Herkunft wählen" }),

    wohnflaeche_m2: numberFromInput,
    preis_kauf: numberFromInput,
    kalk_verkaufspreis: numberFromInput,
    expose_url: z
      .preprocess(trim, z.string().optional())
      .transform((v) => (v && v.length > 0 ? v : undefined))
      .pipe(z.string().url("Muss eine gültige URL sein").optional()),
  })
  .refine(
    (d) => d.object_type !== "MFH" || (d.einheiten != null && d.einheiten > 0),
    {
      message: "Einheiten ist Pflicht bei MFH",
      path: ["einheiten"],
    },
  )

export type QuickLeadFormValues = z.input<typeof quickLeadSchema>
export type QuickLeadParsed = z.output<typeof quickLeadSchema>
