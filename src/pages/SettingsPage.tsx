import { useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Card, Field } from '@/components/ui'
import { IconWarn } from '@/components/Icons'
import { ROLE_LABEL, canEditSettings, useCurrentUser, useStore } from '@/data/store'
import {
  CAR_CLASSES,
  CAR_TYPES,
  GRID_ROWS,
  SERVICE_CATALOG,
  gridTier,
  serviceBaseMin,
  servicePrice,
  type ServiceDef,
  type Tier,
} from '@/data/serviceCatalog'
import type { ServiceKind, Settings } from '@/data/types'
import { cx } from '@/lib/utils'

/** Familii, în ordinea în care se vând — doar pentru gruparea listei. */
const FAMILIES: { label: string; kinds: ServiceKind[] }[] = [
  { label: 'Folii', kinds: ['colantare', 'folie_geam', 'folie_parbriz'] },
  { label: 'Detailing & protecție', kinds: ['detailing', 'ceramica'] },
  { label: 'Tuning & performanță', kinds: ['jante', 'evacuare', 'suspensii', 'tuning', 'chip_tuning', 'custom'] },
]

export default function SettingsPage() {
  const me = useCurrentUser()
  const { settings, updateSettings } = useStore()

  if (!canEditSettings(me?.role))
    return (
      <Card>
        <div className="flex items-center gap-3">
          <IconWarn className="text-ember" />
          <div>
            <p className="font-semibold">Acces restricționat</p>
            <p className="text-[13px] text-fg-mute">
              Setările se schimbă doar de owner sau manager. Ești logat ca {me?.name} (
              {ROLE_LABEL[me?.role ?? 'operator']}).
            </p>
          </div>
        </div>
      </Card>
    )

  return (
    <>
      <PageHeader
        title="Setări"
        subtitle="Ce oferă atelierul, la ce preț și în cât timp — se aplică programărilor noi"
      />
      <ServicesTab settings={settings} update={updateSettings} />
      <h2 className="mt-8 mb-3 text-[15px] font-bold">Timpi de lucru</h2>
      <TimesTab settings={settings} update={updateSettings} />
    </>
  )
}

type TabProps = { settings: Settings; update: (p: Partial<Settings>) => void }

/* ───────────────────────── Servicii & prețuri ───────────────────────── */

