import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  TableWrap,
  Td,
  Th,
} from '@/components/ui'
import { useStore } from '@/data/store'
import {
  STOCK_PRESETS,
  knownLocations,
  knownSuppliers,
  nextRollNumber,
} from '@/data/stockPresets'
import type { StockCategory, StockItem } from '@/data/types'
import { fmtDateTime } from '@/lib/utils'
import { IconPlus, IconTrash } from '@/components/Icons'

const CATS: { key: StockCategory | 'toate'; label: string }[] = [
  { key: 'toate', label: 'Tot stocul' },
  { key: 'ppf', label: 'PPF' },
  { key: 'folie_color', label: 'Folie culoare' },
  { key: 'folie_geam', label: 'Folie geamuri' },
  { key: 'ceramica', label: 'Ceramice' },
  { key: 'consumabile', label: 'Consumabile' },
]

const catLabel = (c: StockCategory) => CATS.find((x) => x.key === c)?.label ?? c

const emptyItem = {
  category: 'ppf' as StockCategory,
  maker: '',
  name: '',
  rollNumber: '',
  finish: '' as StockItem['finish'],
  width: '1.52',
  unit: 'm' as StockItem['unit'],
  qty: '',
  minQty: '10',
  location: '',
}

export default function StockPage() {
  const { stock, moves, jobs, addStockItem, removeStockItem, adjustStock, toast } = useStore()
  const [cat, setCat] = useState<StockCategory | 'toate'>('toate')
  const [q, setQ] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [form, setForm] = useState(emptyItem)
  const [presetKey, setPresetKey] = useState('')
  /** furnizor scris de mână, în afara listei */
  const [otherMaker, setOtherMaker] = useState(false)
  const [adjust, setAdjust] = useState<{ item: StockItem; sign: 1 | -1 } | null>(null)
  const [adjustQty, setAdjustQty] = useState('')
  const [adjustReason, setAdjustReason] = useState('')

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return stock
      .filter((i) => (cat === 'toate' ? true : i.category === cat))
      .filter((i) =>
        !s ? true : [i.name, i.maker, i.rollNumber, i.location].join(' ').toLowerCase().includes(s),
      )
  }, [stock, cat, q])

  const low = stock.filter((s) => s.qty <= s.minQty)

  const suppliers = knownSuppliers(form.category, stock)
  const locations = knownLocations(stock)
  const presets = STOCK_PRESETS.filter((p) => p.category === form.category)

  const openNew = () => {
    const category: StockCategory = cat === 'toate' ? 'ppf' : cat
    setForm({ ...emptyItem, category, rollNumber: nextRollNumber(category, stock) })
    setPresetKey('')
    setOtherMaker(false)
    setNewOpen(true)
  }

  /** Un click pe produs uzual completează tot: furnizor, denumire, lățime, finisaj, prag, raft. */
  const applyPreset = (label: string) => {
    setPresetKey(label)
    const p = STOCK_PRESETS.find((x) => x.label === label)
    if (!p) return
    setOtherMaker(false)
    setForm((f) => ({
      ...f,
      category: p.category,
      maker: p.maker,
      name: p.name,
      finish: p.finish,
      width: p.width,
      unit: p.unit,
      minQty: String(p.minQty),
      location: p.location,
      rollNumber: nextRollNumber(p.category, stock),
    }))
  }

  const changeCategory = (category: StockCategory) => {
    setPresetKey('')
    setForm((f) => ({
      ...f,
      category,
      unit: category === 'ceramica' || category === 'consumabile' ? 'buc' : 'm',
      width: category === 'ceramica' || category === 'consumabile' ? '' : f.width || '1.52',
      rollNumber: nextRollNumber(category, stock),
    }))
  }

  const saveItem = () => {
    if (!form.name.trim()) return
    addStockItem({
      ...form,
      qty: Number(form.qty || 0),
      minQty: Number(form.minQty || 0),
    })
    toast('Produs adăugat în stoc')
    setForm(emptyItem)
    setPresetKey('')
    setNewOpen(false)
  }

  const applyAdjust = () => {
    if (!adjust || !adjustQty) return
    adjustStock(
      adjust.item.id,
      adjust.sign * Number(adjustQty),
      adjustReason || (adjust.sign > 0 ? 'Recepție marfă' : 'Consum manual'),
    )
    toast(`${adjust.sign > 0 ? 'Adăugat' : 'Scăzut'} ${adjustQty}${adjust.item.unit}`)
    setAdjust(null)
    setAdjustQty('')
    setAdjustReason('')
  }

  return (
    <>
      <PageHeader
        title="Stoc"
        subtitle={`${stock.length} produse · ${low.length} sub prag`}
        action={
          <Button variant="primary" onClick={openNew}>
            <IconPlus width={16} height={16} /> Adaugă produs
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {CATS.map((c) => (
          <Chip key={c.key} active={cat === c.key} onClick={() => setCat(c.key)}>
            {c.label}
          </Chip>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Caută produs, rolă…"
          className="ml-auto w-60 rounded-lg border border-line-strong bg-ink-750 px-3 py-1.5 text-[13px] outline-none focus:border-brand-500/60"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_330px]">
        <Card pad={false}>
          {list.length === 0 ? (
            <EmptyState text="Niciun produs." />
          ) : (
            <TableWrap>
              <thead className="border-b border-line">
                <tr>
                  <Th>Produs</Th>
                  <Th>Categorie</Th>
                  <Th>Rolă / lot</Th>
                  <Th>Stoc</Th>
                  <Th>Stare</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {list.map((i) => (
                  <tr key={i.id} className="border-b border-line/70 last:border-0 hover:bg-black/[0.035]">
                    <Td>
                      <div className="font-semibold">{i.name}</div>
                      <div className="font-mono text-[11px] text-fg-faint">
                        {i.maker}
                        {i.width && ` · ${i.width}m`}
                        {i.location && ` · ${i.location}`}
                      </div>
                    </Td>
                    <Td className="text-fg-mute">{catLabel(i.category)}</Td>
                    <Td className="font-mono text-brand-400">#{i.rollNumber || '—'}</Td>
                    <Td className="font-mono font-bold">
                      {i.qty} {i.unit}
                    </Td>
                    <Td>
                      {i.qty <= 0 ? (
                        <Badge tone="rose">epuizat</Badge>
                      ) : i.qty <= i.minQty ? (
                        <Badge tone="ember">sub prag ({i.minQty})</Badge>
                      ) : (
                        <Badge tone="mint">ok</Badge>
                      )}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="subtle"
                          onClick={() => setAdjust({ item: i, sign: 1 })}
                        >
                          ＋
                        </Button>
                        <Button
                          size="sm"
                          variant="subtle"
                          onClick={() => setAdjust({ item: i, sign: -1 })}
                        >
                          －
                        </Button>
                        <button
                          onClick={() => {
                            if (confirm(`Ștergi ${i.name}?`)) removeStockItem(i.id)
                          }}
                          className="ml-1 text-fg-faint hover:text-rose"
                        >
                          <IconTrash width={15} height={15} />
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>

        <Card title="Mișcări recente" pad={false}>
          {moves.length === 0 ? (
            <EmptyState text="Nicio mișcare." />
          ) : (
            <ul className="divide-y divide-line">
              {moves.slice(0, 12).map((m) => {
                const item = stock.find((s) => s.id === m.stockItemId)
                const job = jobs.find((j) => j.id === m.jobId)
                return (
                  <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold">
                        {item?.name ?? 'produs șters'}
                      </div>
                      <div className="truncate font-mono text-[11px] text-fg-faint">
                        {m.reason}
                        {job && ` · ${job.code}`} · {fmtDateTime(m.at)}
                      </div>
                    </div>
                    <span
                      className={`font-mono text-[13px] font-bold ${m.delta < 0 ? 'text-ember' : 'text-mint'}`}
                    >
                      {m.delta > 0 ? '+' : ''}
                      {m.delta}
                      {item?.unit}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* modal produs nou */}
      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="Produs nou în stoc"
        subtitle="Rolele se identifică prin număr — se preiau automat în fișa mașinii."
        width="max-w-xl"
        footer={
          <>
            <Button onClick={() => setNewOpen(false)}>Anulează</Button>
            <Button variant="primary" onClick={saveItem}>
              Adaugă produs
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Categorie"
            hint="Schimbă unitatea și sugestia de număr de rolă."
          >
            <Select
              value={form.category}
              onChange={(e) => changeCategory(e.target.value as StockCategory)}
            >
              {CATS.filter((c) => c.key !== 'toate').map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Produs uzual" hint="Completează automat restul câmpurilor.">
            <Select value={presetKey} onChange={(e) => applyPreset(e.target.value)}>
              <option value="">— completez manual —</option>
              {presets.map((p) => (
                <option key={p.label} value={p.label}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Furnizor / producător">
            {otherMaker ? (
              <div className="flex gap-2">
                <Input
                  autoFocus
                  value={form.maker}
                  placeholder="Nume furnizor"
                  onChange={(e) => setForm((f) => ({ ...f, maker: e.target.value }))}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    setOtherMaker(false)
                    setForm((f) => ({ ...f, maker: '' }))
                  }}
                >
                  listă
                </Button>
              </div>
            ) : (
              <Select
                value={suppliers.includes(form.maker) ? form.maker : ''}
                onChange={(e) => {
                  if (e.target.value === '__other') {
                    setOtherMaker(true)
                    setForm((f) => ({ ...f, maker: '' }))
                  } else setForm((f) => ({ ...f, maker: e.target.value }))
                }}
              >
                <option value="">— alege —</option>
                {suppliers.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
                <option value="__other">Alt furnizor…</option>
              </Select>
            )}
          </Field>

          <Field label="Denumire produs" required className="sm:col-span-2">
            <Input
              list="stock-names"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="PPF transparentă lucioasă / Satin Dark Grey"
            />
            <datalist id="stock-names">
              {presets.map((p) => (
                <option key={p.label} value={p.name} />
              ))}
            </datalist>
          </Field>

          <Field label="Număr rolă / lot" hint="Sugerat automat, următorul liber din categorie.">
            <div className="flex gap-2">
              <Input
                value={form.rollNumber}
                onChange={(e) => setForm((f) => ({ ...f, rollNumber: e.target.value }))}
                placeholder="R-12"
              />
              <Button
                size="sm"
                onClick={() =>
                  setForm((f) => ({ ...f, rollNumber: nextRollNumber(f.category, stock) }))
                }
              >
                sugerează
              </Button>
            </div>
          </Field>
          <Field label="Lățime (m)">
            <Input value={form.width} onChange={(e) => setForm((f) => ({ ...f, width: e.target.value }))} />
          </Field>
          <Field label="Finisaj">
            <Select
              value={form.finish}
              onChange={(e) => setForm((f) => ({ ...f, finish: e.target.value as StockItem['finish'] }))}
            >
              <option value="">—</option>
              <option value="lucioasa">Lucioasă</option>
              <option value="mata">Mată</option>
            </Select>
          </Field>
          <Field label="Unitate">
            <Select
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value as StockItem['unit'] }))}
            >
              <option value="m">metri</option>
              <option value="buc">bucăți</option>
            </Select>
          </Field>
          <Field label="Cantitate inițială">
            <Input
              type="number"
              value={form.qty}
              onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
            />
          </Field>
          <Field label="Prag alertă">
            <Input
              type="number"
              value={form.minQty}
              onChange={(e) => setForm((f) => ({ ...f, minQty: e.target.value }))}
            />
          </Field>
          <Field label="Locație" className="sm:col-span-2" hint="Rafturile deja folosite apar în listă.">
            <Input
              list="stock-locations"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="Raft A1"
            />
            <datalist id="stock-locations">
              {locations.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </Field>
        </div>
      </Modal>

      {/* modal ajustare */}
      <Modal
        open={!!adjust}
        onClose={() => setAdjust(null)}
        title={adjust?.sign === 1 ? 'Adaugă în stoc' : 'Scade din stoc'}
        subtitle={adjust ? `${adjust.item.maker} ${adjust.item.name} · rola #${adjust.item.rollNumber}` : ''}
        footer={
          <>
            <Button onClick={() => setAdjust(null)}>Anulează</Button>
            <Button variant="primary" onClick={applyAdjust}>
              Confirmă
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label={`Cantitate (${adjust?.item.unit ?? ''})`} required>
            <Input type="number" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} />
          </Field>
          <Field label="Motiv">
            <Input
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder={adjust?.sign === 1 ? 'Recepție marfă' : 'Consum / rebut'}
            />
          </Field>
          {adjust && (
            <p className="text-[13px] text-fg-mute">
              Stoc curent {adjust.item.qty}
              {adjust.item.unit} →{' '}
              <span className="font-mono font-bold text-brand-400">
                {Math.max(0, adjust.item.qty + adjust.sign * Number(adjustQty || 0))}
                {adjust.item.unit}
              </span>
            </p>
          )}
        </div>
      </Modal>
    </>
  )
}
