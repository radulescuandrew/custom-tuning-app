import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addMonths, eachMonthOfInterval, format, isSameMonth, parseISO, startOfMonth, subMonths } from 'date-fns'
import { ro } from 'date-fns/locale'
import { PageHeader } from '@/components/PageHeader'
import { Card, Chip } from '@/components/ui'
import { IconWarn } from '@/components/Icons'
import { clientName, jobReceivedAt, jobTotal, useStore } from '@/data/store'
import { serviceDef } from '@/data/serviceCatalog'
import type { Job, ServiceKind } from '@/data/types'
import { useMoney } from '@/components/Money'
import { fmtRon } from '@/lib/money'
import { cx } from '@/lib/utils'

/* ───────── culori grafice (paleta validată: 3 sloturi, light, suprafață albă) ───────── */
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a'] as const
const INK = { muted: '#8a8a97', grid: '#ececf0', axis: '#d6d6de' }

/** Trei familii de lucrări — suficient pentru o stivă lizibilă (paleta validează 3 sloturi). */
const GROUPS: { key: string; label: string; kinds: ServiceKind[] }[] = [
  { key: 'folii', label: 'Folii', kinds: ['colantare', 'folie_geam', 'folie_parbriz'] },
  { key: 'detailing', label: 'Detailing & ceramică', kinds: ['detailing', 'ceramica'] },
  {
    key: 'tuning',
    label: 'Tuning & performanță',
    kinds: ['jante', 'evacuare', 'suspensii', 'tuning', 'chip_tuning', 'custom'],
  },
]
const groupOf = (k: ServiceKind) => GROUPS.findIndex((g) => g.kinds.includes(k))

const PERIODS = [3, 6, 12] as const

/** O lucrare intră în încasări când e terminată (Finalizat / Predat). */
const doneAt = (j: Job) =>
  (j.status === 'finalizat' || j.status === 'predat') && j.completedAt ? parseISO(j.completedAt) : null

const pctDelta = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null)
/** sumă rotunjită, fără zecimale: „449.400” — unitatea se afișează separat, mai mic */
const intRo = (v: number) => Math.round(v).toLocaleString('ro-RO')
const kRon = (v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : `${Math.round(v)}`)

/** lățimea reală a containerului — graficele SVG se desenează în pixeli, nu scalate */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(600)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.floor(e.contentRect.width))))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

