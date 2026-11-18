import { Link } from 'react-router-dom'
import { isSameDay, isWithinInterval, parseISO, startOfMonth, endOfMonth } from 'date-fns'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Card, EmptyState } from '@/components/ui'
import { StatusBadge } from '@/components/StatusBadge'
import { NOTIF_KIND_LABEL, carName, clientName, jobTotal, useStore } from '@/data/store'
import { serviceLabel } from '@/data/serviceCatalog'
import { fmtDate } from '@/lib/utils'
import { IconChevronRight, IconWarn } from '@/components/Icons'
import { groupStock, isRollCategory, rollSummary } from '@/lib/stockGroups'
import { useMoney } from '@/components/Money'

export default function DashboardPage() {
  const { fmt, settings } = useMoney()
  const { jobs, clients, cars, stock, notifications } = useStore()
  const now = new Date()
  const month = { start: startOfMonth(now), end: endOfMonth(now) }

  const today = jobs.filter((j) => isSameDay(parseISO(j.startAt), now) && j.status !== 'anulat')
  const active = jobs.filter((j) => j.status === 'in_lucru' || j.status === 'blocat')
  const monthJobs = jobs.filter(
    (j) => isWithinInterval(parseISO(j.startAt), month) && j.status !== 'anulat',
  )
  const revenue = monthJobs.reduce((s, j) => s + jobTotal(j), 0)
  const lowStock = groupStock(stock).filter((g) => g.low)
  const dueNotifs = notifications.filter(
    (n) => n.status === 'programata' && parseISO(n.dueAt) <= now,
  )

  const metersThisMonth = monthJobs
    .flatMap((j) => j.services)
    .filter((s) => s.kind === 'colantare')
    .reduce((sum, s) => sum + Number(s.values.metersUsed || 0), 0)

  const kpis = [
    { label: 'Azi în atelier', value: String(today.length), sub: `${active.length} lucrări active` },
    { label: 'Programări luna asta', value: String(monthJobs.length), sub: `${clients.length} clienți · ${cars.length} mașini` },
    {
      label: 'Valoare lună',
      value: fmt(revenue),
      sub: settings.vatPayer ? `servicii programate · TVA ${settings.vatRate}% inclus` : 'servicii programate',
    },
    { label: 'Folie consumată', value: `${metersThisMonth} m`, sub: 'colantare · luna curentă' },
  ]

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={fmtDate(now.toISOString(), 'EEEE, d MMMM yyyy')}
        action={
          <Link to="/programari">
            <Button>Vezi programările</Button>
          </Link>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <div className="mono-label">{k.label}</div>
            <div className="mt-2 text-[26px] leading-none font-extrabold tracking-tight">{k.value}</div>
            <div className="mt-1.5 text-[12px] text-fg-mute">{k.sub}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          pad={false}
          title="Programări în curs"
          action={
            <Link to="/programari" className="text-[13px] font-semibold text-brand-400 hover:text-brand-500">
              Vezi toate →
            </Link>
          }
        >
          {[...today, ...active.filter((a) => !today.some((t) => t.id === a.id))].length === 0 ? (
            <EmptyState text="Nicio lucrare activă azi." />
          ) : (
            <ul className="divide-y divide-line">
              {[...today, ...active.filter((a) => !today.some((t) => t.id === a.id))]
                .slice(0, 6)
                .map((j) => {
                  const car = cars.find((c) => c.id === j.carId)
                  const client = clients.find((c) => c.id === j.clientId)
                  return (
                    <li key={j.id}>
                      <Link
                        to={`/programari/${j.id}`}
                        className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-black/[0.035]"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">
                            {carName(car)} · <span className="text-fg-mute">{car?.plate}</span>
                          </div>
                          <div className="mt-0.5 truncate text-[12.5px] text-fg-mute">
                            {j.services.map((s) => serviceLabel(s)).join(' + ')} ·{' '}
                            {clientName(client)} · {j.assignee}
                          </div>
                        </div>
                        <StatusBadge status={j.status} />
                        <IconChevronRight width={16} height={16} className="text-fg-faint" />
                      </Link>
                    </li>
                  )
                })}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-5">
          <Card
            pad={false}
            title="Notificări de trimis"
            action={
              <Link to="/notificari" className="text-[13px] font-semibold text-brand-400">
                Deschide →
              </Link>
            }
          >
            {dueNotifs.length === 0 ? (
              <EmptyState text="Nimic scadent astăzi." />
            ) : (
              <ul className="divide-y divide-line">
                {dueNotifs.slice(0, 4).map((n) => {
                  const client = clients.find((c) => c.id === n.clientId)
                  return (
                    <li key={n.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{clientName(client)}</div>
                        <div className="text-[12px] text-fg-mute">
                          {NOTIF_KIND_LABEL[n.kind]}
                        </div>
                      </div>
                      <Badge tone="ember">{fmtDate(n.dueAt, 'dd MMM')}</Badge>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <Card
            pad={false}
            title="Stoc sub prag"
            action={
              <Link to="/stoc" className="text-[13px] font-semibold text-brand-400">
                Stoc →
              </Link>
            }
          >
            {lowStock.length === 0 ? (
              <EmptyState text="Stoc în parametri." />
            ) : (
              <ul className="divide-y divide-line">
                {lowStock.map((g) => (
                  <li key={g.key} className="flex items-center gap-3 px-5 py-3">
                    <IconWarn width={16} height={16} className="text-ember" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{g.name}</div>
                      <div className="font-mono text-[11px] text-fg-faint">
                        {g.maker}
                        {isRollCategory(g.category) ? ` · ${rollSummary(g)}` : ` · ${g.items.length} lot(uri)`}
                      </div>
                    </div>
                    <span className="font-mono text-[13px] font-bold text-ember">
                      {g.total} {g.unit}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
