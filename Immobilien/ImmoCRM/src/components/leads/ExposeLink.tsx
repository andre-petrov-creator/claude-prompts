import { FileText, Copy } from "lucide-react"
import { toast } from "sonner"
import { resolveExposeHref } from "@/lib/openExternalLink"

type Props = {
  url: string | null | undefined
  localPath: string | null | undefined
}

export default function ExposeLink({ url, localPath }: Props) {
  const href = resolveExposeHref(url, localPath)
  const hasLink = href !== null
  const isLocal = href !== null && href.startsWith("file://")

  if (!hasLink) {
    return (
      <span className="text-zinc-300" aria-label="kein exposé">
        <FileText className="w-4 h-4" />
      </span>
    )
  }

  const copyPath = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    await navigator.clipboard.writeText(href!)
    toast.success("Pfad kopiert")
  }

  return (
    <span className="inline-flex items-center gap-1">
      <a
        href={href!}
        target="_blank"
        rel="noreferrer"
        title={href!}
        onClick={(e) => e.stopPropagation()}
        className="text-blue-600 hover:text-blue-800"
      >
        <FileText className="w-4 h-4" />
      </a>
      {isLocal && (
        <button
          onClick={copyPath}
          title="Pfad kopieren"
          className="text-zinc-400 hover:text-zinc-700"
        >
          <Copy className="w-3 h-3" />
        </button>
      )}
    </span>
  )
}
