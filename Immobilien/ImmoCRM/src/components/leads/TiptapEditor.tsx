import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import { Bold, Italic, List, ListOrdered, Underline as U } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  initialHtml?: string
  onSave: (html: string) => void
  onCancel?: () => void
  saveLabel?: string
  autoFocus?: boolean
}

export default function TiptapEditor({
  initialHtml = "",
  onSave,
  onCancel,
  saveLabel = "Speichern",
  autoFocus = true,
}: Props) {
  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: initialHtml,
    autofocus: autoFocus,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[80px] focus:outline-none p-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1",
      },
    },
  })

  if (!editor) return null

  const ToolButton = ({
    onClick,
    active,
    label,
    children,
  }: {
    onClick: () => void
    active: boolean
    label: string
    children: React.ReactNode
  }) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "p-1.5 rounded hover:bg-zinc-200",
        active && "bg-zinc-200 text-zinc-900",
      )}
    >
      {children}
    </button>
  )

  const submit = () => {
    const html = editor.getHTML()
    if (html.replace(/<[^>]*>/g, "").trim().length === 0) return
    onSave(html)
    editor.commands.clearContent()
  }

  return (
    <div className="border rounded">
      <div className="flex items-center gap-0.5 border-b px-1 py-1 bg-zinc-50">
        <ToolButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          label="Fett"
        >
          <Bold className="w-4 h-4" />
        </ToolButton>
        <ToolButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          label="Kursiv"
        >
          <Italic className="w-4 h-4" />
        </ToolButton>
        <ToolButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")}
          label="Unterstrichen"
        >
          <U className="w-4 h-4" />
        </ToolButton>
        <div className="w-px h-4 bg-zinc-300 mx-1" />
        <ToolButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          label="Aufzählung"
        >
          <List className="w-4 h-4" />
        </ToolButton>
        <ToolButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          label="Nummerierte Liste"
        >
          <ListOrdered className="w-4 h-4" />
        </ToolButton>
      </div>
      <EditorContent editor={editor} />
      <div className="flex justify-end gap-2 p-2 border-t bg-zinc-50">
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Abbrechen
          </Button>
        )}
        <Button size="sm" onClick={submit}>
          {saveLabel}
        </Button>
      </div>
    </div>
  )
}
