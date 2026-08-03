export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  unit,
}: {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  unit?: string
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100))
  const btn =
    'flex h-11 w-11 flex-none items-center justify-center rounded-lg border border-line-strong bg-ink-800 text-lg font-bold text-fg disabled:opacity-40'

  return (
    <div className="flex items-center gap-2">
      <button className={btn} onClick={() => onChange(clamp(value - step))} disabled={value <= min}>
        −
      </button>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        className="h-11 w-20 rounded-lg border border-line-strong bg-ink-750 text-center text-base font-semibold outline-none focus:border-brand-500/70"
      />
      {unit && <span className="mono-label">{unit}</span>}
      <button className={btn} onClick={() => onChange(clamp(value + step))} disabled={value >= max}>
        +
      </button>
    </div>
  )
}
