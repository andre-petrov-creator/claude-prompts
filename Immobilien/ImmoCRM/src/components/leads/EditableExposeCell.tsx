import { useState } from "react"
import { FileText, Copy } from "lucide-react"
import { toast } from "sonner"
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { resolveExposeHref } from "@/lib/openExternalLink"
import EditableCellShell from "./EditableCellShell"

type Props = {
  url: string | null
  localPath: string | null
  onSave: (patch: { expose_url: string | null; expose_local_path: string | null }) => void
}

const norm = (v: string) => (v.trim() === "" ? null : v.trim())

export default function EditableExposeCell({
  url,
  localPath,
  onSave,
}: Props) {
  const [open, setOpen] = useState(false)
  const [u, setU] = useState(url ?? "")
  const [p, setP] = useState(localPath ?? "")

  const handleOpen = (next: boolean) => {
    if (next) {
      setU(url ?? "")
      setP(localPath ?? "")
    }
    setOpen(next)
  }

  const submit = () => {
    onSave({ expose_url: norm(u), expose_local_path: norm(p) })
    setOpen(false)
  }

  const href = resolveExposeHref(url, localPath)
  const isLocal = href !== null && href.startsWith("file://")

  const copyPath = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    await navigator.clipboard.writeText(href!)
    toast.success("Pfad kopiert")
  }

  const display = (
    <span className="inline-flex items-center gap-1">
      {href ? (
        <>
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            title={href}
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
        </>
      ) : (
        <span className="text-zinc-300">
          <FileText className="w-4 h-4" />
        </span>
      )}
    </span>
  )

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverAnchor asChild>
        <div>
          <EditableCellShell
            display={display}
            onActivate={() => handleOpen(true)}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-80 p-3"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <div>
            <label className="text-xs text-zinc-500">URL (https://…)</label>
            <input
              autoFocus
              value={u}
              onChange={(e) => setU(e.target.value)}
              placeholder="https://www.immoscout24.de/…"
              className="w-full px-2 py-1 text-sm border rounded outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Lokaler Pfad</label>
            <input
              value={p}
              onChange={(e) => setP(e.target.value)}
              placeholder="C:\OneDrive\Exposés\…"
              className="w-full px-2 py-1 text-sm border rounded outline-none focus:border-blue-400"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button size="sm" onClick={submit}>
              Speichern
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
