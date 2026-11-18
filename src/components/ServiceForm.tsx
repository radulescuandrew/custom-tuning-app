import { useMemo, useState } from 'react'
import type { CarBodyType, CarClass, ElementEntry, ServiceEntry, StockItem } from '@/data/types'
import {
  BODY_ELEMENTS,
  carClassLabel,
  estimateFoilMeters,
  gridPrice,
  serviceDef,
  type FieldDef,
} from '@/data/serviceCatalog'
import { Badge, Button, Field, Input, Select, Textarea } from './ui'
import { SegmentedControl } from './ui/SegmentedControl'
import { IconPlus, IconTrash } from './Icons'
import { cx, uid } from '@/lib/utils'
import { useSettings } from '@/data/store'
import { ceramicUses } from '@/data/ceramics'
import { amounts, fmtRon, priceFieldLabel } from '@/lib/money'
import type { Settings } from '@/data/types'

/** Arată cealaltă față a prețului: dacă e cu TVA, cât e baza; dacă e fără, cât iese cu TVA. */
const priceHint = (s: Settings, price: number) => {
  if (!s.vatPayer || !price) return undefined
  const a = amounts(price, s)
  return s.pricesIncludeVat
    ? `Bază ${fmtRon(a.net)} + TVA ${fmtRon(a.vat)}`
    : `Cu TVA ${s.vatRate}%: ${fmtRon(a.gross)}`
}

interface Props {
  entry: ServiceEntry
  stock: StockItem[]
  onChange: (patch: Partial<ServiceEntry>) => void
  /** tipul caroseriei mașinii din programare — pentru estimarea consumului de folie */
  bodyType?: CarBodyType | ''
  /** clasa mașinii — alege coloana din grila de prețuri (detailing, ceramică) */
  carClass?: CarClass
  /**
   * booking = la crearea programării: fără rolă, metri și „Executat de” (nu se știu încă;
   * se completează în lucru / la finalizare). work = fișa din programare.
   */
  mode?: 'booking' | 'work'
}

