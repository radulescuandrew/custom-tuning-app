import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, isSameDay, parseISO } from 'date-fns'
import { ro } from 'date-fns/locale'
import {
  canSeeTimeOff,
  carName,
  clientName,
  useCurrentUser,
  useStore,
} from '@/data/store'
import { serviceDef } from '@/data/serviceCatalog'
import { StatusBadge } from '@/components/StatusBadge'
import { Button, EmptyState } from '@/components/ui'
import { IconPlay, IconStop } from '@/components/Icons'
import type { Job } from '@/data/types'

/** Ora la care lucrarea „intră în zi”: execuția planificată, altfel primirea. */
const jobHour = (j: Job) => j.workStartAt ?? j.startAt

export default function AziPage() {
  const nav = useNavigate()
  const { jobs, cars, clients, startExecution, finishExecution } = useStore()
  const me = useCurrentUser()
  const seesAll = canSeeTimeOff(me?.role)

  const today = useMemo(() => {
    const now = new Date()
    return jobs
      .filter((j) => j.status !== 'anulat')
      .filter((j) => (seesAll ? true : j.assignee === me?.name))
      .filter((j) =>
        [j.startAt, j.workStartAt, j.actualStartAt].some(
          (iso) => iso && isSameDay(parseISO(iso), now),
        ),
      )
      .sort((a, b) => jobHour(a).localeCompare(jobHour(b)))
  }, [jobs, me?.name, seesAll])

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-extrabold">
          {seesAll ? 'Azi în atelier' : `Salut, ${me?.name?.split(' ')[0] ?? ''}`}
        </h1>
        <p className="mono-label mt-0.5">
          {format(new Date(), 'EEEE, d MMMM', { locale: ro })} · {today.length} lucrări
        </p>
      </header>

      {today.length === 0 && <EmptyState text="Nicio lucrare pentru azi." />}

      <ul className="flex flex-col gap-2">
        {today.map((j) => {
          const car = cars.find((c) => c.id === j.carId)
          const client = clients.find((c) => c.id === j.clientId)
          return (
            <li key={j.id} className="rounded-xl border border-line bg-ink-850 p-4">
              <button onClick={() => nav(`/programari/${j.id}`)} className="w-full text-left">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[13px] font-bold text-brand-500">
                        {format(parseISO(jobHour(j)), 'HH:mm')}
                      </span>
                      <span className="truncate text-[15px] font-bold">{carName(car)}</span>
                    </div>
                    <div className="mt-0.5 font-mono text-[12px] text-fg-mute">
                      {car?.plate} · {clientName(client)}
                    </div>
                    <div className="mt-1 text-[12px] text-fg-faint">
                      {j.services.map((s) => serviceDef(s.kind).short).join(' · ') || '—'}
                    </div>
                  </div>
                  <StatusBadge status={j.status} />
                </div>
              </button>

              {j.status === 'programat' && (
                <Button
                  variant="primary"
                  className="mt-3 min-h-[44px] w-full"
                  onClick={() => startExecution(j.id)}
                >
                  <IconPlay width={16} height={16} /> Începe
                </Button>
              )}
              {j.status === 'in_lucru' && (
                <Button
                  className="mt-3 min-h-[44px] w-full"
                  onClick={() => finishExecution(j.id)}
                >
                  <IconStop width={16} height={16} /> Finalizează
                </Button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
