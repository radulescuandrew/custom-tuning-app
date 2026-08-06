import { useMemo, useState } from 'react'
import type { ElementEntry, ServiceEntry, StockItem } from '@/data/types'
import { BODY_ELEMENTS, serviceDef, type FieldDef } from '@/data/serviceCatalog'
import { Badge, Button, Field, Input, Select, Textarea } from './ui'
import { IconPlus, IconTrash } from './Icons'
import { cx, uid } from '@/lib/utils'
import { useSettings } from '@/data/store'
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
}

export default function ServiceForm({ entry, stock, onChange }: Props) {
  const def = serviceDef(entry.kind)
  const settings = useSettings()
  const [extra, setExtra] = useState('')

  const setValue = (key: string, v: string) =>
    onChange({ values: { ...entry.values, [key]: v } })

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
  const selectedRolls = rollFields
    .map((f) => ({ field: f, item: stock.find((s) => s.id === entry.values[f.key]) }))
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

  const visible = (f: FieldDef) =>
    !f.showIf || f.showIf.equals.includes(entry.values[f.showIf.key] ?? '')

  const renderField = (f: FieldDef) => {
    const value = entry.values[f.key] ?? ''
    if (f.type === 'roll') {
      const opts = stock.filter((s) => s.category === f.stockCategory)
      return (
        <Field key={f.key} label={f.label} hint="Numărul rolei se preia automat în fișă și în consum.">
          <Select value={value} onChange={(e) => setValue(f.key, e.target.value)}>
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
      {def.groups.map((g) => (
        <div key={g.title}>
          <div className="mono-label mb-3 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: def.accent }} />
            {g.title}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{g.fields.filter(visible).map(renderField)}</div>
        </div>
      ))}

      {selectedRolls.length > 0 && (
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
            onChange={(e) => onChange({ price: Number(e.target.value) })}
          />
        </Field>
      </div>
    </div>
  )
}