export default function ServiceForm({
  entry,
  stock,
  onChange,
  bodyType,
  carClass = 'medie',
  mode = 'work',
}: Props) {
  const def = serviceDef(entry.kind)
  const settings = useSettings()
  const [extra, setExtra] = useState('')

  /** la detailing / ceramică prețul urmează grila, cât timp nu a fost scris de mână */
  const setValue = (key: string, v: string) => {
    const values = { ...entry.values, [key]: v }
    const grid = gridPrice(entry.kind, values, carClass, settings)
    onChange(grid !== null && !entry.priceManual ? { values, price: grid } : { values })
  }
  const grid = gridPrice(entry.kind, entry.values, carClass, settings)

  const elements: ElementEntry[] = useMemo(
    () =>
      entry.elements.length
        ? entry.elements
        : BODY_ELEMENTS.map((name) => ({ id: uid(), name, checked: false, code: '', note: '' })),
    [entry.elements],
  )

  const setElement = (id: string, patch: Partial<ElementEntry>) =>
    onChange({ elements: elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) })

  const rollFields = def.groups.flatMap((g) => g.fields).filter((f) => f.type === 'roll')
  /** rolele din care se consumă: cea aleasă în fișă + orice altă rolă cu consum (ex. 15 m din R-04 + 5 m din R-05) */
  const selectedRolls = [
    ...new Set([
      ...rollFields.map((f) => entry.values[f.key]).filter(Boolean),
      ...entry.rollUsages.map((u) => u.stockItemId),
    ]),
  ]
    .map((rid) => ({ item: stock.find((s) => s.id === rid) }))
    .filter((r) => r.item)

  const usageFor = (stockItemId: string) =>
    entry.rollUsages.find((u) => u.stockItemId === stockItemId)

  const setUsage = (stockItemId: string, qty: number) => {
    const exists = usageFor(stockItemId)
    onChange({
      rollUsages: exists
        ? entry.rollUsages.map((u) => (u.stockItemId === stockItemId ? { ...u, qty } : u))
        : [...entry.rollUsages, { id: uid(), stockItemId, qty, appliedAt: null }],
    })
  }

  /** câmpuri care se știu abia în timpul lucrului */
  const workOnly = (f: FieldDef) => f.type === 'roll' || f.key === 'metersUsed' || f.key === 'crew'
  const visible = (f: FieldDef) =>
    (!f.showIf || f.showIf.equals.includes(entry.values[f.showIf.key] ?? '')) &&
    !(mode === 'booking' && workOnly(f))
  /** metrii folosiți = totalul consumului pe role (o singură sursă, nu un câmp separat) */
  const metersFromRolls = Math.round(entry.rollUsages.reduce((sum, u) => sum + (u.qty || 0), 0) * 100) / 100

  /** Golește câmpurile grupurilor ascunse, altfel rămâne consum fantomă din rola cealaltă. */
  const switchVariant = (variantKey: string, value: string) => {
    const hidden = def.groups.filter((g) => g.variantKey === variantKey && g.variantValue !== value)
    const hiddenFields = hidden.flatMap((g) => g.fields)
    const hiddenRollIds = hiddenFields
      .filter((f) => f.type === 'roll')
      .map((f) => entry.values[f.key])
      .filter(Boolean)
    const values = { ...entry.values, [variantKey]: value }
    hiddenFields.forEach((f) => delete values[f.key])
    onChange({
      values,
      rollUsages: entry.rollUsages.filter((u) => !hiddenRollIds.includes(u.stockItemId)),
    })
  }

  const renderField = (f: FieldDef) => {
    const value = entry.values[f.key] ?? ''
    if (f.key === 'metersUsed') {
      const total = metersFromRolls || Number(value) || 0
      return (
        <Field key={f.key} label={f.label} hint="Totalul din consumul pe role — se confirmă la finalizare.">
          <div className="rounded-lg border border-line bg-ink-750/50 px-3 py-2.5 font-mono text-[14px] text-fg-dim">
            {total ? `${total} m` : '—'}
          </div>
        </Field>
      )
    }
    if (f.type === 'roll') {
      const opts = stock.filter(
        (s) => s.category === f.stockCategory && (s.qty > 0 || s.id === value),
      )
      const selected = stock.find((s) => s.id === value)
      /** Producătorul și finisajul vin din rolă — nu se mai completează de mână.
       *  La alegere se propune consumul estimat după caroserie; se corectează la final. */
      const pickRoll = (id: string) => {
        const values = { ...entry.values, [f.key]: id }
        let usages = entry.rollUsages
        if (value && value !== id)
          usages = usages.filter((u) => !(u.stockItemId === value && !u.appliedAt))
        const est = estimateFoilMeters(entry.kind, settings, bodyType)
        if (id && est && !usages.some((u) => u.stockItemId === id)) {
          usages = [...usages, { id: uid(), stockItemId: id, qty: est, appliedAt: null }]
          if (!values.metersUsed) values.metersUsed = String(est)
        }
        onChange({ values, rollUsages: usages })
      }
      return (
        <Field
          key={f.key}
          label={f.label}
          hint={
            selected
              ? [
                  selected.maker,
                  selected.name,
                  selected.finish === 'lucioasa' ? 'lucioasă' : selected.finish === 'mata' ? 'mată' : '',
                ]
                  .filter(Boolean)
                  .join(' · ')
              : 'Numărul rolei se preia automat în fișă și în consum.'
          }
        >
          <Select value={value} onChange={(e) => pickRoll(e.target.value)}>
            <option value="">— alege rola —</option>
            {opts.map((o) => (
              <option key={o.id} value={o.id}>
                {o.maker} {o.name} · rola #{o.rollNumber} · {o.qty}
                {o.unit} rămas
              </option>
            ))}
          </Select>
        </Field>
      )
    }
    if (f.type === 'select')
      return (
        <Field key={f.key} label={f.label}>
          <Select value={value} onChange={(e) => setValue(f.key, e.target.value)}>
            {(f.options ?? []).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
        </Field>
      )
    if (f.type === 'textarea')
      return (
        <Field key={f.key} label={f.label} className="sm:col-span-2">
          <Textarea value={value} onChange={(e) => setValue(f.key, e.target.value)} />
        </Field>
      )
    return (
      <Field key={f.key} label={f.label + (f.suffix ? ` (${f.suffix})` : '')}>
        <Input
          type={f.type === 'number' ? 'number' : 'text'}
          value={value}
          placeholder={f.placeholder}
          onChange={(e) => setValue(f.key, e.target.value)}
        />
      </Field>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {def.groups.map((g) => {
        if (g.variantKey) {
          const variants = def.groups.filter((x) => x.variantKey === g.variantKey)
          if (variants[0] !== g) return null
          const active = entry.values[g.variantKey] || variants[0].variantValue!
          const shown = variants.find((x) => x.variantValue === active) ?? variants[0]
          return (
            <div key={g.variantKey}>
              <SegmentedControl
                className="mb-4 max-w-sm"
                options={variants.map((v) => ({ value: v.variantValue!, label: v.title }))}
                value={active}
                onChange={(v) => switchVariant(g.variantKey!, v)}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {shown.fields.filter(visible).map(renderField)}
              </div>
            </div>
          )
        }
        if (!g.fields.some(visible)) return null
        return (
          <div key={g.title}>
            <div className="mono-label mb-3 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: def.accent }} />
              {g.title}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{g.fields.filter(visible).map(renderField)}</div>
          </div>
        )
      })}

      {mode === 'work' && entry.kind === 'ceramica' && ceramicUses(entry, stock).length > 0 && (
        <div>
          <div className="mono-label mb-3">Consum din stoc · la finalizare</div>
          <div className="overflow-hidden rounded-lg border border-line">
            {ceramicUses(entry, stock).map((u) => {
              const applied = u.item && entry.rollUsages.some((x) => x.stockItemId === u.item!.id && x.appliedAt)
              return (
                <div
                  key={u.product}
                  className="flex items-center gap-3 border-b border-line px-4 py-2.5 text-[13px] last:border-0"
                >
                  <span className="min-w-0 flex-1 font-semibold">{u.product}</span>
                  {u.item ? (
                    <span className="font-mono text-[11.5px] text-fg-mute">
                      lot #{u.item.rollNumber} · {u.item.qty} buc în stoc
                    </span>
                  ) : (
                    <Badge tone="ember">nu e în stoc</Badge>
                  )}
                  {applied ? <Badge tone="mint">scăzut</Badge> : u.item && <Badge tone="neutral">−1 buc</Badge>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {mode === 'work' && entry.kind !== 'ceramica' && selectedRolls.length > 0 && (
        <div>
          <div className="mono-label mb-3">Consum din stoc</div>
          <div className="overflow-hidden rounded-lg border border-line">
            {selectedRolls.map(({ item }) => {
              const u = usageFor(item!.id)
              const remaining = item!.qty - (u?.appliedAt ? 0 : (u?.qty ?? 0))
              return (
                <div
                  key={item!.id}
                  className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">
                      {item!.maker} {item!.name}
                    </div>
                    <div className="font-mono text-[11px] text-fg-faint">
                      rola #{item!.rollNumber} · stoc curent {item!.qty}
                      {item!.unit}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      className="w-24 py-1.5 text-center"
                      value={u?.qty ?? ''}
                      placeholder="0"
                      onChange={(e) => setUsage(item!.id, Number(e.target.value))}
                    />
                    <span className="font-mono text-[12px] text-fg-mute">{item!.unit}</span>
                  </div>
                  {u?.appliedAt ? (
                    <Badge tone="mint">scăzut din stoc</Badge>
                  ) : (
                    <Badge tone={remaining < 0 ? 'rose' : 'neutral'}>
                      rămâne {Math.round(remaining * 100) / 100}
                      {item!.unit}
                    </Badge>
                  )}
                </div>
              )
            })}
          </div>
          <p className="mt-2 text-[12px] text-fg-faint">
            Consumul propus e estimat după caroserie — corectează-l dacă au fost pierderi.
            Scăderea efectivă din stoc se face la trecerea lucrării în „Finalizat”.
          </p>
        </div>
      )}

      {def.elements && (
        <div>
          <div className="mono-label mb-3 flex items-center justify-between">
            <span>Elemente lucrate · cod produs / cod folie</span>
            <button
              className="font-mono text-[11px] text-brand-400 hover:text-brand-500"
              onClick={() =>
                onChange({
                  elements: elements.map((e) => ({ ...e, checked: !elements.every((x) => x.checked) })),
                })
              }
            >
              {elements.every((e) => e.checked) ? 'deselectează tot' : 'selectează tot'}
            </button>
          </div>
          <div className="overflow-hidden rounded-lg border border-line">
            {elements.map((el) => (
              <div
                key={el.id}
                className={cx(
                  'flex flex-wrap items-center gap-3 border-b border-line px-3 py-2 last:border-0',
                  el.checked && 'bg-brand-500/5',
                )}
              >
                <label className="flex min-w-[190px] flex-1 cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={el.checked}
                    onChange={(e) => setElement(el.id, { checked: e.target.checked })}
                    className="h-4 w-4 accent-[#e02a2a]"
                  />
                  <span className={cx('text-sm', el.checked ? 'font-semibold' : 'text-fg-mute')}>
                    {el.name}
                  </span>
                </label>
                <Input
                  className="w-40 py-1.5 text-[13px]"
                  placeholder="cod produs"
                  value={el.code}
                  onChange={(e) => setElement(el.id, { code: e.target.value })}
                  disabled={!el.checked}
                />
                <Input
                  className="w-52 py-1.5 text-[13px]"
                  placeholder="observații"
                  value={el.note}
                  onChange={(e) => setElement(el.id, { note: e.target.value })}
                  disabled={!el.checked}
                />
                {!BODY_ELEMENTS.includes(el.name) && (
                  <button
                    onClick={() => onChange({ elements: elements.filter((x) => x.id !== el.id) })}
                    className="text-fg-faint hover:text-rose"
                  >
                    <IconTrash width={15} height={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Input
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="alt element (ex. Prag lateral carbon)"
              className="max-w-xs py-1.5 text-[13px]"
            />
            <Button
              size="sm"
              onClick={() => {
                if (!extra.trim()) return
                onChange({
                  elements: [
                    ...elements,
                    { id: uid(), name: extra.trim(), checked: true, code: '', note: '' },
                  ],
                })
                setExtra('')
              }}
            >
              <IconPlus width={14} height={14} /> Adaugă
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={priceFieldLabel(settings)} hint={priceHint(settings, entry.price)}>
          <Input
            type="number"
            value={entry.price || ''}
            placeholder={entry.kind === 'custom' ? 'preț stabilit cu clientul' : undefined}
            onChange={(e) => onChange({ price: Number(e.target.value), priceManual: true })}
          />
        </Field>
        {grid !== null && (
          <div className="flex flex-col justify-center gap-1 rounded-lg border border-line bg-ink-750/60 px-3 py-2 text-[12.5px]">
            <span className="text-fg-mute">
              Grilă clasă <strong className="text-fg">{carClassLabel(carClass)}</strong>:{' '}
              <strong className="font-mono text-fg">{fmtRon(grid)}</strong>
            </span>
            {grid !== entry.price ? (
              <button
                onClick={() => onChange({ price: grid, priceManual: false })}
                className="self-start text-[12.5px] font-semibold text-brand-500 hover:underline"
              >
                aplică prețul din grilă
              </button>
            ) : (
              <span className="text-[11.5px] text-fg-faint">prețul urmează grila</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
