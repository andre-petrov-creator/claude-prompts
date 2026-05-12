import { cn } from "@/lib/utils"
import { CONTACT_STATUS_COLORS, CONTACT_STATUS_LABELS } from "@/lib/constants"
import type { ContactStatus } from "@/types/domain"

export default function ContactStatusBadge({
  status,
}: {
  status: ContactStatus
}) {
  return (
    <span
      className={cn(
        "inline-flex px-2 py-0.5 rounded text-xs font-medium border",
        CONTACT_STATUS_COLORS[status],
      )}
    >
      {CONTACT_STATUS_LABELS[status]}
    </span>
  )
}