export default function ReportsPage() {
  const nav = useNavigate()
  const { fmt, calc, settings } = useMoney()
  const { jobs, clients, moves, stock } = useStore()
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(6)

  const now = new Date()
  const from = startOfMonth(subMonths(now, period - 1))
  const prevFrom = subMonths(from, period)
  const inRange = (d: Date | null, a: Date, b: Date) => !!d && d >= a && d < b
  const done = jobs.filter((j) => inRange(doneAt(j), from, addMonths(startOfMonth(now), 1)))
  const donePrev = jobs.filter((j) => inRange(doneAt(j), prevFrom, from))

  const months = useMemo(
    () => eachMonthOfInterval({ start: from, end: now }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [period],
  )

  /* ───── serii pe lună ───── */
  const perMonth = months.map((m) => {
    const list = done.filter((j) => isSameMonth(doneAt(j)!, m))
    const byGroup = GROUPS.map((_, gi) =>
      list
        .flatMap((j) => j.services)
        .filter((s) => groupOf(s.kind) === gi)
        .reduce((sum, s) => sum + (s.price || 0), 0),
    )
    return {
      m,
      label: format(m, 'LLL', { locale: ro }),
      long: format(m, 'LLLL yyyy', { locale: ro }),
      byGroup,
      total: byGroup.reduce((a, b) => a + b, 0),
      count: list.length,
    }
  })

  const metersOf = (list: Job[]) =>
    list
      .flatMap((j) => j.services)
      .flatMap((s) => s.rollUsages)
      .reduce((sum, u) => sum + (stock.find((i) => i.id === u.stockItemId)?.unit === 'm' ? u.qty : 0), 0)
  const revenue = done.reduce((s, j) => s + jobTotal(j), 0)
  const revenuePrev = donePrev.reduce((s, j) => s + jobTotal(j), 0)
  const avg = done.length ? revenue / done.length : 0
  const avgPrev = donePrev.length ? revenuePrev / donePrev.length : 0
  const meters = metersOf(done)
  const metersPrev = metersOf(donePrev)
  const fiscal = calc(revenue)

  const kpis = [
    {
      label: 'Încasări',
      value: intRo(revenue),
      unit: 'RON',
      delta: pctDelta(revenue, revenuePrev),
      spark: perMonth.map((p) => p.total),
    },
    {
      label: 'Lucrări predate',
      value: String(done.length),
      unit: '',
      delta: pctDelta(done.length, donePrev.length),
      spark: perMonth.map((p) => p.count),
    },
    {
      label: 'Valoare medie / lucrare',
      value: intRo(avg),
      unit: 'RON',
      delta: pctDelta(avg, avgPrev),
      spark: perMonth.map((p) => (p.count ? p.total / p.count : 0)),
    },
    {
      label: 'Folie aplicată',
      value: intRo(meters),
      unit: 'm',
      delta: pctDelta(meters, metersPrev),
      spark: months.map((m) => metersOf(done.filter((j) => isSameMonth(doneAt(j)!, m)))),
    },
  ]

  /* ───── mix servicii ───── */
  const mix = useMemo(() => {
    const acc = new Map<ServiceKind, { revenue: number; count: number }>()
    for (const s of done.flatMap((j) => j.services)) {
      const cur = acc.get(s.kind) ?? { revenue: 0, count: 0 }
      acc.set(s.kind, { revenue: cur.revenue + (s.price || 0), count: cur.count + 1 })
    }
    return [...acc.entries()]
      .map(([kind, v]) => ({ kind, label: serviceDef(kind).label, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [done])

  /* ───── atelierul acum ───── */
  const active = jobs.filter((j) => j.status !== 'anulat' && j.status !== 'predat')
  const pipeline = [
    { label: 'Programate', hint: 'mașina nu a ajuns', list: active.filter((j) => j.status === 'programat' && !jobReceivedAt(j)) },
    { label: 'În atelier', hint: 'primite, neîncepute', list: active.filter((j) => j.status === 'programat' && jobReceivedAt(j)) },
    { label: 'În lucru', hint: 'se lucrează acum', list: active.filter((j) => j.status === 'in_lucru') },
    { label: 'Blocate', hint: 'piese / materiale', list: active.filter((j) => j.status === 'blocat'), warn: true },
    { label: 'Gata de ridicat', hint: 'așteaptă clientul', list: active.filter((j) => j.status === 'finalizat') },
  ]
  const pipelineValue = active.reduce((s, j) => s + jobTotal(j), 0)

  /* ───── încadrare în estimare + timp în atelier ───── */
  const timed = done.filter((j) => j.actualStartAt && j.actualEndAt && j.estimateMin)
  const onTime = timed.filter(
    (j) => (Date.parse(j.actualEndAt!) - Date.parse(j.actualStartAt!)) / 60_000 <= j.estimateMin * 1.1,
  )
  const onTimePct = timed.length ? Math.round((onTime.length / timed.length) * 100) : null
  const stays = done
    .filter((j) => jobReceivedAt(j) && j.handedOverAt)
    .map((j) => (Date.parse(j.handedOverAt!) - Date.parse(jobReceivedAt(j)!)) / 86_400_000)
  const avgStay = stays.length ? stays.reduce((a, b) => a + b, 0) / stays.length : null

  /* ───── top clienți ───── */
  const top = clients
    .map((c) => {
      const list = done.filter((j) => j.clientId === c.id)
      return {
        c,
        total: list.reduce((s, j) => s + jobTotal(j), 0),
        count: list.length,
        last: list.map((j) => j.completedAt!).sort().at(-1),
      }
    })
    .filter((t) => t.count > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)

  /* ───── consum folie pe produs ───── */
  const consumption = useMemo(() => {
    const acc = new Map<string, number>()
    for (const m of moves) {
      if (m.delta >= 0 || !inRange(parseISO(m.at), from, addMonths(startOfMonth(now), 1))) continue
      const it = stock.find((s) => s.id === m.stockItemId)
      if (!it || it.unit !== 'm') continue
      const key = `${it.maker} · ${it.name}`
      acc.set(key, (acc.get(key) ?? 0) + Math.abs(m.delta))
    }
    return [...acc.entries()].map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moves, stock, period])

  return (
    <>
      <PageHeader
        title="Rapoarte & KPI"
        subtitle={`Lucrări terminate · ${format(from, 'LLL yyyy', { locale: ro })} – ${format(now, 'LLL yyyy', { locale: ro })} · comparat cu perioada anterioară`}
        action={
          <div className="flex gap-1.5">
            {PERIODS.map((p) => (
              <Chip key={p} active={period === p} onClick={() => setPeriod(p)}>
                {p} luni
              </Chip>
            ))}
          </div>
        }
      />

      {/* KPI */}
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <div className="mono-label">{k.label}</div>
            <div className="mt-2 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[26px] leading-none font-extrabold">
                  {k.value}
                  {k.unit && <span className="ml-1 text-[13px] font-semibold text-fg-mute">{k.unit}</span>}
                </div>
                <Delta value={k.delta} />
              </div>
              <Sparkline values={k.spark} />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
        <Card
          title="Încasări pe lună, pe tip de lucrare"
          action={
            settings.vatPayer ? (
              <span className="font-mono text-[11px] text-fg-faint">
                bază {fmtRon(fiscal.net)} · TVA {fmtRon(fiscal.vat)}
              </span>
            ) : undefined
          }
        >
          <RevenueChart data={perMonth} fmt={fmt} />
        </Card>

        <Card title="Mix servicii" action={<span className="font-mono text-[11px] text-fg-faint">după valoare</span>}>
          {mix.length === 0 ? (
            <p className="text-[13px] text-fg-mute">Nicio lucrare terminată în perioadă.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {mix.map((s) => (
                <li key={s.kind}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
                    <span className="truncate font-semibold">{s.label}</span>
                    <span className="flex-none font-mono text-[11.5px] text-fg-mute">
                      {s.count} × · {fmt(s.revenue)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/[0.05]">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(s.revenue / mix[0].revenue) * 100}%`, background: SERIES[0] }}
                      />
                    </div>
                    <span className="w-9 text-right font-mono text-[11px] text-fg-faint">
                      {Math.round((s.revenue / revenue) * 100)}%
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* atelierul acum */}
      <Card
        className="mt-5"
        title="Atelierul acum"
        action={
          <span className="font-mono text-[11px] text-fg-faint">
            {active.length} lucrări deschise · {fmt(pipelineValue)} în lucru
          </span>
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {pipeline.map((p) => (
            <button
              key={p.label}
              onClick={() => nav('/programari')}
              className="rounded-xl border border-line bg-ink-750/40 px-4 py-3 text-left transition hover:border-brand-500/40"
            >
              <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-fg-dim">
                {p.warn && p.list.length > 0 && <IconWarn width={14} height={14} className="text-ember" />}
                {p.label}
              </div>
              <div className="mt-1 text-[28px] leading-none font-extrabold">{p.list.length}</div>
              <div className="mt-1.5 text-[11.5px] text-fg-faint">
                {p.list.length ? fmt(p.list.reduce((s, j) => s + jobTotal(j), 0)) : p.hint}
              </div>
            </button>
          ))}
        </div>
      </Card>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card title="Timp & estimări">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[34px] leading-none font-extrabold">
                {onTimePct === null ? '—' : `${onTimePct}%`}
              </div>
              <div className="mt-1.5 text-[12.5px] text-fg-mute">lucrări în estimare (±10%)</div>
              <div className="mt-0.5 font-mono text-[11px] text-fg-faint">
                {onTime.length} din {timed.length}
              </div>
            </div>
            <div>
              <div className="text-[34px] leading-none font-extrabold">
                {avgStay === null ? '—' : avgStay.toFixed(1)}
                <span className="ml-1 text-[15px] font-semibold text-fg-mute">zile</span>
              </div>
              <div className="mt-1.5 text-[12.5px] text-fg-mute">timp mediu în atelier</div>
              <div className="mt-0.5 font-mono text-[11px] text-fg-faint">de la primire la predare</div>
            </div>
          </div>
          {onTimePct !== null && (
            <div className="mt-4">
              <div className="flex h-2 overflow-hidden rounded-full bg-black/[0.05]">
                <div className="h-full" style={{ width: `${onTimePct}%`, background: SERIES[0] }} />
              </div>
              <div className="mt-1 flex justify-between font-mono text-[10.5px] text-fg-faint">
                <span>în estimare</span>
                <span>peste estimare {100 - onTimePct}%</span>
              </div>
            </div>
          )}
        </Card>

        <Card title="Top clienți" pad={false}>
          {top.length === 0 ? (
            <p className="px-5 py-4 text-[13px] text-fg-mute">Nicio lucrare terminată în perioadă.</p>
          ) : (
            <ul className="divide-y divide-line">
              {top.map((t, i) => (
                <li key={t.c.id}>
                  <button
                    onClick={() => nav(`/clienti/${t.c.id}`)}
                    className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition hover:bg-black/[0.03]"
                  >
                    <span className="w-4 font-mono text-[11px] text-fg-faint">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">{clientName(t.c)}</span>
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-black/[0.05]">
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${(t.total / top[0].total) * 100}%`, background: SERIES[0] }}
                        />
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block font-mono text-[12.5px] font-bold">{fmt(t.total)}</span>
                      <span className="block font-mono text-[10.5px] text-fg-faint">
                        {t.count} lucrări
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Consum folie pe produs">
          {consumption.length === 0 ? (
            <p className="text-[13px] text-fg-mute">Niciun consum înregistrat în perioadă.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {consumption.map((c) => (
                <li key={c.name}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-[12.5px]">
                    <span className="truncate">{c.name}</span>
                    <span className="flex-none font-mono font-bold">{Math.round(c.qty)} m</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.05]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(c.qty / consumption[0].qty) * 100}%`, background: SERIES[0] }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}

/* ───────────────────────── piese ───────────────────────── */

function Delta({ value }: { value: number | null }) {
  if (value === null)
    return <div className="mt-1.5 font-mono text-[11px] text-fg-faint">fără comparație</div>
  const up = value >= 0
  return (
    <div className={cx('mt-1.5 font-mono text-[11.5px] font-semibold', up ? 'text-mint' : 'text-rose')}>
      {up ? '▲' : '▼'} {Math.abs(value)}%
      <span className="ml-1 font-normal text-fg-faint">vs. anterior</span>
    </div>
  )
}

/** Mini-grafic: o singură serie, linie de 2px, ultimul punct marcat. */
function Sparkline({ values }: { values: number[] }) {
  const W = 84
  const H = 34
  const max = Math.max(1, ...values)
  const step = values.length > 1 ? W / (values.length - 1) : W
  const pts = values.map((v, i) => [i * step, H - 3 - (v / max) * (H - 8)] as const)
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const last = pts.at(-1)
  return (
    <svg width={W} height={H} className="flex-none overflow-visible" aria-hidden>
      <path d={`${d} L${W},${H} L0,${H} Z`} fill={SERIES[0]} opacity={0.08} />
      <path d={d} fill="none" stroke={SERIES[0]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {last && <circle cx={last[0]} cy={last[1]} r={3} fill={SERIES[0]} stroke="#fff" strokeWidth={2} />}
    </svg>
  )
}

type MonthRow = { label: string; long: string; byGroup: number[]; total: number; count: number }

/** Bare stivuite pe lună (3 familii), cu tooltip la hover și vizualizare tabel. */
function RevenueChart({ data, fmt }: { data: MonthRow[]; fmt: (v: number) => string }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const [table, setTable] = useState(false)

  const H = 360
  const padL = 40
  const padB = 24
  const plotW = width - padL
  const plotH = H - padB - 8
  const rawMax = Math.max(1, ...data.map((d) => d.total))
  // trepte „rotunde” (1 / 2 / 2.5 / 5 × 10ⁿ), ~4 linii de grilă
  const rough = rawMax / 4
  const mag = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= rough)!
  const max = Math.ceil(rawMax / step) * step
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step)
  const slot = plotW / data.length
  const barW = Math.min(44, slot * 0.58)
  const y = (v: number) => 8 + plotH - (v / max) * plotH
  const totals = GROUPS.map((_, gi) => data.reduce((s, d) => s + d.byGroup[gi], 0))

  return (
    <div>
      {/* legendă cu totalurile perioadei (identitatea nu stă doar în culoare) */}
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
        {GROUPS.map((g, gi) => (
          <span key={g.key} className="flex items-center gap-2 text-[12.5px]">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[gi] }} />
            <span className="text-fg-dim">{g.label}</span>
            <span className="font-mono text-[11.5px] text-fg-mute">{fmt(totals[gi])}</span>
          </span>
        ))}
        <button
          onClick={() => setTable((t) => !t)}
          className="ml-auto text-[12px] font-semibold text-brand-500 hover:underline"
        >
          {table ? 'Grafic' : 'Tabel'}
        </button>
      </div>

      {table ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-line text-left text-fg-mute">
                <th className="py-1.5 font-semibold">Luna</th>
                {GROUPS.map((g) => (
                  <th key={g.key} className="py-1.5 text-right font-semibold">
                    {g.label}
                  </th>
                ))}
                <th className="py-1.5 text-right font-semibold">Total</th>
                <th className="py-1.5 text-right font-semibold">Lucrări</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {data.map((d) => (
                <tr key={d.long} className="border-b border-line/60">
                  <td className="py-1.5 font-sans capitalize">{d.long}</td>
                  {d.byGroup.map((v, i) => (
                    <td key={i} className="py-1.5 text-right">
                      {v ? fmt(v) : '—'}
                    </td>
                  ))}
                  <td className="py-1.5 text-right font-bold">{fmt(d.total)}</td>
                  <td className="py-1.5 text-right">{d.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
          <svg width={width} height={H} role="img" aria-label="Încasări pe lună, pe tip de lucrare">
            {/* grilă și axă — recesive */}
            {ticks.map((t) => (
              <g key={t}>
                <line x1={padL} x2={width} y1={y(t)} y2={y(t)} stroke={t ? INK.grid : INK.axis} strokeWidth={1} />
                <text x={padL - 8} y={y(t) + 3.5} textAnchor="end" fontSize={10.5} fill={INK.muted} fontFamily="ui-monospace, monospace">
                  {kRon(t)}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const cx0 = padL + slot * i + slot / 2
              const x = cx0 - barW / 2
              let acc = 0
              const segs = d.byGroup
                .map((v, gi) => ({ v, gi }))
                .filter((s) => s.v > 0)
              return (
                <g key={d.long} opacity={hover === null || hover === i ? 1 : 0.45}>
                  {segs.map((s, si) => {
                    const top = y(acc + s.v)
                    const bottom = y(acc)
                    acc += s.v
                    // 2px gol între segmente; colțuri rotunjite doar la capătul de sus
                    const h = Math.max(0, bottom - top - (si < segs.length - 1 ? 2 : 0))
                    const isTop = si === segs.length - 1
                    const r = isTop ? Math.min(4, h) : 0
                    const yy = si < segs.length - 1 ? top + 2 : top
                    return (
                      <path
                        key={s.gi}
                        d={`M${x},${yy + h} V${yy + r} Q${x},${yy} ${x + r},${yy} H${x + barW - r} Q${x + barW},${yy} ${x + barW},${yy + r} V${yy + h} Z`}
                        fill={SERIES[s.gi]}
                      />
                    )
                  })}
                  <text x={cx0} y={H - 6} textAnchor="middle" fontSize={11} fill={INK.muted} className="capitalize">
                    {d.label}
                  </text>
                  {/* țintă de hover mai mare decât bara */}
                  <rect
                    x={padL + slot * i}
                    y={0}
                    width={slot}
                    height={H - padB}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                  />
                </g>
              )
            })}
          </svg>

          {hover !== null && (
            <div
              className="pointer-events-none absolute top-2 z-10 w-64 rounded-lg border border-line bg-ink-850 px-3 py-2.5 shadow-lg"
              style={{
                left: Math.min(
                  Math.max(0, padL + slot * hover + slot / 2 - 128),
                  Math.max(0, width - 256),
                ),
              }}
            >
              <div className="mb-1.5 text-[12.5px] font-bold capitalize">{data[hover].long}</div>
              {GROUPS.map((g, gi) => (
                <div key={g.key} className="flex items-center gap-2 text-[12px]">
                  <span className="h-2 w-2 rounded-sm" style={{ background: SERIES[gi] }} />
                  <span className="flex-1 text-fg-mute">{g.label}</span>
                  <span className="font-mono">{fmt(data[hover].byGroup[gi])}</span>
                </div>
              ))}
              <div className="mt-1.5 flex justify-between border-t border-line pt-1.5 text-[12px] font-bold">
                <span>Total · {data[hover].count} lucrări</span>
                <span className="font-mono">{fmt(data[hover].total)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
