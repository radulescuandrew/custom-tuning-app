import { cx } from '@/lib/utils'

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={cx('flex rounded-lg bg-black/[0.06] p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'min-h-[36px] flex-1 rounded-[7px] px-3 text-[13px] font-semibold transition',
            value === o.value ? 'bg-ink-900 text-fg shadow-sm' : 'text-fg-mute',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
