import { useMemo } from 'react'
import { eachMonthOfInterval, format, isSameMonth, parseISO, subMonths } from 'date-fns'
import { ro } from 'date-fns/locale'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui'
import { jobTotal, useStore } from '@/data/store'
import { SERVICE_CATALOG, serviceDef } from '@/data/serviceCatalog'
import { useMoney } from '@/components/Money'
import { fmtRon } from '@/lib/money'

export default function ReportsPage() {
  const { fmt, calc, settings } = useMoney()
  const { jobs, clients, moves, stock } = useStore()

  const months = useMemo(
    () => eachMonthOfInterval({ start: subMonths(new Date(), 5), end: new Date() }),
    [],
  )

  const perMonth = months.map((m) => {
    const list = jobs.filter((j) => isSameMonth(parseISO(j.startAt), m) && j.status !== 'anulat')
    return {
      label: format(m, 'LLL', { locale: ro }),
      count: list.length,
      revenue: list.reduce((s, j) => s + jobTotal(j), 0),
      meters: list
        .flatMap((j) => j.services)
        .filter((s) => s.kind === 'colantare')
        .reduce((s, x) => s + Number(x.values.metersUsed || 0), 0),
    }
  })
  const maxRev = Math.max(1, ...perMonth.map((m) => m.revenue))
  const sixMonths = calc(perMonth.reduce((s, m) => s + m.revenue, 0))

  const perService = SERVICE_CATALOG.map((def) => {
    const entries = jobs.flatMap((j) => j.services).filter((s) => s.kind === def.kind)
    return {
      def,
      count: entries.length,
      revenue: entries.reduce((s, x) => s + (x.price || 0), 0),
    }
  }).sort((a, b) => b.revenue - a.revenue)
  const maxSvc = Math.max(1, ...perService.map((s) => s.revenue))

  const topClients = clients
    .map((c) => ({
      client: c,
      total: jobs.filter((j) => j.clientId === c.id).reduce((s, j) => s + jobTotal(j), 0),
      count: jobs.filter((j) => j.clientId === c.id).length,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  const consumed = moves
    .filter((m) => m.delta < 0)
    .reduce((acc, m) => {
      const item = stock.find((s) => s.id === m.stockItemId)
      const key = item ? `${item.maker} ${item.name}` : 'necunoscut'
      acc[key] = (acc[key] ?? 0) + Math.abs(m.delta)
      return acc
    }, {} as Record<string, number>)

  return (
    <>
      <PageHeader
        title="Rapoarte & KPI"
        subtitle={`Ultimele 6 luni · date din programările înregistrate · sume în RON${
          settings.vatPayer ? ` (cu TVA ${settings.vatRate}%)` : ' (firmă neplătitoare de TVA)'
        }`}
      />

      <Card title="Total ultimele 6 luni" className="mb-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(settings.vatPayer
            ? ([
                ['Bază impozabilă', fmtRon(sixMonths.net), 'text-fg'],
                [`TVA ${settings.vatRate}% colectat`, fmtRon(sixMonths.vat), 'text-ember'],
                ['Total cu TVA', fmtRon(sixMonths.gross), 'text-brand-400'],
              ] as const)
            : ([['Total încasări', fmtRon(sixMonths.gross), 'text-brand-400']] as const)
          ).map(([label, value, tone]) => (
            <div key={label}>
              <div className="mono-label">{label}</div>
              <div className={`mt-1 text-xl font-extrabold ${tone}`}>{value}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title="Încasări programate / lună">
          <div className="flex h-52 items-end gap-3">
            {perMonth.map((m) => (
              <div key={m.label} className="flex flex-1 flex-col items-center gap-2">
                <div className="font-mono text-[11px] text-fg-mute">
                  {m.revenue ? fmt(m.revenue) : ''}
                </div>
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-brand-700 to-brand-500"
                  style={{ height: `${(m.revenue / maxRev) * 130 + 4}px` }}
                />
                <div className="font-mono text-[11px] text-fg-faint capitalize">{m.label}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Servicii · volum și valoare">
          <ul className="flex flex-col gap-3">
            {perService.map((s) => (
              <li key={s.def.kind}>
                <div className="mb-1 flex items-center justify-between text-[13px]">
                  <span className="font-semibold">{s.def.label}</span>
                  <span className="font-mono text-fg-mute">
                    {s.count} × · {fmt(s.revenue)}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-black/[0.06]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(s.revenue / maxSvc) * 100}%`,
                      background: s.def.accent,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Top clienți" pad={false}>
          <ul className="divide-y divide-line">
            {topClients.map((t) => (
              <li key={t.client.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex-1 text-sm font-semibold">
                  {t.client.type === 'pj' ? t.client.companyName : `${t.client.lastName} ${t.client.firstName}`}
                </span>
                <span className="font-mono text-[12px] text-fg-faint">{t.count} lucrări</span>
                <span className="font-mono text-[13px] font-bold text-brand-400">
                  {fmt(t.total)}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Consum folie · pe produs" pad={false}>
          {Object.keys(consumed).length === 0 ? (
            <p className="px-5 py-6 text-[13px] text-fg-mute">Niciun consum înregistrat încă.</p>
          ) : (
            <ul className="divide-y divide-line">
              {Object.entries(consumed).map(([name, qty]) => (
                <li key={name} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex-1 text-sm">{name}</span>
                  <span className="font-mono text-[13px] font-bold text-ember">{qty} m</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-5" title="Metri de folie / lună">
        <div className="flex h-32 items-end gap-3">
          {perMonth.map((m) => {
            const max = Math.max(1, ...perMonth.map((x) => x.meters))
            return (
              <div key={m.label} className="flex flex-1 flex-col items-center gap-2">
                <div className="font-mono text-[11px] text-fg-mute">{m.meters || ''}</div>
                <div
                  className="w-full rounded-t-md bg-black/10"
                  style={{ height: `${(m.meters / max) * 70 + 4}px` }}
                />
                <div className="font-mono text-[11px] text-fg-faint capitalize">{m.label}</div>
              </div>
            )
          })}
        </div>
      </Card>

      <p className="mt-4 text-[12px] text-fg-faint">
        Serviciile cu retuș: {SERVICE_CATALOG.filter((s) => s.retouch).map((s) => serviceDef(s.kind).label).join(', ')}.
      </p>
    </>
  )
}
