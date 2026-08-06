import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { differenceInMinutes, format } from 'date-fns'
import { Sheet } from '@/components/ui/Sheet'
import { Stepper } from '@/components/ui/Stepper'
import { Button } from '@/components/ui'
import { StatusBadge } from '@/components/StatusBadge'
import { IconPhone, IconPlay, IconStop } from '@/components/Icons'
import { useStore } from '@/data/store'
import type { CalEvent } from './useCalendarEvents'

const toTimeInput = (d: Date) => format(d, 'HH:mm')

export function EventSheet({ event, onClose }: { event: CalEvent | null; onClose: () => void }) {
  const nav = useNavigate()
  const { jobs, clients, updateJob, startExecution, finishExecution, toast } = useStore()

  const [moving, setMoving] = useState(false)
  const [time, setTime] = useState('09:00')
  const [duration, setDuration] = useState(30)

  const job = event?.jobId ? jobs.find((j) => j.id === event.jobId) : undefined
  const client = job ? clients.find((c) => c.id === job.clientId) : undefined

  useEffect(() => {
    if (!event) return
    setMoving(false)
    setTime(toTimeInput(event.start))
    setDuration(Math.max(15, differenceInMinutes(event.end, event.start)))
  }, [event])

  if (!event) return null

  if (event.kind === 'timeoff')
    return (
      <Sheet open onClose={onClose} title={event.title} subtitle="Concediu">
        <Button
          className="min-h-[44px] w-full"
          onClick={() => {
            onClose()
            nav('/concedii')
          }}
        >
          Deschide concediile
        </Button>
      </Sheet>
    )

  const primire = event.kind === 'primire'

  /** Aceleași scrieri ca pe desktop; „Mută" e alternativa la drag, nu o cale paralelă. */
  const saveMove = () => {
    if (!job) return
    const [h, m] = time.split(':').map(Number)
    const start = new Date(event.start)
    start.setHours(h, m, 0, 0)

    if (primire) {
      updateJob(job.id, { startAt: start.toISOString(), durationMin: duration })
      toast(`Primire mutată la ${format(start, 'dd.MM HH:mm')}`)
    } else {
      const end = new Date(start.getTime() + duration * 60_000)
      updateJob(job.id, {
        workStartAt: start.toISOString(),
        workEndAt: end.toISOString(),
        estimateMin: duration,
        estimateManual: true,
      })
      toast(`Execuție mutată la ${format(start, 'dd.MM HH:mm')}`)
    }
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={event.title}
      subtitle={[event.plate, event.code].filter(Boolean).join(' · ')}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          {job && <StatusBadge status={job.status} />}
          <span className="font-mono text-[12px] text-fg-mute">
            {primire ? 'PRIMIRE' : 'EXECUȚIE'} · {format(event.start, 'HH:mm')} –{' '}
            {format(event.end, 'HH:mm')}
          </span>
        </div>

        <dl className="space-y-1.5 text-[13px]">
          <Row label="Client" value={event.client} />
          <Row label="Servicii" value={event.services || '—'} />
          <Row label="Operator" value={event.assignee || '—'} />
          {job?.workStartAt && (
            <Row
              label="Execuție"
              value={`${format(new Date(job.workStartAt), 'dd.MM HH:mm')} · ${(job.estimateMin / 60).toFixed(1)} h`}
            />
          )}
        </dl>

        <div className="space-y-2">
          <Button
            variant="primary"
            className="min-h-[44px] w-full"
            onClick={() => {
              onClose()
              nav(`/programari/${event.jobId}`)
            }}
          >
            Deschide fișa
          </Button>

          {job?.status === 'programat' && (
            <Button
              className="min-h-[44px] w-full"
              onClick={() => {
                startExecution(job.id)
                onClose()
              }}
            >
              <IconPlay width={16} height={16} /> Începe
            </Button>
          )}
          {job?.status === 'in_lucru' && (
            <Button
              className="min-h-[44px] w-full"
              onClick={() => {
                finishExecution(job.id)
                onClose()
              }}
            >
              <IconStop width={16} height={16} /> Finalizează
            </Button>
          )}

          {client?.phone && (
            <a href={`tel:${client.phone}`} className="block">
              <Button className="min-h-[44px] w-full">
                <IconPhone width={16} height={16} /> Sună clientul
              </Button>
            </a>
          )}

          {!moving ? (
            <Button className="min-h-[44px] w-full" onClick={() => setMoving(true)}>
              Mută
            </Button>
          ) : (
            <div className="space-y-3 rounded-lg border border-line p-3">
              <label className="block">
                <span className="mono-label">Ora de început</span>
                <input
                  type="time"
                  step={900}
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line-strong bg-ink-750 px-3 py-2.5 text-[16px] outline-none focus:border-brand-500/60"
                />
              </label>
              <div>
                <span className="mono-label">Durată</span>
                <div className="mt-1">
                  <Stepper value={duration} onChange={setDuration} step={15} min={15} unit="min" />
                </div>
              </div>
              <Button variant="primary" className="min-h-[44px] w-full" onClick={saveMove}>
                Salvează
              </Button>
            </div>
          )}
        </div>
      </div>
    </Sheet>
  )
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex gap-3">
    <dt className="w-24 flex-none text-fg-faint">{label}</dt>
    <dd className="min-w-0 flex-1 font-semibold">{value}</dd>
  </div>
)
