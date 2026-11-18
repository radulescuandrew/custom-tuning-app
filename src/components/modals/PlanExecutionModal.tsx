import { useMemo, useState } from 'react'
import { Button, Field, Input, Modal } from '@/components/ui'
import type { Job } from '@/data/types'
import { useStore } from '@/data/store'
import { estimateRounded } from '@/data/serviceCatalog'
import { findFreeSlots } from '@/lib/slots'
import { cx, fmtDateTime, toLocalInput } from '@/lib/utils'

/**
 * Planificarea execuției, separat de restul programării: start, durată, ridicare estimată.
 * Ridicarea se propune la finalul execuției până când e schimbată de mână.
 */
export default function PlanExecutionModal({ job, onClose }: { job: Job; onClose: () => void }) {
  const { jobs, timeOff, cars, settings, updateJob, logEvent, toast } = useStore()
  const car = cars.find((c) => c.id === job.carId)
  const suggested = estimateRounded(
    job.services.map((s) => s.kind),
    settings,
    car?.bodyType,
  )

  const [start, setStart] = useState(job.workStartAt ? toLocalInput(job.workStartAt) : '')
  const [estimate, setEstimate] = useState(job.estimateMin || suggested)
  const [delivery, setDelivery] = useState(job.deliveryAt ? job.deliveryAt.slice(0, 10) : '')
  /** ridicarea urmează finalul execuției până o schimbi de mână */
  const [deliveryTouched, setDeliveryTouched] = useState(Boolean(job.deliveryAt))

  const end = start ? new Date(new Date(start).getTime() + estimate * 60_000) : null
  const deliveryValue = deliveryTouched ? delivery : end ? toLocalInput(end.toISOString()).slice(0, 10) : ''

  /** intervale libere, fără lucrarea curentă (altfel s-ar bloca singură) */
  const slots = useMemo(
    () => findFreeSlots(jobs.filter((j) => j.id !== job.id), timeOff, estimate),
    [jobs, job.id, timeOff, estimate],
  )

  const save = () => {
    updateJob(job.id, {
      workStartAt: end ? new Date(start).toISOString() : null,
      workEndAt: end ? end.toISOString() : null,
      estimateMin: estimate,
      estimateManual: estimate !== suggested,
      deliveryAt: deliveryValue ? new Date(deliveryValue).toISOString() : null,
    })
    if (end)
      logEvent(
        job.id,
        'plan',
        job.workStartAt ? 'Execuție replanificată' : 'Execuție planificată',
        `${fmtDateTime(new Date(start).toISOString())} → ${fmtDateTime(end.toISOString())} · ${(estimate / 60).toFixed(1)} h`,
      )
    else if (job.workStartAt) logEvent(job.id, 'plan', 'Planificarea execuției a fost ștearsă')
    toast(end ? `Execuție planificată: ${fmtDateTime(new Date(start).toISOString())}` : 'Execuție neplanificată')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Planifică execuția"
      subtitle={`${job.code} · se poate stabili oricând după programare`}
      width="max-w-xl"
      footer={
        <>
          <Button onClick={onClose}>Renunță</Button>
          <Button variant="primary" onClick={save}>
            {start ? 'Planifică' : 'Salvează fără planificare'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Start execuție">
            <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field
            label="Timp de lucru estimat (min)"
            hint={`Sugestie din servicii: ${(suggested / 60).toFixed(1)} h`}
          >
            <div className="flex gap-2">
              <Input
                type="number"
                step={15}
                value={estimate}
                onChange={(e) => setEstimate(Number(e.target.value))}
              />
              {estimate !== suggested && (
                <Button variant="ghost" className="flex-none" onClick={() => setEstimate(suggested)}>
                  auto
                </Button>
              )}
            </div>
          </Field>
        </div>

        {slots.length > 0 && (
          <div>
            <div className="mono-label mb-2">Intervale libere</div>
            <div className="flex flex-wrap gap-2">
              {slots.map((sl) => {
                const v = toLocalInput(sl.start.toISOString())
                return (
                  <button
                    key={v}
                    onClick={() => setStart(v)}
                    className={cx(
                      'rounded-lg border px-3 py-1.5 font-mono text-[12px] transition',
                      v === start
                        ? 'border-brand-500/50 bg-brand-500/12 text-brand-500'
                        : 'border-line bg-ink-750/60 text-fg-mute hover:text-fg',
                    )}
                  >
                    {fmtDateTime(sl.start.toISOString())}
                    {sl.days > 1 && ` · ${sl.days} zile`}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <Field
          label="Ridicare estimată"
          hint={
            deliveryTouched
              ? 'Apare clientului pe tracking.'
              : 'Propusă la finalul execuției — o poți schimba. Apare clientului pe tracking.'
          }
        >
          <Input
            type="date"
            value={deliveryValue}
            onChange={(e) => {
              setDelivery(e.target.value)
              setDeliveryTouched(true)
            }}
          />
        </Field>

        <p className="rounded-lg bg-ink-750/60 px-3 py-2.5 text-[13px] text-fg-mute">
          {end ? (
            <>
              Execuție{' '}
              <strong className="font-mono text-fg">
                {fmtDateTime(new Date(start).toISOString())} → {fmtDateTime(end.toISOString())}
              </strong>{' '}
              ({(estimate / 60).toFixed(1)} h)
            </>
          ) : (
            'Alege startul execuției sau un interval liber.'
          )}
        </p>
      </div>
    </Modal>
  )
}
