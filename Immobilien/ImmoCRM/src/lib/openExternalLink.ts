export const resolveExposeHref = (
  url: string | null | undefined,
  localPath: string | null | undefined,
): string | null => {
  if (url && url.trim()) return url.trim()
  if (localPath && localPath.trim()) {
    const p = localPath.trim()
    if (p.startsWith("file://") || /^[a-z]+:\/\//i.test(p)) return p
    return `file:///${p.replace(/\\/g, "/").replace(/^\/+/, "")}`
  }
  return null
}