function ServicesTab({ settings, update }: TabProps) {
  const [open, setOpen] = useState<ServiceKind | null>('detailing')
  const disabled = settings.serviceDisabled ?? []
  const active = SERVICE_CATALOG.length - disabled.length

  const setPrice = (kind: ServiceKind, v: number) =>
    update({ servicePrice: { ...settings.servicePrice, [kind]: Math.max(0, v) } })
  const setHours = (kind: ServiceKind, h: number) =>
    update({
      serviceDurationMin: {
        ...settings.serviceDurationMin,
        [kind]: Math.max(15, Math.round((h * 60) / 15) * 15),
      },
    })
  const toggle = (kind: ServiceKind) =>
    update({
      serviceDisabled: disabled.includes(kind) ? disabled.filter((k) => k !== kind) : [...disabled, kind],
    })
  /** revenire la valorile din catalog: preț, durată și grilă */
  const reset = (def: ServiceDef) => {
    const servicePrice = { ...settings.servicePrice }
    const serviceDurationMin = { ...settings.serviceDurationMin }
    const gridPrices = { ...settings.gridPrices }
    delete servicePrice[def.kind]
    delete serviceDurationMin[def.kind]
    GRID_ROWS.filter((r) => r.kind === def.kind).forEach((r) => delete gridPrices[r.key])
    update({ servicePrice, serviceDurationMin, gridPrices })
  }
  const isCustomized = (def: ServiceDef) =>
    settings.servicePrice?.[def.kind] !== undefined ||
    settings.serviceDurationMin?.[def.kind] !== undefined ||
    GRID_ROWS.some((r) => r.kind === def.kind && settings.gridPrices?.[r.key])

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-5">
        {FAMILIES.map((fam) => (
          <Card key={fam.label} title={fam.label} pad={false}>
            <div className="hidden grid-cols-[44px_1fr_150px_110px_90px] gap-3 border-b border-line px-5 py-2 sm:grid">
              <span />
              <span className="mono-label">Serviciu</span>
              <span className="mono-label">Preț orientativ</span>
              <span className="mono-label">Durată</span>
              <span />
            </div>
            <ul className="divide-y divide-line">
              {fam.kinds.map((kind) => {
                const def = SERVICE_CATALOG.find((d) => d.kind === kind)!
                const off = disabled.includes(kind)
                const hasGrid = GRID_ROWS.some((r) => r.kind === kind)
                const expanded = open === kind && hasGrid && !off
                const price = servicePrice(kind, settings)
                const hours = serviceBaseMin(kind, settings) / 60
                return (
                  <li key={kind} className={cx(off && 'bg-black/[0.02]')}>
                    <div className="grid grid-cols-[44px_1fr] items-center gap-3 px-5 py-3 sm:grid-cols-[44px_1fr_150px_110px_90px]">
                      <Switch on={!off} onClick={() => toggle(kind)} label={`${def.label} activ`} />
                      <div className={cx('min-w-0', off && 'opacity-50')}>
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 flex-none rounded-full" style={{ background: def.accent }} />
                          <span className="truncate text-[14px] font-semibold">{def.label}</span>
                          {isCustomized(def) && (
                            <span className="rounded bg-brand-500/10 px-1.5 py-0.5 font-mono text-[10px] text-brand-500">
                              modificat
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[12px] text-fg-faint">
                          {off
                            ? 'Nu apare la programări noi'
                            : hasGrid
                              ? 'Prețul se calculează din grila pe clase'
                              : kind === 'custom'
                                ? 'Fără preț implicit — se stabilește cu clientul'
                                : def.short}
                        </div>
                      </div>
                      <div className={cx('col-span-2 grid grid-cols-2 gap-3 sm:contents', off && 'opacity-50')}>
                        {hasGrid ? (
                          <button
                            onClick={() => setOpen(expanded ? null : kind)}
                            disabled={off}
                            className="flex h-9 items-center justify-end rounded-lg border border-dashed border-line-strong px-2.5 text-[12px] text-fg-mute hover:text-brand-500"
                          >
                            din grilă pe clase
                          </button>
                        ) : (
                          <NumberBox
                            value={price}
                            suffix="RON"
                            step={50}
                            disabled={off}
                            onChange={(v) => setPrice(kind, v)}
                          />
                        )}
                        <NumberBox
                          value={Math.round(hours * 100) / 100}
                          suffix="h"
                          step={0.25}
                          disabled={off}
                          onChange={(v) => setHours(kind, v)}
                        />
                      </div>
                      <div className="col-span-2 flex justify-end gap-3 text-[12.5px] sm:col-span-1">
                        {isCustomized(def) && (
                          <button onClick={() => reset(def)} className="text-fg-faint hover:text-fg" title="Revino la valorile implicite">
                            ↺ implicit
                          </button>
                        )}
                        {hasGrid && !off && (
                          <button
                            onClick={() => setOpen(expanded ? null : kind)}
                            className="font-semibold text-brand-500 hover:underline"
                          >
                            {expanded ? 'ascunde' : 'grilă'}
                          </button>
                        )}
                      </div>
                    </div>
                    {expanded && <GridEditor kind={kind as 'detailing' | 'ceramica'} settings={settings} update={update} />}
                  </li>
                )
              })}
            </ul>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-5">
        <Card title="Pe scurt">
          <div className="text-[30px] leading-none font-extrabold">
            {active}
            <span className="ml-1 text-[14px] font-semibold text-fg-mute">/ {SERVICE_CATALOG.length} servicii active</span>
          </div>
          <ul className="mt-4 flex flex-col gap-2 text-[12.5px] text-fg-mute">
            <li>
              <strong className="text-fg">Prețul orientativ</strong> se propune când adaugi serviciul la o
              programare — rămâne editabil în fișă.
            </li>
            <li>
              <strong className="text-fg">Detailing și ceramica</strong> se calculează din grilă, după
              opțiunile bifate și clasa mașinii.
            </li>
            <li>
              <strong className="text-fg">Durata</strong> e pentru un sedan; tipul de caroserie o ajustează
              (vezi „Timpi de lucru”).
            </li>
            <li>
              <strong className="text-fg">Programările existente</strong> își păstrează prețurile.
            </li>
            <li>
              Un serviciu <strong className="text-fg">dezactivat</strong> nu mai apare la programări noi;
              lucrările vechi rămân neatinse.
            </li>
          </ul>
        </Card>
        <Card title="Clase de mașină">
          <p className="text-[12.5px] text-fg-mute">
            Clasa se alege pe fiecare mașină (implicit din caroserie: SUV = Mare, restul = Medie;
            Supercar se alege de mână).
          </p>
          <div className="mt-3 flex gap-2">
            {CAR_CLASSES.map((c) => (
              <span key={c.value} className="rounded-lg border border-line px-2.5 py-1 text-[12.5px] font-semibold">
                {c.label}
              </span>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

/** Grila pe clase pentru detailing / ceramică: un rând pe opțiune, câte un preț pe clasă. */
function GridEditor({
  kind,
  settings,
  update,
}: TabProps & { kind: 'detailing' | 'ceramica' }) {
  const rows = GRID_ROWS.filter((r) => r.kind === kind)
  const set = (key: string, tier: Tier, i: number, v: number) => {
    const next = [...tier] as Tier
    next[i] = Math.max(0, v)
    update({ gridPrices: { ...settings.gridPrices, [key]: next } })
  }
  return (
    <div className="border-t border-line bg-ink-750/40 px-5 py-4">
      <div className="mb-2 grid grid-cols-[1fr_repeat(3,minmax(0,120px))] gap-2">
        <span className="mono-label">{kind === 'ceramica' ? 'Produs' : 'Opțiune'}</span>
        {CAR_CLASSES.map((c) => (
          <span key={c.value} className="mono-label text-right">
            {c.label}
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        {rows.map((r) => {
          const tier = gridTier(r, settings)
          const changed = !!settings.gridPrices?.[r.key]
          return (
            <div key={r.key} className="grid grid-cols-[1fr_repeat(3,minmax(0,120px))] items-center gap-2">
              <span className={cx('truncate text-[13px]', changed && 'font-semibold')}>{r.label}</span>
              {tier.map((v, i) => (
                <NumberBox key={i} value={v} suffix="RON" step={50} compact onChange={(n) => set(r.key, tier, i, n)} />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ───────────────────────── Timpi de lucru ───────────────────────── */

function TimesTab({ settings, update }: TabProps) {
  const sample = serviceBaseMin('colantare', settings)
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_320px]">
      <Card title="Factor de timp pe tip de caroserie">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {CAR_TYPES.map((t) => {
            const factor = settings.carTypeFactor?.[t.value] ?? t.defaultFactor
            return (
              <Field key={t.value} label={t.label} hint={`${Math.round((sample * factor) / 6) / 10} h la o colantare`}>
                <NumberBox
                  value={factor}
                  prefix="×"
                  step={0.05}
                  onChange={(v) =>
                    update({ carTypeFactor: { ...settings.carTypeFactor, [t.value]: Math.max(0.5, v || 1) } })
                  }
                />
              </Field>
            )
          })}
        </div>
      </Card>
      <Card title="Cum se estimează timpul">
        <ol className="flex list-decimal flex-col gap-2 pl-4 text-[12.5px] text-fg-mute">
          <li>Fiecare serviciu are o durată de bază (pe un sedan) — se setează în „Servicii & prețuri”.</li>
          <li>Se înmulțește cu factorul tipului de caroserie al mașinii.</li>
          <li>La mai multe servicii: cel mai lung + 85% din restul (echipa lucrează în paralel).</li>
          <li>Rezultatul se rotunjește la sfert de oră și e doar o propunere — se poate schimba pe programare.</li>
        </ol>
      </Card>
    </div>
  )
}

/* ───────────────────────── mici controale ───────────────────────── */

function NumberBox({
  value,
  onChange,
  suffix,
  prefix,
  step = 1,
  disabled,
  compact,
  title,
}: {
  value: number
  onChange: (v: number) => void
  suffix?: string
  prefix?: string
  step?: number
  disabled?: boolean
  compact?: boolean
  title?: string
}) {
  return (
    <label
      title={title}
      className={cx(
        'flex items-center rounded-lg border border-line-strong bg-ink-750 focus-within:border-brand-500/60',
        disabled && 'opacity-50',
        compact ? 'h-8' : 'h-9',
      )}
    >
      {prefix && <span className="pl-2.5 text-[12px] text-fg-faint">{prefix}</span>}
      <input
        type="number"
        step={step}
        min={0}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-w-0 flex-1 bg-transparent px-2.5 text-right font-mono text-[13px] outline-none disabled:cursor-not-allowed"
      />
      {suffix && <span className="pr-2.5 text-[11px] text-fg-faint">{suffix}</span>}
    </label>
  )
}

function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={cx('relative h-5 w-9 flex-none rounded-full transition', on ? 'bg-mint' : 'bg-black/15')}
    >
      <span
        className={cx(
          'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all',
          on ? 'left-[18px]' : 'left-0.5',
        )}
      />
    </button>
  )
}
