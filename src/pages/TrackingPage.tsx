import { Link, useParams } from 'react-router-dom'
import { STATUS_FLOW, carName, jobTotal, statusLabel, useStore } from '@/data/store'
import { serviceDef } from '@/data/serviceCatalog'
import { cx, fmtDate } from '@/lib/utils'
import { useMoney, VatHint } from '@/components/Money'

export default function TrackingPage() {
  const { fmt } = useMoney()
  const { token = '' } = useParams()
  const { jobs, cars } = useStore()
  const job = jobs.find((j) => j.trackingToken === token)

  if (!job)
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-fg-mute">Link invalid sau expirat.</p>
          <Link to="/" className="mt-3 inline-block text-sm text-brand-400">
            Înapoi în aplicație
          </Link>
        </div>
      </div>
    )

  const car = cars.find((c) => c.id === job.carId)
  const idx = STATUS_FLOW.indexOf(job.status)

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col px-5 py-10">
      <header className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-gradient-to-br from-brand-500 to-brand-600 text-[18px] font-extrabold text-white">
          CT
        </div>
        <div>
          <div className="font-bold">Custom Tuning</div>
          <div className="mono-label">Status lucrare</div>
        </div>
        <Link to="/programari" className="ml-auto text-[12.5px] text-fg-faint hover:text-brand-400">
          ← înapoi (demo)
        </Link>
      </header>

      <div className="rounded-2xl border border-line bg-ink-850 p-6">
        <div className="mono-label">Comanda {job.code}</div>
        <h1 className="mt-1 text-2xl font-extrabold">{carName(car)}</h1>
        <p className="mt-1 text-[13px] text-fg-mute">
          {job.services.map((s) => serviceDef(s.kind).label).join(' + ')} · {car?.plate}
        </p>

        <ol className="mt-7 flex flex-col gap-0">
          {STATUS_FLOW.map((s, i) => {
            const done = idx >= 0 && i <= idx
            const current = job.status === s
            return (
              <li key={s} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span
                    className={cx(
                      'flex h-7 w-7 items-center justify-center rounded-full border text-[12px] font-bold',
                      current
                        ? 'border-brand-500 bg-brand-500 text-white'
                        : done
                          ? 'border-mint/50 bg-mint/15 text-mint'
                          : 'border-line-strong text-fg-faint',
                    )}
                  >
                    {done && !current ? '✓' : i + 1}
                  </span>
                  {i < STATUS_FLOW.length - 1 && (
                    <span className={cx('w-px flex-1', done ? 'bg-mint/40' : 'bg-line')} />
                  )}
                </div>
                <div className="pb-6">
                  <div className={cx('text-sm font-bold', current ? 'text-brand-400' : done ? '' : 'text-fg-mute')}>
                    {statusLabel(s)}
                  </div>
                  <div className="text-[12.5px] text-fg-faint">
                    {s === 'programat' && `Programat pentru ${fmtDate(job.startAt)}`}
                    {s === 'in_lucru' && 'Mașina este în atelier.'}
                    {s === 'asteapta_piese' && 'Așteptăm piese / materiale.'}
                    {s === 'finalizat' && 'Lucrarea este gata, urmează verificarea finală.'}
                    {s === 'predat' && 'Mașina a fost predată.'}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>

        <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
          <div>
            <div className="mono-label">Predare estimată</div>
            <div className="mt-1 font-semibold">{fmtDate(job.deliveryAt)}</div>
          </div>
          <div>
            <div className="mono-label">Responsabil</div>
            <div className="mt-1 font-semibold">{job.assignee}</div>
          </div>
          <div>
            <div className="mono-label">Total lucrare</div>
            <div className="mt-1 font-semibold text-brand-400">{fmt(jobTotal(job))}</div>
            <VatHint />
          </div>
        </div>
      </div>

      <p className="mt-6 text-center text-[12.5px] text-fg-faint">
        Ai întrebări? Sună-ne la 0722 000 000 · Custom Tuning
      </p>
    </div>
  )
}
