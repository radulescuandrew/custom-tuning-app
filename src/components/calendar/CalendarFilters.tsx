import { useMemo } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui'
import { cx } from '@/lib/utils'
import { canSeeTimeOff, statusLabel, useCurrentUser, useStore } from '@/data/store'
import type { Job, JobStatus } from '@/data/types'
import type { CalFilters, Layer } from './useCalendarEvents'

/** Starea completă a filtrelor de pe telefon: straturi și operator pentru evenimente, status și
 *  căutare pentru lucrări. Ultimele două taie `Job[]` înainte de `useCalendarEvents`. */
export interface MobileFilters extends CalFilters {
  status: JobStatus | 'toate'
  q: string
}

export const DEFAULT_FILTERS: MobileFilters = {
  layers: ['primire', 'executie'],
  who: 'toti',
  status: 'toate',
  q: '',
}

const STATUSES: (JobStatus | 'toate')[] = [
  'toate',
  'programat',
  'in_lucru',
  'asteapta_piese',
  'finalizat',
  'predat',
]

/** Câte filtre sunt strânse în sheet — numărul de pe buton, ca să nu rămână ascunse. */
export const activeFilterCount = (f: MobileFilters) => {
  const base = DEFAULT_FILTERS.layers
  const layersChanged =
    f.layers.length !== base.length || base.some((l) => !f.layers.includes(l))
  return (
    (layersChanged ? 1 : 0) +
    (f.who !== 'toti' ? 1 : 0) +
    (f.status !== 'toate' ? 1 : 0) +
    (f.q.trim() ? 1 : 0)
  )
}

export function CalendarFilters({
  open,
  onClose,
  value,
  onChange,
  jobs,
}: {
  open: boolean
  onClose: () => void
  value: MobileFilters
  onChange: (f: MobileFilters) => void
  /** pentru numărătoarea de lângă fiecare status */
  jobs: Job[]
}) {
  const staff = useStore((s) => s.staff)
  const me = useCurrentUser()
  const canSeeOff = canSeeTimeOff(me?.role)

  const byPosition = useMemo(() => {
    const groups = new Map<string, typeof staff>()
    staff.forEach((s) => {
      const pos = s.position || 'Echipă'
      groups.set(pos, [...(groups.get(pos) ?? []), s])
    })
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ro'))
  }, [staff])

  const toggleLayer = (l: Layer) =>
    onChange({
      ...value,
      layers: value.layers.includes(l)
        ? value.layers.filter((x) => x !== l)
        : [...value.layers, l],
    })

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Filtre"
      footer={
        <>
          <Button className="min-h-[44px] flex-1" onClick={() => onChange(DEFAULT_FILTERS)}>
            Șterge filtrele
          </Button>
          <Button variant="primary" className="min-h-[44px] flex-1" onClick={onClose}>
            Gata
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <section>
          <h4 className="mono-label mb-2">Straturi</h4>
          <div className="space-y-1.5">
            <LayerRow
              on={value.layers.includes('primire')}
              onClick={() => toggleLayer('primire')}
              swatch={<span className="h-3.5 w-3.5 rounded-[3px] border-2 border-fg-mute bg-white" />}
              label="Primire mașină"
            />
            <LayerRow
              on={value.layers.includes('executie')}
              onClick={() => toggleLayer('executie')}
              swatch={
                <span className="h-3.5 w-3.5 rounded-[3px] border-l-[3px] border-brand-500 bg-brand-500/20" />
              }
              label="Execuție"
            />
            {canSeeOff && (
              <LayerRow
                on={value.layers.includes('concedii')}
                onClick={() => toggleLayer('concedii')}
                swatch={<span className="h-3.5 w-3.5 rounded-[3px] bg-[#5b8def]/40" />}
                label="Concedii"
              />
            )}
          </div>
        </section>

        <section>
          <h4 className="mono-label mb-2">Status</h4>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((s) => {
              const count =
                s === 'toate' ? jobs.length : jobs.filter((j) => j.status === s).length
              return (
                <button
                  key={s}
                  onClick={() => onChange({ ...value, status: s })}
                  className={cx(
                    'min-h-[44px] rounded-lg border px-3 text-[13px] font-semibold',
                    value.status === s
                      ? 'border-brand-500/60 bg-brand-500/10 text-brand-400'
                      : 'border-line text-fg-mute',
                  )}
                >
                  {s === 'toate' ? 'Toate' : statusLabel(s)}
                  <span className="ml-1.5 font-mono text-[11px] opacity-70">{count}</span>
                </button>
              )
            })}
          </div>
        </section>

        <section>
          <h4 className="mono-label mb-2">Operator</h4>
          <div className="space-y-1">
            <OperatorRow
              on={value.who === 'toti'}
              onClick={() => onChange({ ...value, who: 'toti' })}
              label="Toți operatorii"
            />
            {byPosition.map(([pos, members]) => (
              <div key={pos}>
                <p className="mt-2 mb-1 font-mono text-[10px] text-fg-faint uppercase">{pos}</p>
                {members.map((m) => (
                  <OperatorRow
                    key={m.id}
                    on={value.who === m.name}
                    onClick={() => onChange({ ...value, who: m.name })}
                    label={m.name}
                  />
                ))}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h4 className="mono-label mb-2">Caută</h4>
          <input
            value={value.q}
            onChange={(e) => onChange({ ...value, q: e.target.value })}
            placeholder="Client, mașină, nr. înmatriculare, PRG-…"
            className="w-full rounded-lg border border-line-strong bg-ink-750 px-3 py-2.5 text-[16px] outline-none placeholder:text-fg-faint focus:border-brand-500/60"
          />
        </section>
      </div>
    </Sheet>
  )
}

const LayerRow = ({
  on,
  onClick,
  swatch,
  label,
}: {
  on: boolean
  onClick: () => void
  swatch: React.ReactNode
  label: string
}) => (
  <button
    onClick={onClick}
    className={cx(
      'flex min-h-[44px] w-full items-center gap-2.5 rounded-lg border px-3 text-[14px] font-semibold',
      on ? 'border-line-strong bg-ink-750 text-fg' : 'border-line text-fg-faint',
    )}
  >
    {swatch}
    {label}
  </button>
)

const OperatorRow = ({
  on,
  onClick,
  label,
}: {
  on: boolean
  onClick: () => void
  label: string
}) => (
  <button
    onClick={onClick}
    className={cx(
      'flex min-h-[44px] w-full items-center justify-between rounded-lg px-3 text-[14px]',
      on ? 'bg-brand-500/10 font-semibold text-brand-400' : 'text-fg-mute',
    )}
  >
    {label}
    {on && <span className="text-brand-500">✓</span>}
  </button>
)
