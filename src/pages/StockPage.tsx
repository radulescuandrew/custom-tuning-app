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
import { Stepper } from '@/components/ui/Stepper'
import { useStore } from '@/data/store'
import {
  STOCK_PRESETS,
  knownLocations,
  knownSuppliers,
  nextRollNumber,
} from '@/data/stockPresets'
import type { StockCategory, StockItem } from '@/data/types'
import { cx, fmtDateTime } from '@/lib/utils'
import {
  type StockGroup,
  defaultRollLength,
  groupStock,
  incRollNumber,
  isRollCategory,
  rollLength,
  rollSummary,
} from '@/lib/stockGroups'

type SortKey = 'implicit' | 'cant_desc' | 'cant_asc' | 'nume'
import { IconPlus, IconTrash } from '@/components/Icons'

const CATS: { key: StockCategory | 'toate'; label: string }[] = [
  { key: 'toate', label: 'Tot stocul' },
  { key: 'ppf', label: 'PPF' },
  { key: 'folie_color', label: 'Folie culoare' },
  { key: 'folie_geam', label: 'Folie geamuri' },
  { key: 'ceramica', label: 'Ceramice' },
  { key: 'consumabile', label: 'Consumabile' },
]


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
  /** doar pentru role: lungimea fiecărei role și câte role se adaugă deodată */
  rollLength: '15',
  count: '1',
}

