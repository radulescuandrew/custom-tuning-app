import { useState } from 'react'
import { Button, Input, Modal, Select } from '@/components/ui'
import { rollFields, serviceDef, serviceLabel } from '@/data/serviceCatalog'
import type { Job, ServiceEntry, StockCategory, StockItem } from '@/data/types'
import { uid } from '@/lib/utils'

const CATEGORY_LABEL: Partial<Record<StockCategory, string>> = {
  ppf: 'PPF',
  folie_color: 'Folie de culoare',
  folie_geam: 'Folie geamuri',
}

type Row = { id: string; stockItemId: string; qty: string }

/** Rândurile de pornire: consumurile încă nescăzute; altfel rola din fișă + metrii completați. */
const initialRows = (svc: ServiceEntry): Row[] => {
  const pending = svc.rollUsages.filter((u) => !u.appliedAt)
  if (pending.length)
    return pending.map((u) => ({ id: u.id, stockItemId: u.stockItemId, qty: String(u.qty || '') }))
  if (svc.rollUsages.some((u) => u.appliedAt)) return []
  const fromSheet = rollFields(svc.kind)
    .map((f) => svc.values[f.key])
    .find(Boolean)
  return [{ id: uid(), stockItemId: fromSheet ?? '', qty: svc.values.metersUsed ?? '' }]
}

/**
 * Oferta: la „Finalizat”, pentru lucrările cu folie, apare „Adaugă numărul rolei și numărul de
 * metri folosiți”. Se pot adăuga mai multe role pe același serviciu (ex. PPF + culoare).
 * Se montează doar cât e deschis, deci pornește mereu din datele curente ale lucrării.
 */
export default function FinishFoilModal({
  job,
  stock,
  onClose,
  onFinish,
}: {
  job: Job
  stock: StockItem[]
  onClose: () => void
  /** services = fișele actualizate cu consumul (null = finalizare fără consum) */
  onFinish: (services: ServiceEntry[] | null) => void
}) {
  const foil = job.services.filter((s) => rollFields(s.kind).length > 0)
  const [rows, setRows] = useState<Record<string, Row[]>>(() =>
    Object.fromEntries(foil.map((s) => [s.id, initialRows(s)])),
  )

  const patchRow = (sid: string, rid: string, patch: Partial<Row>) =>
    setRows((r) => ({ ...r, [sid]: r[sid].map((x) => (x.id === rid ? { ...x, ...patch } : x)) }))
  const addRow = (sid: string) =>
    setRows((r) => ({ ...r, [sid]: [...r[sid], { id: uid(), stockItemId: '', qty: '' }] }))
  const removeRow = (sid: string, rid: string) =>
    setRows((r) => ({ ...r, [sid]: r[sid].filter((x) => x.id !== rid) }))

  const valid = (x: Row) => x.stockItemId && Number(x.qty) > 0
  const totalNew = Object.values(rows).flat().filter(valid).length

  const confirm = () => {
    const services = job.services.map((svc) => {
      if (!rows[svc.id]) return svc
      const applied = svc.rollUsages.filter((u) => u.appliedAt)
      const fresh = rows[svc.id].filter(valid).map((x) => ({
        id: x.id,
        stockItemId: x.stockItemId,
        qty: Number(x.qty),
        appliedAt: null,
      }))
      const usages = [...applied, ...fresh]
      const values = { ...svc.values }
      // câmpurile din fișă reflectă ce s-a consumat: rola pe categorie + totalul de metri
      rollFields(svc.kind).forEach((f) => {
        if (values[f.key]) return
        const first = usages.find(
          (u) => stock.find((it) => it.id === u.stockItemId)?.category === f.stockCategory,
        )
        if (first) values[f.key] = first.stockItemId
      })
      const meters = usages.reduce((sum, u) => sum + u.qty, 0)
      if (meters > 0) values.metersUsed = String(meters)
      return { ...svc, values, rollUsages: usages }
    })
    onFinish(services)
  }

  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-2xl"
      title="Adaugă numărul rolei și numărul de metri folosiți"
      subtitle={`${job.code} · se scad din stoc la finalizare`}
      footer={
        <>
          <Button onClick={() => onFinish(null)}>Finalizează fără consum</Button>
          <Button variant="primary" disabled={totalNew === 0} onClick={confirm}>
            Finalizează și scade din stoc
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {foil.map((svc) => {
          const def = serviceDef(svc.kind)
          const cats = rollFields(svc.kind).map((f) => f.stockCategory!)
          const applied = svc.rollUsages.filter((u) => u.appliedAt)
          const els = svc.elements.filter((e) => e.checked).length
          return (
            <section key={svc.id}>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: def.accent }} />
                <span className="text-sm font-semibold">{serviceLabel(svc)}</span>
                {els > 0 && <span className="text-[12px] text-fg-faint">· {els} elemente</span>}
              </div>

              {applied.map((u) => {
                const it = stock.find((s) => s.id === u.stockItemId)
                return (
                  <div
                    key={u.id}
                    className="mb-2 flex items-center justify-between rounded-lg border border-line bg-ink-750/60 px-3 py-2 text-[12.5px] text-fg-mute"
                  >
                    <span>
                      {it?.maker} {it?.name} · rola #{it?.rollNumber}
                    </span>
                    <span className="font-mono">
                      {u.qty}
                      {it?.unit} · deja scăzut
                    </span>
                  </div>
                )
              })}

              <div className="flex flex-col gap-2">
                {rows[svc.id].map((x) => {
                  const it = stock.find((s) => s.id === x.stockItemId)
                  const over = it && Number(x.qty) > it.qty
                  return (
                    <div key={x.id}>
                      <div className="flex items-center gap-2">
                        <Select
                          className="min-w-0 flex-1"
                          value={x.stockItemId}
                          onChange={(e) => patchRow(svc.id, x.id, { stockItemId: e.target.value })}
                        >
                          <option value="">— alege rola —</option>
                          {cats.map((c) => (
                            <optgroup key={c} label={CATEGORY_LABEL[c] ?? c}>
                              {stock
                                .filter((s) => s.category === c && (s.qty > 0 || s.id === x.stockItemId))
                                .map((s) => (
                                  <option key={s.id} value={s.id}>
                                    #{s.rollNumber} · {s.maker} {s.name} · {s.qty}
                                    {s.unit} rămas
                                  </option>
                                ))}
                            </optgroup>
                          ))}
                        </Select>
                        <div className="relative w-28 flex-none">
                          <Input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step={0.5}
                            placeholder="metri"
                            value={x.qty}
                            onChange={(e) => patchRow(svc.id, x.id, { qty: e.target.value })}
                            className="pr-8"
                          />
                          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[12px] text-fg-faint">
                            m
                          </span>
                        </div>
                        <button
                          onClick={() => removeRow(svc.id, x.id)}
                          aria-label="Șterge rândul"
                          className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-fg-faint transition hover:bg-black/[0.05] hover:text-rose"
                        >
                          ×
                        </button>
                      </div>
                      {over && (
                        <p className="mt-1 text-[11.5px] text-ember">
                          Depășește stocul rolei ({it.qty}
                          {it.unit} rămași) — stocul va ajunge negativ.
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>

              <button
                onClick={() => addRow(svc.id)}
                className="mt-2 text-[13px] font-semibold text-brand-500 hover:underline"
              >
                + încă o rolă
              </button>
            </section>
          )
        })}
      </div>
    </Modal>
  )
}
