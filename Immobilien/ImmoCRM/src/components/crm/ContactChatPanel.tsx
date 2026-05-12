import { useEffect, useRef } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { useContactComments } from "@/hooks/useContactComments"
import { useContactCommentMutations } from "@/hooks/useContactCommentMutations"
import ContactChatItem from "./ContactChatItem"
import ChatInput from "./ChatInput"

type Props = {
  contactId: string | null
  contactName: string
  contactSubtitle?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function ContactChatPanel({
  contactId,
  contactName,
  contactSubtitle,
  open,
  onOpenChange,
}: Props) {
  const { data: comments, isLoading } = useContactComments(contactId)
  const { create, update, remove } = useContactCommentMutations(contactId ?? "")
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current && comments && comments.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [comments?.length, open])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:max-w-[480px] flex flex-col">
        <SheetHeader>
          <SheetTitle>{contactName}</SheetTitle>
          {contactSubtitle && (
            <SheetDescription className="truncate">
              {contactSubtitle}
            </SheetDescription>
          )}
        </SheetHeader>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto -mx-6 px-6 py-2"
        >
          {isLoading ? (
            <div className="text-zinc-500 text-sm py-4">Lädt…</div>
          ) : !comments || comments.length === 0 ? (
            <div className="text-zinc-400 text-sm py-4 text-center">
              Noch keine Kommentare.
            </div>
          ) : (
            comments.map((c) => (
              <ContactChatItem
                key={c.id}
                comment={c}
                onUpdate={(id, text) => update.mutate({ id, text })}
                onDelete={(id) => remove.mutate(id)}
              />
            ))
          )}
        </div>

        <div className="pt-3 border-t">
          <ChatInput
            resetKey={contactId}
            onSend={(text) => create.mutate(text)}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
