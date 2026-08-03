import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { parseISO } from 'date-fns'
import { PageHeader } from '@/components/PageHeader'
import { Button, Card, Chip, EmptyState, TableWrap, Td, Th } from '@/components/ui'
import { StatusBadge } from '@/components/StatusBadge'
import JobCalendar from '@/components/JobCalendar'
import { carName, clientName, jobTotal, statusLabel, useStore } from '@/data/store'
import { serviceDef } from '@/data/serviceCatalog'
import type { JobStatus } from '@/data/types'
import { fmtDateTime } from '@/lib/utils'
import { IconChevronRight, IconPlus, IconSearch } from '@/components/Icons'
import { useMoney } from '@/components/Money'

const FILTERS: { key: JobStatus | 'toate'; label: string }[] = [
  { key: 'toate', label: 'Toate' },
  { key: 'programat', label: 'Programate' },
  { key: 'in_lucru', label: 'În lucru' },
  { key: 'asteapta_piese', label: 'Așteaptă piese' },
  { key: 'finalizat', label: 'Finalizate' },
  { key: 'predat', label: 'Predate' },
]

export default function JobsPage() {
  const { fmt } = useMoney()
  const nav = useNavigate()
  const { jobs, clients, cars } = useStore()
  const [view, setView] = useState<'calendar' | 'lista'>('calendar')
  const [filter, setFilter] = useState<JobStatus | 'toate'>('toate')
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return jobs
      .filter((j) => (filter === 'toate' ? true : j.status === filter))
      .filter((j) => {
        if (!s) return true
        const client = clients.find((c) => c.id === j.clientId)
        const car = cars.find((c) => c.id === j.carId)
        return [j.code, clientName(client), carName(car), car?.plate, j.assignee]
          .join(' ')
          .toLowerCase()
          .includes(s)
      })
      .sort((a, b) => b.startAt.localeCompare(a.startAt))
  }, [jobs, clients, cars, filter, q])

  return (
    <>
      <PageHeader
        title="Programări"
        subtitle={`${filtered.length} din ${jobs.length} programări`}
        action={
          <>
            <div className="flex gap-1.5">
              <Chip active={view === 'calendar'} onClick={() => setView('calendar')}>
                Calendar
              </Chip>
              <Chip active={view === 'lista'} onClick={() => setView('lista')}>
                Listă
              </Chip>
            </div>
            <Button variant="primary" onClick={() => nav('/programari/nou')}>
              <IconPlus width={16} height={16} /> Programare nouă
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const count =
            f.key === 'toate' ? jobs.length : jobs.filter((j) => j.status === f.key).length
          return (
            <Chip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label} <span className="ml-1 font-mono text-[11px] opacity-70">{count}</span>
            </Chip>
          )
        })}
        <div className="relative ml-auto">
          <IconSearch
            width={15}
            height={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-faint"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filtrează…"
            className="w-56 rounded-lg border border-line-strong bg-ink-750 py-1.5 pr-3 pl-8 text-[13px] outline-none focus:border-brand-500/60"
          />
        </div>
      </div>

      {view === 'calendar' ? (
        <JobCalendar jobs={filtered.filter((j) => j.status !== 'anulat')} />
      ) : (
        <Card pad={false}>
          {filtered.length === 0 ? (
            <EmptyState
              text="Nicio programare pentru filtrele curente."
              action={
                <Link to="/programari/nou">
                  <Button variant="primary">Programare nouă</Button>
                </Link>
              }
            />
          ) : (
            <TableWrap>
              <thead className="border-b border-line">
                <tr>
                  <Th>Cod</Th>
                  <Th>Client</Th>
                  <Th>Mașină</Th>
                  <Th>Servicii</Th>
                  <Th>Primire</Th>
                  <Th>Execuție</Th>
                  <Th>Total</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((j) => {
                  const client = clients.find((c) => c.id === j.clientId)
                  const car = cars.find((c) => c.id === j.carId)
                  return (
                    <tr
                      key={j.id}
                      onClick={() => nav(`/programari/${j.id}`)}
                      className="cursor-pointer border-b border-line/70 transition last:border-0 hover:bg-black/[0.035]"
                    >
                      <Td className="font-mono text-[12.5px] text-brand-400">{j.code}</Td>
                      <Td className="font-semibold">{clientName(client)}</Td>
                      <Td>
                        <div>{carName(car)}</div>
                        <div className="font-mono text-[11px] text-fg-faint">{car?.plate}</div>
                      </Td>
                      <Td className="text-fg-mute">
                        {j.services.map((s) => serviceDef(s.kind).label).join(', ') || '—'}
                      </Td>
                      <Td className="text-fg-mute">{fmtDateTime(j.startAt)}</Td>
                      <Td className="text-fg-mute">
                        {j.workStartAt ? (
                          <>
                            <div>{fmtDateTime(j.workStartAt)}</div>
                            <div className="font-mono text-[11px] text-fg-faint">
                              {(j.estimateMin / 60).toFixed(1)} h estimat
                            </div>
                          </>
                        ) : (
                          '—'
                        )}
                      </Td>
                      <Td className="font-mono">{fmt(jobTotal(j))}</Td>
                      <Td>
                        <StatusBadge status={j.status} />
                      </Td>
                      <Td className="text-fg-faint">
                        <IconChevronRight width={16} height={16} />
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </TableWrap>
          )}
        </Card>
      )}

      {view === 'calendar' && (
        <div className="mt-4 flex flex-wrap items-center gap-4 text-[12px] text-fg-faint">
          <span>Dublu-click pe zi = programare nouă.</span>
          <span className="flex items-center gap-3">
            {(['programat', 'in_lucru', 'asteapta_piese', 'finalizat'] as JobStatus[]).map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <StatusBadge status={s} />
              </span>
            ))}
          </span>
          <span className="ml-auto">
            Următoarea:{' '}
            {(() => {
              const next = [...jobs]
                .filter((j) => parseISO(j.startAt) > new Date() && j.status !== 'anulat')
                .sort((a, b) => a.startAt.localeCompare(b.startAt))[0]
              return next
                ? `${next.code} · ${fmtDateTime(next.startAt)} · ${statusLabel(next.status)}`
                : '—'
            })()}
          </span>
        </div>
      )}
    </>
  )
}
