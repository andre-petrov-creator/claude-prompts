export const normalizeEmail = (raw: string | null | undefined): string | null => {
  if (!raw) return null
  const v = raw.trim().toLowerCase()
  return v.length === 0 ? null : v
}

export const normalizeName = (raw: string | null | undefined): string => {
  if (!raw) return ""
  return raw.trim().toLowerCase().replace(/\s+/g, " ")
}

export const normalizeAddress = (raw: string | null | undefined): string => {
  if (!raw) return ""
  return raw.trim().toLowerCase().replace(/\s+/g, " ").replace(/\.,?$/, "")
}
