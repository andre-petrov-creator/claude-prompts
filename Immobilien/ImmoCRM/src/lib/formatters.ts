const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
})
const m2 = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 })
const date = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

export const formatCurrency = (v: number | string | null | undefined): string =>
  v == null || v === "" ? "—" : eur.format(typeof v === "string" ? Number(v) : v)

export const formatM2 = (v: number | string | null | undefined): string =>
  v == null || v === "" ? "—" : `${m2.format(typeof v === "string" ? Number(v) : v)} m²`

export const formatDate = (v: string | null | undefined): string =>
  v == null ? "—" : date.format(new Date(v))

export const isOverdue = (v: string | null | undefined): boolean => {
  if (!v) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(v) < today
}
