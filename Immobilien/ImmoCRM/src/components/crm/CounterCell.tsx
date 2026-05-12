import { Minus, Plus } from "lucide-react"

type Props = {
  value: number
  onChange: (next: number) => void
  min?: number
}

export default function CounterCell({ value, onChange, min = 0 }: Props) {
  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          if (value > min) onChange(value - 1)
        }}
        disabled={value <= min}
        aria-label="Verringern"
        title="Verringern"
        className="w-5 h-5 flex items-center justify-center rounded hover:bg-zinc-100 disabled:opacity-30 disabled:pointer-events-none"
      >
        <Minus className="w-3 h-3" />
      </button>
      <span
        className={`min-w-[1.5rem] text-center tabular-nums ${
          value === 0 ? "text-zinc-400" : "text-zinc-700"
        }`}
      >
        {value}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onChange(value + 1)
        }}
        aria-label="Erhöhen"
        title="Erhöhen"
        className="w-5 h-5 flex items-center justify-center rounded hover:bg-zinc-100"
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  )
}
