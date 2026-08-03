import { useSettings } from '@/data/store'
import { amounts, fmtRon, vatLabel } from '@/lib/money'
import { cx } from '@/lib/utils'

/** Formatează o sumă ca total de plată (cu TVA, dacă e cazul). */
export const useMoney = () => {
  const s = useSettings()
  return {
    settings: s,
    /** total de plată, formatat */
    fmt: (value: number) => fmtRon(amounts(value, s).gross),
    /** descompunerea completă */
    calc: (value: number) => amounts(value, s),
  }
}

/** Sumă simplă (total de plată) — pentru liste și tabele. */
export function Money({ value, className }: { value: number; className?: string }) {
  const { fmt } = useMoney()
  return <span className={className}>{fmt(value)}</span>
}

/**
 * Totalul unei lucrări, cu bază + TVA când firma e plătitoare.
 * `compact` = variantă pe un rând, pentru carduri mici.
 */
export function TotalBreakdown({
  value,
  label = 'Total de plată',
  className,
}: {
  value: number
  label?: string
  className?: string
}) {
  const { settings } = useMoney()
  const a = amounts(value, settings)

  return (
    <div className={cx('space-y-1.5', className)}>
      {a.showsVat && (
        <>
          <Row label="Subtotal (fără TVA)" value={fmtRon(a.net)} />
          <Row label={vatLabel(settings)} value={fmtRon(a.vat)} />
        </>
      )}
      <div className="flex items-baseline justify-between gap-4 border-t border-line pt-1.5">
        <span className="mono-label text-fg-mute">{label}</span>
        <span className="text-xl font-extrabold text-brand-400">{fmtRon(a.gross)}</span>
      </div>
      {!a.showsVat && (
        <p className="text-[11px] text-fg-faint">Firmă neplătitoare de TVA — prețuri finale.</p>
      )}
    </div>
  )
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-4 text-[13px]">
    <span className="text-fg-mute">{label}</span>
    <span className="font-mono text-fg-dim">{value}</span>
  </div>
)

/** Notă mică de pus lângă sume izolate („TVA 21% inclus”). */
export function VatHint({ className }: { className?: string }) {
  const { settings } = useMoney()
  return (
    <span className={cx('text-[11px] text-fg-faint', className)}>
      {settings.vatPayer ? `TVA ${settings.vatRate}% inclus` : 'fără TVA'}
    </span>
  )
}
