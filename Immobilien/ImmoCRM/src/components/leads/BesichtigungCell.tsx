import ClickableDateCell from "./ClickableDateCell"
import { useUpdateDealField } from "@/hooks/useUpdateDealField"

type Props = {
  dealId: string
  value: string | null
}

export default function BesichtigungCell({ dealId, value }: Props) {
  const update = useUpdateDealField()
  return (
    <ClickableDateCell
      value={value}
      onSave={(iso) =>
        update.mutate({
          dealId,
          patch: { besichtigung_datum: iso },
          successMessage: "Besichtigung aktualisiert",
        })
      }
    />
  )
}
