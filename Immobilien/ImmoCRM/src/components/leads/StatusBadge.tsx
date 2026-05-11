import { cn } from "@/lib/utils"
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants"
import type { DealStatus } from "@/types/domain"

export default function StatusBadge({ status }: { status: DealStatus }) {
  return (
    <span
      className={cn(
        "inline-flex px-2 py-0.5 rounded text-xs font-medium border",
        STATUS_COLORS[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
