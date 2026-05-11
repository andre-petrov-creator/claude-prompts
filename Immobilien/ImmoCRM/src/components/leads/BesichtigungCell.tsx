import EditableDateCell from "./EditableDateCell"
import { useUpdateDealField } from "@/hooks/useUpdateDealField"

type Props = {
  dealId: string
  value: string | null
}

export default function BesichtigungCell({ dealId, value }: Props) {
  const update = useUpdateDealField()
  return (
    <EditableDateCell
      value={value}
      onSave={(iso) =>
        update.mutate({
          dealId,
          field: "besichtigung_datum",
          value: iso,
          successMessage: "Besichtigung aktualisiert",
        })
      }
    />
  )
}
