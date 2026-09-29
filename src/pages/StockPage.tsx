import { useEffect, useMemo, useState } from 'react'
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
} from '@/components/ui'
import { type Column, DataList } from '@/components/ui/DataList'
import { Sheet } from '@/components/ui/Sheet'
import { Stepper } from '@/components/ui/Stepper'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { useStore } from '@/data/store'
import {
  STOCK_PRESETS,
  knownLocations,
  knownSuppliers,
  nextRollNumber,
} from '@/data/stockPresets'
import type { StockCategory, StockItem } from '@/data/types'
import { cx, fmtDateTime } from '@/lib/utils'
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
  const isDesktop = useIsDesktop()
  const { stock, moves, jobs, addStockItem, removeStockItem, adjustStock, toast } = useStore()
  const [cat, setCat] = useState<StockCategory | 'toate'>('toate')
  const [q, setQ] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [form, setForm] = useState(emptyItem)
  const [presetKey, setPresetKey] = useState('')
  /** detaliile (furnizor, rolă, lățime…) stau pliate: de obicei totul e în denumire sau în preset */
  const [detailsOpen, setDetailsOpen] = useState(false)
  /** furnizor scris de mână, în afara listei */
  const [otherMaker, setOtherMaker] = useState(false)
  const [adjust, setAdjust] = useState<{ item: StockItem; sign: 1 | -1 } | null>(null)
  const [adjustQty, setAdjustQty] = useState('')
  const [adjustReason, setAdjustReason] = useState('')

  /** Pe telefon nu se ajustează cu +/− dintr-un rând de tabel: se atinge cardul și se corectează
   *  cantitatea finală într-un sheet. `adjustStock` primește tot o diferență. */
  const [sheetItem, setSheetItem] = useState<StockItem | null>(null)
  const [sheetQty, setSheetQty] = useState(0)
  const [sheetReason, setSheetReason] = useState('')

  useEffect(() => {
    if (!sheetItem) return
    setSheetQty(sheetItem.qty)
    setSheetReason('')
  }, [sheetItem])

  /** Rolele se măsoară în metri, deci pasul de un metru e prea grosier. */
  const stepFor = (i: StockItem) => (i.unit === 'm' ? 0.5 : 1)

  const saveSheet = () => {
    if (!sheetItem) return
    const delta = Number((sheetQty - sheetItem.qty).toFixed(2))
    if (delta === 0) return setSheetItem(null)
    adjustStock(
      sheetItem.id,
      delta,
      sheetReason.trim() || (delta > 0 ? 'Recepție marfă' : 'Consum manual'),
    )
    toast(`${delta > 0 ? 'Adăugat' : 'Scăzut'} ${Math.abs(delta)}${sheetItem.unit}`)
    setSheetItem(null)
  }

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
    setDetailsOpen(false)
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

  const stateBadge = (i: StockItem) =>
    i.qty <= 0 ? (
      <Badge tone="rose">epuizat</Badge>
    ) : i.qty <= i.minQty ? (
      <Badge tone="ember">sub prag ({i.minQty})</Badge>
    ) : (
      <Badge tone="mint">ok</Badge>
    )

  const columns: Column<StockItem>[] = [
    {
      key: 'produs',
      header: 'Produs',
      cell: (i) => (
        <>
          <div className="font-semibold">{i.name}</div>
          <div className="font-mono text-[11px] text-fg-faint">
            {i.maker}
            {i.width && ` · ${i.width}m`}
            {i.location && ` · ${i.location}`}
          </div>
        </>
      ),
    },
    { key: 'cat', header: 'Categorie', cell: (i) => catLabel(i.category), className: 'text-fg-mute' },
    {
      key: 'rola',
      header: 'Rolă / lot',
      cell: (i) => `#${i.rollNumber || '—'}`,
      className: 'font-mono text-brand-400',
    },
    {
      key: 'stoc',
      header: 'Stoc',
      cell: (i) => `${i.qty} ${i.unit}`,
      className: 'font-mono font-bold',
    },
    { key: 'stare', header: 'Stare', cell: stateBadge },
    {
      key: 'actiuni',
      header: '',
      cell: (i) => (
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="subtle" onClick={() => setAdjust({ item: i, sign: 1 })}>
            ＋
          </Button>
          <Button size="sm" variant="subtle" onClick={() => setAdjust({ item: i, sign: -1 })}>
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
      ),
    },
  ]

  const renderCard = (i: StockItem) => (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-bold">{i.name}</div>
        <div className="truncate font-mono text-[11px] text-fg-faint">
          {i.maker} · #{i.rollNumber || '—'}
        </div>
        <div className="mt-1.5 truncate font-mono text-[11px] text-fg-mute">
          {[catLabel(i.category), i.width && `${i.width}m`, i.finish, i.location]
            .filter(Boolean)
            .join(' · ')}
        </div>
      </div>
      <div className="flex flex-none flex-col items-end gap-1">
        <span
          className={cx(
            'font-mono text-[20px] leading-none font-bold',
            i.qty <= 0 ? 'text-rose' : i.qty <= i.minQty ? 'text-ember' : 'text-fg',
          )}
        >
          {i.qty}
          <span className="ml-0.5 text-[12px]">{i.unit}</span>
        </span>
        {i.qty <= i.minQty && stateBadge(i)}
      </div>
    </div>
  )

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
          className="w-full rounded-lg border border-line-strong bg-ink-750 px-3 py-2 text-[16px] outline-none focus:border-brand-500/60 md:ml-auto md:w-60 md:py-1.5 md:text-[13px]"
        />
      </div>

      {/* grid-cols-1 = minmax(0,1fr); fără el coloana implicită `auto` se lățește după conținut */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_330px]">
        {isDesktop ? (
          <Card pad={false}>
            <DataList
              items={list}
              getKey={(i) => i.id}
              columns={columns}
              renderCard={renderCard}
              empty="Niciun produs."
            />
          </Card>
        ) : (
          <DataList
            items={list}
            getKey={(i) => i.id}
            columns={columns}
            renderCard={renderCard}
            onRowClick={setSheetItem}
            empty="Niciun produs."
          />
        )}

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

          <Field label="Denumire produs" required>
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
          <Field label={`Cantitate inițială (${form.unit})`}>
            <Input
              type="number"
              value={form.qty}
              onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
            />
          </Field>
        </div>

        {/* restul câmpurilor stau pliate: de obicei totul e în denumire sau vine din preset */}
        <button
          onClick={() => setDetailsOpen((v) => !v)}
          className="mt-4 flex w-full items-center gap-2 rounded-lg border border-line px-3 py-2.5 text-left text-[13px] font-semibold text-fg-mute hover:text-fg"
        >
          <span className={cx('transition-transform', detailsOpen && 'rotate-90')}>▸</span>
          Detalii
          {!detailsOpen && (
            <span className="min-w-0 flex-1 truncate text-right font-mono text-[11px] font-normal text-fg-faint">
              {[
                form.rollNumber && `#${form.rollNumber}`,
                form.maker,
                form.width && `${form.width}m`,
                form.finish === 'lucioasa' ? 'lucioasă' : form.finish === 'mata' ? 'mată' : '',
                form.minQty && `prag ${form.minQty}`,
                form.location,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
        </button>

        {detailsOpen && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        )}
      </Modal>

      {/* ajustare pe telefon: cantitatea finală, nu o diferență de calculat în cap */}
      <Sheet
        open={!!sheetItem}
        onClose={() => setSheetItem(null)}
        title={sheetItem?.name}
        subtitle={
          sheetItem
            ? `${sheetItem.maker} · #${sheetItem.rollNumber || '—'} · în stoc ${sheetItem.qty}${sheetItem.unit}`
            : undefined
        }
        footer={
          <>
            <Button className="min-h-[44px] flex-1" onClick={() => setSheetItem(null)}>
              Anulează
            </Button>
            <Button variant="primary" className="min-h-[44px] flex-1" onClick={saveSheet}>
              Salvează
            </Button>
          </>
        }
      >
        {sheetItem && (
          <div className="space-y-4">
            <div>
              <span className="mono-label">Cantitate în stoc ({sheetItem.unit})</span>
              <div className="mt-1.5">
                <Stepper
                  value={sheetQty}
                  onChange={setSheetQty}
                  step={stepFor(sheetItem)}
                  min={0}
                  unit={sheetItem.unit}
                />
              </div>
            </div>

            <p className="text-[13px] text-fg-mute">
              {sheetQty === sheetItem.qty ? (
                'Nicio schimbare.'
              ) : (
                <>
                  {sheetItem.qty}
                  {sheetItem.unit} →{' '}
                  <span className="font-mono font-bold text-brand-400">
                    {sheetQty}
                    {sheetItem.unit}
                  </span>{' '}
                  <span
                    className={cx(
                      'font-mono font-bold',
                      sheetQty > sheetItem.qty ? 'text-mint' : 'text-ember',
                    )}
                  >
                    ({sheetQty > sheetItem.qty ? '+' : ''}
                    {Number((sheetQty - sheetItem.qty).toFixed(2))})
                  </span>
                </>
              )}
            </p>

            <label className="block">
              <span className="mono-label">Motiv</span>
              <input
                value={sheetReason}
                onChange={(e) => setSheetReason(e.target.value)}
                placeholder={sheetQty >= sheetItem.qty ? 'Recepție marfă' : 'Consum / rebut'}
                className="mt-1.5 w-full rounded-lg border border-line-strong bg-ink-750 px-3 py-2.5 text-[16px] outline-none placeholder:text-fg-faint focus:border-brand-500/60"
              />
            </label>

            <button
              onClick={() => {
                if (!confirm(`Ștergi ${sheetItem.name}?`)) return
                removeStockItem(sheetItem.id)
                setSheetItem(null)
              }}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-line text-[14px] font-semibold text-rose"
            >
              <IconTrash width={15} height={15} /> Șterge produsul
            </button>
          </div>
        )}
      </Sheet>

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
        <div className="grid grid-cols-1 gap-4">
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
