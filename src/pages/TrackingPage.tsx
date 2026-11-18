import { Link, useParams } from 'react-router-dom'
import { jobReceivedAt, carName, jobTotal, useStore } from '@/data/store'
import { serviceLabel } from '@/data/serviceCatalog'
import { cx, fmtDate, fmtDateTime } from '@/lib/utils'
import { useMoney, VatHint } from '@/components/Money'
import { useEffect, useState } from 'react'
import type { JobPhoto } from '@/data/types'
import { photoUrl } from '@/lib/photos'

/** Pozele marcate „vizibile clientului” în fișa lucrării. */
function ClientPhotos({ photos, title = 'Poze lucrare' }: { photos: JobPhoto[]; title?: string }) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  useEffect(() => {
    let alive = true
    Promise.all(photos.map(async (p) => [p.id, await photoUrl(p.key)] as const)).then(
      (r) => alive && setUrls(Object.fromEntries(r)),
    )
    return () => {
      alive = false
    }
  }, [photos])
  if (photos.length === 0) return null
  return (
    <div className={title ? 'mb-6 border-t border-line pt-5' : ''}>
      {title && <div className="mono-label mb-3">{title}</div>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((p) => (
          <figure key={p.id} className="overflow-hidden rounded-xl border border-line bg-ink-900">
            {urls[p.id] ? (
              <a href={urls[p.id]} target="_blank" rel="noreferrer">
                <img src={urls[p.id]} alt={p.caption || p.name} className="aspect-[4/3] w-full object-cover" />
              </a>
            ) : (
              <div className="aspect-[4/3]" />
            )}
            {p.caption && (
              <figcaption className="px-2.5 py-2 text-[12px] text-fg-mute">{p.caption}</figcaption>
            )}
          </figure>
        ))}
      </div>
    </div>
  )
}

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
  /**
   * Etapele văzute de client. „Mașina în atelier” nu e un status, ci primirea confirmată:
   * separă „am lăsat mașina” de „se lucrează la ea”. „Blocat” apare doar când chiar e blocată.
   */
  const receivedAt = jobReceivedAt(job)
  const currentKey =
    job.status === 'programat' ? (receivedAt ? 'in_atelier' : 'programat') : job.status
  const stepKeys = [
    'programat',
    'in_atelier',
    'in_lucru',
    ...(job.status === 'blocat' ? ['blocat'] : []),
    'finalizat',
    'predat',
  ]
  const curIdx = stepKeys.indexOf(currentKey)
  const STEP_LABEL: Record<string, string> = {
    programat: 'Programat',
    in_atelier: 'Mașina în atelier',
    in_lucru: 'În lucru',
    blocat: 'În pauză',
    finalizat: 'Gata de ridicat',
    predat: 'Predată',
  }
  const stepText = (key: string, state: 'done' | 'current' | 'next') => {
    switch (key) {
      case 'programat':
        return state === 'current'
          ? `Te așteptăm cu mașina pe ${fmtDateTime(job.startAt)}.`
          : `Programare confirmată pentru ${fmtDate(job.startAt)}.`
      case 'in_atelier':
        return state === 'next'
          ? `Ne aduci mașina pe ${fmtDate(job.startAt)}.`
          : `Ai lăsat mașina în atelier pe ${fmtDate(receivedAt)}.`
      case 'in_lucru':
        return state === 'current'
          ? 'Lucrăm acum la mașina ta.'
          : state === 'done'
            ? 'Lucrările au fost executate.'
            : job.workStartAt
              ? `Lucrul e planificat să înceapă pe ${fmtDate(job.workStartAt)}.`
              : 'Te anunțăm când începem lucrul.'
      case 'blocat':
        return job.blockedReason
          ? `Lucrarea e în pauză: ${job.blockedReason}.`
          : 'Lucrarea e în pauză (piese sau materiale).'
      case 'finalizat':
        return state === 'current'
          ? 'Mașina e gata! Te așteptăm s-o ridici din atelier, L–V 09:00–18:00.'
          : state === 'done'
            ? 'Lucrarea a fost finalizată.'
            : 'Te anunțăm când mașina e gata de ridicat.'
      default:
        return state === 'current' ? 'Ai ridicat mașina. Mulțumim!' : 'Ridici mașina din atelier.'
    }
  }
  /** lucrarea finalizată / predată are toate serviciile gata, chiar dacă nu au fost bifate pe rând */
  const allDone = job.status === 'finalizat' || job.status === 'predat'
  const isDone = (svc: { done: boolean }) => allDone || svc.done

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
          {job.services.map((s) => serviceLabel(s)).join(' + ')} · {car?.plate}
        </p>

        {job.status === 'finalizat' && (
          <div className="mt-5 rounded-xl border border-mint/30 bg-mint/10 px-4 py-3">
            <div className="font-bold text-mint">Mașina ta e gata de ridicat</div>
            <div className="mt-0.5 text-[13px] text-fg-mute">
              Te așteptăm în atelier, de luni până vineri, 09:00–18:00.
            </div>
          </div>
        )}

        <ol className="mt-7 flex flex-col gap-0">
          {stepKeys.map((key, i) => {
            const state = curIdx < 0 ? 'next' : i < curIdx ? 'done' : i === curIdx ? 'current' : 'next'
            const current = state === 'current'
            const done = state !== 'next'
            return (
              <li key={key} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span
                    className={cx(
                      'flex h-7 w-7 items-center justify-center rounded-full border text-[12px] font-bold',
                      current
                        ? key === 'blocat'
                          ? 'border-ember bg-ember text-white'
                          : 'border-brand-500 bg-brand-500 text-white'
                        : done
                          ? 'border-mint/50 bg-mint/15 text-mint'
                          : 'border-line-strong text-fg-faint',
                    )}
                  >
                    {done && !current ? '✓' : i + 1}
                  </span>
                  {i < stepKeys.length - 1 && (
                    <span className={cx('w-px flex-1', state === 'done' ? 'bg-mint/40' : 'bg-line')} />
                  )}
                </div>
                <div className="pb-6">
                  <div
                    className={cx(
                      'text-sm font-bold',
                      current ? (key === 'blocat' ? 'text-ember' : 'text-brand-400') : done ? '' : 'text-fg-mute',
                    )}
                  >
                    {STEP_LABEL[key]}
                  </div>
                  <div className="text-[12.5px] text-fg-faint">{stepText(key, state)}</div>
                </div>
              </li>
            )
          })}
        </ol>

        {job.actualStartAt && job.services.length > 0 && (
          <div className="mb-6 border-t border-line pt-5">
            <div className="mono-label mb-3">
              Servicii · {job.services.filter(isDone).length} din {job.services.length} gata
            </div>
            <ul className="flex flex-col gap-4">
              {job.services.map((svc) => {
                const photos = job.photos.filter((p) => p.serviceId === svc.id && p.public !== false)
                return (
                  <li key={svc.id} className="rounded-xl border border-line p-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={cx(
                          'flex h-6 w-6 flex-none items-center justify-center rounded-full text-[12px] font-bold',
                          isDone(svc) ? 'bg-mint text-white' : 'border border-line-strong text-fg-faint',
                        )}
                      >
                        {isDone(svc) ? '✓' : '…'}
                      </span>
                      <span className="flex-1 font-semibold">{serviceLabel(svc)}</span>
                      <span className={cx('text-[12px]', isDone(svc) ? 'text-mint' : 'text-fg-faint')}>
                        {isDone(svc) ? (svc.doneAt ? `gata · ${fmtDate(svc.doneAt)}` : 'gata') : 'în lucru'}
                      </span>
                    </div>
                    {isDone(svc) && svc.doneNote && (
                      <p className="mt-2 pl-9 text-[13px] text-fg-mute">{svc.doneNote}</p>
                    )}
                    {photos.length > 0 && (
                      <div className="mt-3 pl-9">
                        <ClientPhotos photos={photos} title="" />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <ClientPhotos
          photos={job.photos.filter((p) => p.public !== false && !p.serviceId)}
          title="Poze la primire"
        />

        <div className="grid grid-cols-1 gap-4 border-t border-line pt-5 sm:grid-cols-3">
          <div>
            <div className="mono-label">Gata de ridicat (estimat)</div>
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
