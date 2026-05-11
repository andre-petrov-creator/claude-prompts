import EditableTextCell from "./EditableTextCell"

type Props = {
  value: number | string | null
  onSave: (next: number | null) => void
  display: (value: number | null) => React.ReactNode
}

const toNum = (v: number | string | null | undefined): number | null => {
  if (v == null || v === "") return null
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."))
  return Number.isFinite(n) ? n : null
}

export default function EditableNumberCell({ value, onSave, display }: Props) {
  const num = toNum(value)
  return (
    <EditableTextCell
      value={num == null ? null : String(num)}
      onSave={(raw) => onSave(toNum(raw))}
      display={() => display(num)}
      type="number"
      align="right"
    />
  )
}