export default function StockPage() {
  const { stock, moves, jobs, addStockItem, removeStockItem, adjustStock, toast } = useStore()
  const [cat, setCat] = useState<StockCategory | 'toate'>('toate')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortKey>('implicit')
  /** „Adaugă role” pe un produs existent — titlul modalului */
  const [addTo, setAddTo] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [form, setForm] = useState(emptyItem)
  const [presetKey, setPresetKey] = useState('')
  /** detaliile (furnizor, rolă, lățime…) stau pliate: de obicei totul e în denumire sau în preset */
  const [detailsOpen, setDetailsOpen] = useState(false)
  /** furnizor scris de mână, în afara listei */
  const [otherMaker, setOtherMaker] = useState(false)

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

  /** produse grupate + sortare (oferta: „ordonare după cantitate”) */
  const groups = useMemo(() => {
    const gs = groupStock(list)
    if (sort === 'cant_desc') gs.sort((a, b) => b.total - a.total)
    if (sort === 'cant_asc') gs.sort((a, b) => a.total - b.total)
    if (sort === 'nume') gs.sort((a, b) => a.name.localeCompare(b.name, 'ro'))
    return gs
  }, [list, sort])

  /** secțiuni pe categorie, în ordinea filtrelor */
  const sections = CATS.filter((c) => c.key !== 'toate' && (cat === 'toate' || c.key === cat))
    .map((c) => ({ ...c, gs: groups.filter((g) => g.category === c.key) }))
    .filter((sec) => sec.gs.length > 0)

  const allGroups = groupStock(stock)
  const low = allGroups.filter((g) => g.low)
  const rollCount = stock.filter((i) => isRollCategory(i.category) && i.qty > 0).length

  const suppliers = knownSuppliers(form.category, stock)
  const locations = knownLocations(stock)
  const presets = STOCK_PRESETS.filter((p) => p.category === form.category)

  const openNew = () => {
    const category: StockCategory = cat === 'toate' ? 'ppf' : cat
    setForm({
      ...emptyItem,
      category,
      rollNumber: nextRollNumber(category, stock),
      rollLength: String(defaultRollLength(category)),
    })
    setAddTo(null)
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
      rollLength: String(defaultRollLength(p.category)),
    }))
  }

  /** „+ role” pe un produs existent: același produs, numere de rolă noi */
  const openAddRolls = (g: StockGroup) => {
    const b = g.items[g.items.length - 1]
    setForm({
      ...emptyItem,
      category: b.category,
      maker: b.maker,
      name: b.name,
      finish: b.finish,
      width: b.width,
      unit: b.unit,
      minQty: String(g.minQty),
      location: b.location,
      rollNumber: nextRollNumber(b.category, stock),
      rollLength: String(rollLength(b)),
    })
    setAddTo(g.name)
    setPresetKey('')
    setOtherMaker(false)
    setDetailsOpen(false)
    setNewOpen(true)
  }

  const changeCategory = (category: StockCategory) => {
    setPresetKey('')
    setForm((f) => ({
      ...f,
      category,
      unit: category === 'ceramica' || category === 'consumabile' ? 'buc' : 'm',
      width: category === 'ceramica' || category === 'consumabile' ? '' : f.width || '1.52',
      rollNumber: nextRollNumber(category, stock),
      rollLength: String(defaultRollLength(category)),
    }))
  }

  const isRollForm = isRollCategory(form.category)

  const saveItem = () => {
    if (!form.name.trim()) return
    const base = {
      category: form.category,
      maker: form.maker,
      name: form.name,
      rollNumber: form.rollNumber,
      finish: form.finish,
      width: form.width,
      unit: form.unit,
      location: form.location,
    }
    if (isRollForm) {
      // fiecare rolă e un rând separat, cu numărul ei — consumul se bifează pe rolă
      const n = Math.max(1, Math.floor(Number(form.count) || 1))
      const len = Number(form.rollLength) || defaultRollLength(form.category)
      for (let k = 0; k < n; k++)
        addStockItem({
          ...base,
          rollNumber: incRollNumber(form.rollNumber, k),
          qty: len,
          rollLength: len,
          minQty: Number(form.minQty || 0),
        })
      toast(
        n === 1
          ? `Rola #${form.rollNumber} adăugată (${len} m)`
          : `${n} role adăugate: #${form.rollNumber} – #${incRollNumber(form.rollNumber, n - 1)} (${n * len} m)`,
      )
    } else {
      addStockItem({ ...base, qty: Number(form.qty || 0), minQty: Number(form.minQty || 0) })
      toast('Produs adăugat în stoc')
    }
    setForm(emptyItem)
    setPresetKey('')
    setAddTo(null)
    setNewOpen(false)
  }

  const groupBadge = (g: StockGroup) =>
    g.total <= 0 ? (
      <Badge tone="rose">epuizat</Badge>
    ) : g.low ? (
      <Badge tone="ember">sub prag</Badge>
    ) : (
      <Badge tone="mint">ok</Badge>
    )

  const needle = q.trim().toLowerCase()

  /** O rolă (sau un lot) ca „pastilă”: număr, nivel de umplere, metri rămași. Click = corectare. */
  const rollChip = (i: StockItem) => {
    const roll = isRollCategory(i.category)
    const pct = Math.max(0, Math.min(100, (i.qty / rollLength(i)) * 100))
    const hit = needle !== '' && i.rollNumber.toLowerCase().includes(needle)
    return (
      <button
        key={i.id}
        onClick={() => setSheetItem(i)}
        title={`#${i.rollNumber} · ${i.qty} ${i.unit}${i.location ? ` · ${i.location}` : ''} — click pentru corectare`}
        className={cx(
          'w-[86px] rounded-lg border px-2 py-1.5 text-left transition hover:border-brand-500/60 hover:bg-brand-500/5',
          i.qty <= 0 ? 'border-dashed border-line opacity-55' : 'border-line bg-ink-750/50',
          hit && 'ring-2 ring-brand-500/60',
        )}
      >
        <div className="truncate font-mono text-[11px] font-semibold text-fg-dim">#{i.rollNumber || '—'}</div>
        {roll && (
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/[0.08]">
            <div
              className={cx('h-full rounded-full', pct >= 99.9 ? 'bg-mint' : pct > 0 ? 'bg-ember' : '')}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        <div className="mt-1 font-mono text-[11px] text-fg-mute">
          {i.qty <= 0 ? 'goală' : roll ? `${i.qty}/${rollLength(i)} m` : `${i.qty} ${i.unit}`}
        </div>
      </button>
    )
  }

  /** Cardul unui produs: total mare, rezumat „3 role + 8 m”, rolele ca pastile. */
  const productCard = (g: StockGroup) => {
    const roll = isRollCategory(g.category)
    // rolele cu stoc întâi, cele goale la final
    const items = [...g.items].sort((a, b) => Number(a.qty <= 0) - Number(b.qty <= 0))
    return (
      <div
        key={g.key}
        className={cx(
          'flex flex-col rounded-xl border bg-ink-850 p-4',
          g.low ? 'border-ember/40' : 'border-line',
        )}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-semibold leading-snug">{g.name}</div>
            <div className="mt-0.5 truncate font-mono text-[11px] text-fg-faint">
              {[
                g.maker,
                g.width && `${g.width} m`,
                g.finish === 'lucioasa' ? 'lucioasă' : g.finish === 'mata' ? 'mată' : '',
                g.location,
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </div>
          {groupBadge(g)}
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <div
              className={cx(
                'font-mono text-[26px] leading-none font-bold',
                g.total <= 0 ? 'text-rose' : g.low ? 'text-ember' : 'text-fg',
              )}
            >
              {g.total}
              <span className="ml-1 text-[13px] font-semibold text-fg-mute">{g.unit}</span>
            </div>
            <div className="mt-1.5 text-[12.5px] text-fg-mute">
              {roll ? (
                <strong className="font-semibold text-fg-dim">{rollSummary(g)}</strong>
              ) : (
                `${g.items.length} ${g.items.length === 1 ? 'lot' : 'loturi'}`
              )}{' '}
              · prag {g.minQty} {g.unit}
            </div>
          </div>
          {roll ? (
            <Button size="sm" onClick={() => openAddRolls(g)}>
              <IconPlus width={13} height={13} /> Role
            </Button>
          ) : (
            g.items.length === 1 && (
              <Button size="sm" onClick={() => setSheetItem(g.items[0])}>
                Corectează
              </Button>
            )
          )}
        </div>

        {(roll || g.items.length > 1) && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">{items.map(rollChip)}</div>
        )}
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="Stoc"
        subtitle={`${allGroups.length} produse · ${rollCount} role în stoc · ${low.length} sub prag`}
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
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-lg border border-line-strong bg-ink-750 px-3 py-2 text-[13px] outline-none md:ml-auto md:py-1.5"
          aria-label="Ordonare"
        >
          <option value="implicit">Ordonare: implicită</option>
          <option value="cant_desc">Cantitate: mare → mică</option>
          <option value="cant_asc">Cantitate: mică → mare</option>
          <option value="nume">Nume A–Z</option>
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Caută produs, rolă…"
          className="w-full rounded-lg border border-line-strong bg-ink-750 px-3 py-2 text-[16px] outline-none focus:border-brand-500/60 md:w-60 md:py-1.5 md:text-[13px]"
        />
      </div>

      {/* grid-cols-1 = minmax(0,1fr); fără el coloana implicită `auto` se lățește după conținut */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_330px]">
        <div className="flex min-w-0 flex-col gap-6">
          {sections.length === 0 && (
            <Card>
              <EmptyState text="Niciun produs." />
            </Card>
          )}
          {sections.map((sec) => {
            const total = Math.round(sec.gs.reduce((sum, g) => sum + g.total, 0) * 100) / 100
            const lowCount = sec.gs.filter((g) => g.low).length
            return (
              <section key={sec.key}>
                <div className="mb-2.5 flex items-baseline gap-2">
                  <h2 className="text-[15px] font-bold">{sec.label}</h2>
                  <span className="font-mono text-[12px] text-fg-faint">
                    {sec.gs.length} {sec.gs.length === 1 ? 'produs' : 'produse'} · {total}{' '}
                    {sec.gs[0].unit}
                    {lowCount > 0 && <span className="text-ember"> · {lowCount} sub prag</span>}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{sec.gs.map(productCard)}</div>
              </section>
            )
          })}
        </div>

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
        title={addTo ? `Role noi · ${addTo}` : 'Produs nou în stoc'}
        subtitle="Rolele se identifică prin număr — se preiau automat în fișa mașinii."
        width="max-w-xl"
        footer={
          <>
            <Button onClick={() => setNewOpen(false)}>Anulează</Button>
            <Button variant="primary" onClick={saveItem}>
              {isRollForm
                ? Number(form.count) > 1
                  ? `Adaugă ${Math.floor(Number(form.count))} role`
                  : 'Adaugă rola'
                : 'Adaugă produs'}
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
          {isRollForm ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Lungime rolă (m)" hint="Implicit 15 m.">
                <Input
                  type="number"
                  min={1}
                  value={form.rollLength}
                  onChange={(e) => setForm((f) => ({ ...f, rollLength: e.target.value }))}
                />
              </Field>
              <Field
                label="Câte role"
                hint={
                  Number(form.count) > 1
                    ? `#${form.rollNumber} – #${incRollNumber(form.rollNumber, Math.floor(Number(form.count)) - 1)}`
                    : `#${form.rollNumber}`
                }
              >
                <Input
                  type="number"
                  min={1}
                  value={form.count}
                  onChange={(e) => setForm((f) => ({ ...f, count: e.target.value }))}
                />
              </Field>
            </div>
          ) : (
            <Field label={`Cantitate inițială (${form.unit})`}>
              <Input
                type="number"
                value={form.qty}
                onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
              />
            </Field>
          )}
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
      <Modal
        open={!!sheetItem}
        onClose={() => setSheetItem(null)}
        title={sheetItem ? `${sheetItem.name} · #${sheetItem.rollNumber || '—'}` : ''}
        subtitle={
          sheetItem
            ? `${sheetItem.maker}${sheetItem.location ? ` · ${sheetItem.location}` : ''} · în stoc ${sheetItem.qty}${sheetItem.unit}${isRollCategory(sheetItem.category) ? ` din ${rollLength(sheetItem)}` : ''}`
            : undefined
        }
        footer={
          <>
            <Button className="min-h-[44px] flex-1 md:min-h-0 md:flex-none" onClick={() => setSheetItem(null)}>
              Anulează
            </Button>
            <Button variant="primary" className="min-h-[44px] flex-1 md:min-h-0 md:flex-none" onClick={saveSheet}>
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
                if (!confirm(`Ștergi ${sheetItem.name} #${sheetItem.rollNumber}?`)) return
                removeStockItem(sheetItem.id)
                setSheetItem(null)
              }}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-line text-[14px] font-semibold text-rose"
            >
              <IconTrash width={15} height={15} />{' '}
              {isRollCategory(sheetItem.category) ? 'Șterge rola' : 'Șterge lotul'}
            </button>
          </div>
        )}
      </Modal>

    </>
  )
}
