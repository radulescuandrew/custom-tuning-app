import { useState } from 'react'
import { differenceInMinutes, isSameDay, parseISO } from 'date-fns'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Card, Field, Input, Modal, Select, Textarea } from '@/components/ui'
import { StatusBadge } from '@/components/StatusBadge'
import ServiceForm from '@/components/ServiceForm'
import PhotoGrid from '@/components/PhotoGrid'
import {
  NOTIF_KIND_LABEL,
  STATUS_FLOW,
  jobReceivedAt,
  carName,
  clientName,
  jobTotal,
  pickupMessage,
  statusLabel,
  useStore,
} from '@/data/store'
import {
  activeServices,
  servicePrice,
  effectiveCarClass,
  estimateRounded,
  rollFields,
  serviceDef,
  serviceLabel,
} from '@/data/serviceCatalog'
import FinishFoilModal from '@/components/modals/FinishFoilModal'
import ServiceDoneModal from '@/components/modals/ServiceDoneModal'
import PlanExecutionModal from '@/components/modals/PlanExecutionModal'
import type { JobStatus, NotificationChannel, ServiceEntry, ServiceKind } from '@/data/types'
import { addBusinessDays, cx, fmtDate, fmtDateTime, toLocalInput, uid } from '@/lib/utils'
import { Money, TotalBreakdown } from '@/components/Money'
import { DOCS, docNumber } from '@/lib/documents'
import { IconLink, IconMail, IconPhone, IconPlus, IconPrint, IconTrash } from '@/components/Icons'

/** Motivele uzuale pentru „Blocat” (oferta: lipsă materiale sau alte cazuri similare). */
const BLOCK_REASONS = [
  'Așteaptă piese',
  'Lipsă materiale',
  'Așteaptă acordul clientului',
  'Defect ascuns descoperit',
]

export default function JobDetailPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const {
    jobs,
    clients,
    cars,
    stock,
    notifications,
    updateJob,
    removeJob,
    setJobStatus,
    applyRollUsages,
    markReceived,
    startExecution,
    finishExecution,
    addJobPhoto,
    removeJobPhoto,
    updateJobPhoto,
    completeService,
    reopenService,
    markNotificationSent,
    schedulePickup,
    markRetouchDone,
    logEvent,
    settings,
    toast,
  } = useStore()

  const job = jobs.find((j) => j.id === id)
  const [openSvc, setOpenSvc] = useState<string | null>(null)
  /** cardurile de servicii strânse; cele deja finalizate pornesc strânse */
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(jobs.find((j) => j.id === id)?.services.filter((x) => x.done).map((x) => x.id) ?? []),
  )
  const toggleCollapsed = (sid: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(sid)) next.delete(sid)
      else next.add(sid)
      return next
    })
  const [editMeta, setEditMeta] = useState(false)
  /** istoricul arată ultimele evenimente; restul la cerere */
  const [allHistory, setAllHistory] = useState(false)
  /** fereastra dedicată „Planifică execuția” (fără câmpurile de primire) */
  const [planOpen, setPlanOpen] = useState(false)
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [addSvc, setAddSvc] = useState(false)
  /** modalul „Anunți clientul?” — apare la Finalizat când anunțarea nu e automată */
  const [pickup, setPickup] = useState<{ message: string; channel: NotificationChannel } | null>(null)
  /** serviciul pentru care se adaugă poze la finalizare */
  const [doneSvc, setDoneSvc] = useState<string | null>(null)
  /** modalul „De ce e blocată lucrarea?” */
  const [block, setBlock] = useState<string | null>(null)

  if (!job)
    return (
      <Card>
        <p className="text-sm text-fg-mute">Programarea nu există.</p>
        <Button className="mt-4" onClick={() => nav('/programari')}>
          Înapoi la programări
        </Button>
      </Card>
    )

  const client = clients.find((c) => c.id === job.clientId)
  const car = cars.find((c) => c.id === job.carId)
  const jobNotifs = notifications.filter((n) => n.jobId === job.id)
  const pendingUsages = job.services.flatMap((s) =>
    s.rollUsages.filter((u) => !u.appliedAt && u.stockItemId && u.qty > 0),
  )

  const patchService = (sid: string, patch: Partial<ServiceEntry>) =>
    updateJob(job.id, {
      services: job.services.map((s) => (s.id === sid ? { ...s, ...patch } : s)),
    })

  const needsRetouch = job.services.some((s) => serviceDef(s.kind).retouch)
  /** primirea reală a mașinii (null = încă nu a ajuns) */
  const receivedAt = jobReceivedAt(job)
  /** serviciile se bifează individual doar după ce execuția a început */
  const canCompleteServices = Boolean(job.actualStartAt) && job.status !== 'anulat'
  const servicesDone = job.services.filter((x) => x.done).length
  const hasFoil = job.services.some((s) => rollFields(s.kind).length > 0)
  const retouchDeadline = job.handedOverAt
    ? addBusinessDays(new Date(job.handedOverAt), 7).toISOString()
    : null

  /** după Finalizat: dacă anunțarea nu e automată, propunem mesajul de ridicare (editabil) */
  const askPickup = () => {
    if (settings.pickupNotifyAuto) return
    const already = jobNotifs.some((n) => n.kind === 'ridicare' && n.status !== 'anulata')
    if (!already) setPickup({ message: pickupMessage(job, car), channel: 'sms' })
  }

  const changeStatus = (s: JobStatus) => {
    if (s === 'blocat' && job.status !== 'blocat') {
      setBlock(job.blockedReason ?? BLOCK_REASONS[0])
      return
    }
    // lucrările cu folie cer rola + metrii la finalizare (oferta)
    if (s === 'finalizat' && job.status !== 'finalizat' && hasFoil) {
      setConfirmFinish(true)
      return
    }
    setJobStatus(job.id, s)
    toast(`Status → ${statusLabel(s)}`)
    if (s === 'finalizat') askPickup()
  }

  /** services = fișele cu consumul completat în modal; null = finalizare fără consum */
  const finish = (services: ServiceEntry[] | null) => {
    if (services) {
      updateJob(job.id, { services })
      const n = applyRollUsages(job.id)
      if (n) toast(`${n} consum(uri) scăzute din stoc`, 'ok')
    }
    setJobStatus(job.id, 'finalizat')
    toast('Status → Finalizat')
    setConfirmFinish(false)
    askPickup()
  }

  const trackingUrl = `${location.origin}${location.pathname}#/tracking/${job.trackingToken}`

  const addService = (kind: ServiceKind) => {
    updateJob(job.id, {
      services: [
        ...job.services,
        {
          id: uid(),
          kind,
          values: {},
          elements: [],
          rollUsages: [],
          price: servicePrice(kind, settings),
          done: false,
        },
      ],
    })
    logEvent(job.id, 'service', `Serviciu adăugat: ${serviceDef(kind).label}`)
    setAddSvc(false)
  }

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Programări', to: '/programari' }, { label: job.code }]}
        title={`${carName(car)} · ${car?.plate ?? ''}`}
        subtitle={
          <>
            {clientName(client)} · {job.services.map((s) => serviceLabel(s)).join(' + ')} ·
            Responsabil: {job.assignee}
          </>
        }
        action={
          <>
            <StatusBadge status={job.status} />
            <Button onClick={() => setEditMeta(true)}>Editează</Button>
            <Button
              onClick={() => {
                navigator.clipboard?.writeText(trackingUrl)
                toast('Link tracking copiat')
              }}
            >
              <IconLink width={15} height={15} /> Link client
            </Button>
          </>
        }
      />

      {/* pipeline */}
      <Card className="mb-5" title="Status lucrare">
        <div className="flex flex-wrap gap-2">
          {STATUS_FLOW.map((s) => {
            const idx = STATUS_FLOW.indexOf(job.status)
            const done = STATUS_FLOW.indexOf(s) <= idx && idx >= 0
            return (
              <button
                key={s}
                onClick={() => changeStatus(s)}
                className={cx(
                  'flex-1 rounded-lg border px-3 py-2.5 text-[13px] font-semibold transition',
                  job.status === s
                    ? 'border-brand-500/60 bg-brand-500/14 text-brand-400'
                    : done
                      ? 'border-mint/30 bg-mint/8 text-mint'
                      : 'border-line bg-ink-750/60 text-fg-mute hover:text-fg',
                )}
              >
                {statusLabel(s)}
              </button>
            )
          })}
          <button
            onClick={() => changeStatus('anulat')}
            className="rounded-lg border border-line px-3 py-2.5 text-[13px] font-semibold text-fg-faint hover:border-rose/40 hover:text-rose"
          >
            Anulează
          </button>
        </div>
        {job.status === 'blocat' && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-ember/30 bg-ember/8 px-3 py-2 text-[13px]">
            <span className="font-semibold text-ember">Blocat:</span>
            <span>{job.blockedReason || 'motiv nespecificat'}</span>
            <button
              onClick={() => setBlock(job.blockedReason ?? BLOCK_REASONS[0])}
              className="ml-auto text-[12.5px] font-semibold text-brand-500 hover:underline"
            >
              schimbă motivul
            </button>
          </div>
        )}
        <p className="mt-3 text-[12.5px] text-fg-mute">
          {pendingUsages.length > 0 &&
            `La „Finalizat” se scad din stoc ${pendingUsages.length} consum(uri) de folie. `}
          „Finalizat” anunță clientul că poate ridica mașina
          {settings.pickupNotifyAuto ? ' (automat)' : ' (cu confirmare)'}.
          {needsRetouch &&
            ' „Predat” programează invitația la retuș pentru a doua zi și reminderul dacă nu vine în 7 zile lucrătoare.'}
        </p>
      </Card>

      {/* programare vs execuție */}
      <Card
        className="mb-5"
        title="Primire mașină & execuție"
        action={
          <div className="flex gap-2">
            {job.status === 'anulat' ? null : !receivedAt ? (
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  markReceived(job.id)
                  toast('Mașină primită — completează PV-ul de primire', 'info')
                }}
              >
                ✓ Mașina a fost primită
              </Button>
            ) : !job.actualStartAt ? (
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  startExecution(job.id)
                  toast('Execuție începută')
                }}
              >
                ▶ Începe execuția
              </Button>
            ) : !job.actualEndAt ? (
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  finishExecution(job.id)
                  changeStatus('finalizat')
                }}
              >
                ■ Finalizează execuția
              </Button>
            ) : (
              <Badge tone="mint">execuție încheiată</Badge>
            )}
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {receivedAt ? (
            <div className="rounded-lg border border-mint/30 bg-mint/6 p-4">
              <div className="mono-label">1 · Mașină primită</div>
              <div className="mt-2 text-[15px] font-bold">{fmtDateTime(receivedAt)}</div>
              <div className="mt-1 text-[12px] text-fg-mute">
                programată pentru {fmtDateTime(job.startAt)}
              </div>
              <button
                onClick={() => nav(`/documente/${job.id}/pv-primire`)}
                className="mt-2 text-[12.5px] font-semibold text-brand-500 hover:underline"
              >
                PV de primire →
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-line-strong p-4">
              <div className="mono-label">1 · Primire programată</div>
              <div className="mt-2 text-[15px] font-bold">{fmtDateTime(job.startAt)}</div>
              <div className="mt-1 text-[12px] text-fg-mute">
                slot {job.durationMin} min · mașina nu a ajuns încă
              </div>
              {parseISO(job.startAt) < new Date() && job.status !== 'anulat' && (
                <Badge tone="ember" className="mt-2">
                  întârziată
                </Badge>
              )}
            </div>
          )}

          {/* execuția: un singur bloc, care arată planul până la start și realul după */}
          {(() => {
            const h = (min: number) => (min / 60).toFixed(1)
            const stage = job.actualEndAt
              ? 'gata'
              : job.actualStartAt
                ? 'lucru'
                : job.workStartAt
                  ? 'planificata'
                  : 'neplanificata'
            const actualMin = job.actualStartAt
              ? differenceInMinutes(
                  job.actualEndAt ? parseISO(job.actualEndAt) : new Date(),
                  parseISO(job.actualStartAt),
                )
              : 0
            const over = actualMin > job.estimateMin
            const pct = Math.min(100, (actualMin / Math.max(1, job.estimateMin)) * 100)
            // progresul pe servicii contează doar cât se lucrează; după încheiere totul e gata
            const progress = job.services.length > 0 && stage === 'lucru' && (
              <span className="ml-1.5 text-mint">
                · {servicesDone}/{job.services.length} servicii
              </span>
            )
            return (
              <div
                className={cx(
                  'rounded-lg border p-4',
                  stage === 'gata'
                    ? 'border-mint/30 bg-mint/6'
                    : stage === 'lucru'
                      ? 'border-brand-500/30 bg-brand-500/6'
                      : stage === 'planificata'
                        ? 'border-line bg-ink-750/40'
                        : 'border-dashed border-line-strong',
                )}
              >
                <div className="mono-label">
                  2 ·{' '}
                  {stage === 'gata'
                    ? 'Execuție încheiată'
                    : stage === 'lucru'
                      ? 'Execuție în curs'
                      : stage === 'planificata'
                        ? 'Execuție planificată'
                        : 'Execuție neplanificată'}
                  {progress}
                </div>

                {stage === 'neplanificata' && (
                  <>
                    <div className="mt-2 text-[15px] font-bold">Încă nu are dată</div>
                    <div className="mt-1 text-[12px] text-fg-mute">
                      estimat {h(job.estimateMin)} h {job.estimateManual ? '(manual)' : '(din servicii)'}
                    </div>
                  </>
                )}

                {stage === 'planificata' && (
                  <>
                    <div className="mt-2 text-[15px] font-bold">
                      {fmtDateTime(job.workStartAt)}
                      {job.workEndAt && (
                        <span className="font-semibold text-fg-mute"> → {fmtDateTime(job.workEndAt)}</span>
                      )}
                    </div>
                    <div className="mt-1 text-[12px] text-fg-mute">
                      estimat {h(job.estimateMin)} h
                      {!isSameDay(parseISO(job.workStartAt!), parseISO(job.startAt)) &&
                        ' · în altă zi decât primirea'}
                    </div>
                  </>
                )}

                {stage === 'lucru' && (
                  <>
                    <div className="mt-2 text-[15px] font-bold">În lucru de {h(actualMin)} h</div>
                    <div className="mt-1 text-[12px] text-fg-mute">
                      început {fmtDateTime(job.actualStartAt)}
                      {job.workStartAt && ` · planificat ${fmtDateTime(job.workStartAt)}`}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.08]">
                        <div
                          className={cx('h-full rounded-full', over ? 'bg-ember' : 'bg-brand-500')}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={cx('font-mono text-[11px]', over ? 'text-ember' : 'text-fg-faint')}>
                        {h(actualMin)} / {h(job.estimateMin)} h
                      </span>
                    </div>
                  </>
                )}

                {stage === 'gata' && (
                  <>
                    <div className="mt-2 text-[15px] font-bold">
                      {fmtDateTime(job.actualStartAt)}
                      <span className="font-semibold text-fg-mute"> → {fmtDateTime(job.actualEndAt)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-fg-mute">
                      efectiv {h(actualMin)} h · estimat {h(job.estimateMin)} h
                      <Badge tone={over ? 'ember' : 'mint'}>{over ? 'peste estimare' : 'în estimare'}</Badge>
                    </div>
                  </>
                )}

                {(stage === 'neplanificata' || stage === 'planificata') && job.status !== 'anulat' && (
                  <button
                    onClick={() => setPlanOpen(true)}
                    className="mt-2 text-[12.5px] font-semibold text-brand-500 hover:underline"
                  >
                    {stage === 'planificata' ? 'modifică planificarea' : 'Planifică execuția →'}
                  </button>
                )}
              </div>
            )
          })()}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_330px]">
        <div className="flex flex-col gap-5">
          {job.services.map((svc) => {
            const def = serviceDef(svc.kind)
            const open = openSvc === svc.id
            const folded = collapsed.has(svc.id) && !open
            const checked = svc.elements.filter((e) => e.checked)
            return (
              <Card
                key={svc.id}
                pad={!folded}
                title={
                  <button
                    onClick={() => toggleCollapsed(svc.id)}
                    aria-expanded={!folded}
                    className="flex items-center gap-2 text-left"
                  >
                    <span
                      className={cx(
                        'inline-block w-3 text-[11px] text-fg-faint transition-transform',
                        !folded && 'rotate-90',
                      )}
                    >
                      ▸
                    </span>
                    <span className="h-2 w-2 rounded-full" style={{ background: def.accent }} />
                    {serviceLabel(svc)}
                    <Money value={svc.price} className="font-mono text-[11px] text-fg-faint" />
                    {svc.done && <Badge tone="mint">✓ finalizat</Badge>}
                  </button>
                }
                action={
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        updateJob(job.id, {
                          services: job.services.filter((s) => s.id !== svc.id),
                        })
                        logEvent(job.id, 'service', `Serviciu șters: ${serviceLabel(svc)}`)
                      }}
                      className="text-fg-faint hover:text-rose"
                    >
                      <IconTrash width={15} height={15} />
                    </button>
                    <button
                      onClick={() => {
                        setOpenSvc(open ? null : svc.id)
                        if (!open) setCollapsed((prev) => new Set([...prev].filter((x) => x !== svc.id)))
                      }}
                      className="text-[13px] font-semibold text-brand-400"
                    >
                      {open ? 'restrânge' : 'editează fișa'}
                    </button>
                  </div>
                }
              >
                {folded ? null : svc.done ? (
                  <div className="-mx-5 -mt-5 mb-4 flex flex-wrap items-center gap-2 border-b border-mint/25 bg-mint/8 px-5 py-2.5 text-[12.5px]">
                    <span className="font-semibold text-mint">✓ Serviciu finalizat</span>
                    {svc.doneAt && <span className="text-fg-mute">{fmtDateTime(svc.doneAt)}</span>}
                    <span className="ml-auto flex gap-3">
                      <button onClick={() => setDoneSvc(svc.id)} className="font-semibold text-brand-500 hover:underline">
                        + poze
                      </button>
                      <button
                        onClick={() => reopenService(job.id, svc.id)}
                        className="text-fg-faint hover:text-fg"
                      >
                        redeschide
                      </button>
                    </span>
                  </div>
                ) : (
                  canCompleteServices && (
                    <div className="-mx-5 -mt-5 mb-4 flex items-center gap-3 border-b border-line bg-ink-750/50 px-5 py-2.5">
                      <span className="flex-1 text-[12.5px] text-fg-mute">În lucru</span>
                      <Button size="sm" variant="primary" onClick={() => setDoneSvc(svc.id)}>
                        ✓ Serviciu finalizat
                      </Button>
                    </div>
                  )
                )}
                {folded ? null : open ? (
                  <ServiceForm
                    entry={svc}
                    stock={stock}
                    bodyType={car?.bodyType}
                    carClass={effectiveCarClass(car)}
                    onChange={(patch) => patchService(svc.id, patch)}
                  />
                ) : (
                  <div className="flex flex-col gap-3">
                    {!def.groups.some((g) => g.fields.some((f) => svc.values[f.key] && svc.values[f.key] !== '—')) &&
                      checked.length === 0 &&
                      !svc.doneNote &&
                      !job.photos.some((p) => p.serviceId === svc.id) && (
                        <p className="text-[13px] text-fg-mute">
                          Fișă necompletată.{' '}
                          <button
                            onClick={() => setOpenSvc(svc.id)}
                            className="font-semibold text-brand-500 hover:underline"
                          >
                            Completează detaliile
                          </button>
                        </p>
                      )}
                    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {def.groups
                        .flatMap((g) => g.fields)
                        .filter((f) => svc.values[f.key] && svc.values[f.key] !== '—')
                        .slice(0, 6)
                        .map((f) => {
                          const raw = svc.values[f.key]
                          const item = f.type === 'roll' ? stock.find((s) => s.id === raw) : null
                          return (
                            <div key={f.key}>
                              <dt className="mono-label">{f.label}</dt>
                              <dd className="text-[13px]">
                                {item ? `${item.maker} · rola #${item.rollNumber}` : raw}
                              </dd>
                            </div>
                          )
                        })}
                    </dl>
                    {checked.length > 0 && (
                      <div>
                        <div className="mono-label mb-1.5">Elemente ({checked.length})</div>
                        <div className="flex flex-wrap gap-1.5">
                          {checked.map((e) => (
                            <Badge key={e.id} tone="neutral">
                              {e.name}
                              {e.code ? ` · ${e.code}` : ''}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {svc.doneNote && (
                      <p className="rounded-lg bg-ink-750/60 px-3 py-2 text-[12.5px] text-fg-dim">
                        <span className="mono-label mr-1.5">Mesaj client</span>
                        {svc.doneNote}
                      </p>
                    )}
                    {job.photos.some((p) => p.serviceId === svc.id) && (
                      <div>
                        <div className="mono-label mb-1.5">Poze după</div>
                        <PhotoGrid
                          photos={job.photos.filter((p) => p.serviceId === svc.id)}
                          onAdd={(p) => addJobPhoto(job.id, { ...p, serviceId: svc.id })}
                          onRemove={(pid) => removeJobPhoto(job.id, pid)}
                          onTogglePublic={(pid) =>
                            updateJobPhoto(job.id, pid, {
                              public: job.photos.find((p) => p.id === pid)?.public === false,
                            })
                          }
                        />
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}

          <Button onClick={() => setAddSvc(true)} className="self-start">
            <IconPlus width={15} height={15} /> Adaugă serviciu
          </Button>

          <Card title="Poze defecte / recepție mașină">
            <PhotoGrid
              photos={job.photos.filter((p) => !p.serviceId)}
              onAdd={(p) => addJobPhoto(job.id, p)}
              onRemove={(pid) => removeJobPhoto(job.id, pid)}
              onTogglePublic={(pid) =>
                updateJobPhoto(job.id, pid, {
                  public: job.photos.find((p) => p.id === pid)?.public === false,
                })
              }
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => {
                  const body = encodeURIComponent(
                    `Bună, ${clientName(client)}!\n\nAm recepționat ${carName(car)} (${car?.plate}) pentru ${job.services
                      .map((s) => serviceLabel(s))
                      .join(', ')}.\nStare la primire documentată în ${job.photos.length} poze.\nUrmărește lucrarea aici: ${trackingUrl}\n\nCustom Tuning`,
                  )
                  location.href = `mailto:${client?.email ?? ''}?subject=${encodeURIComponent(
                    `Custom Tuning · ${job.code} · ${carName(car)}`,
                  )}&body=${body}`
                }}
              >
                <IconMail width={15} height={15} /> Trimite pe email
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const phone = (client?.phone ?? '').replace(/\D/g, '').replace(/^0/, '40')
                  const text = encodeURIComponent(
                    `Custom Tuning · ${job.code}: stare ${statusLabel(job.status)}. Urmărește lucrarea: ${trackingUrl}`,
                  )
                  window.open(`https://wa.me/${phone}?text=${text}`, '_blank')
                }}
              >
                <IconPhone width={15} height={15} /> Trimite pe WhatsApp
              </Button>
            </div>
          </Card>

          <Card
            title="Istoric lucrare"
            pad={false}
            action={
              <span className="font-mono text-[11px] text-fg-faint">{job.events.length} evenimente</span>
            }
          >
            {job.events.length === 0 ? (
              <p className="px-5 py-4 text-[13px] text-fg-mute">Fără evenimente.</p>
            ) : (
              (() => {
                const DOT: Record<string, string> = {
                  create: 'bg-sky',
                  status: 'bg-brand-500',
                  reception: 'bg-mint',
                  work: 'bg-brand-500',
                  service: 'bg-mint',
                  stock: 'bg-ember',
                  notify: 'bg-sky',
                  photo: 'bg-black/30',
                  plan: 'bg-sky',
                  retouch: 'bg-mint',
                }
                const sorted = [...job.events].sort((a, b) => b.at.localeCompare(a.at))
                const shown = allHistory ? sorted : sorted.slice(0, 8)
                const today = fmtDate(new Date().toISOString(), 'yyyy-MM-dd')
                const yesterday = fmtDate(new Date(Date.now() - 86_400_000).toISOString(), 'yyyy-MM-dd')
                const days: { key: string; items: typeof shown }[] = []
                for (const e of shown) {
                  const key = fmtDate(e.at, 'yyyy-MM-dd')
                  const last = days[days.length - 1]
                  if (last?.key === key) last.items.push(e)
                  else days.push({ key, items: [e] })
                }
                return (
                  <div className="px-5 py-4">
                    {days.map((d) => (
                      <div key={d.key} className="mb-4 last:mb-0">
                        <div className="mono-label mb-2">
                          {d.key === today ? 'Azi' : d.key === yesterday ? 'Ieri' : fmtDate(d.items[0].at)}
                        </div>
                        <ol className="ml-1 border-l border-line">
                          {d.items.map((e) => (
                            <li key={e.id} className="relative pb-3 pl-5 last:pb-0">
                              <span
                                className={cx(
                                  'absolute top-[5px] -left-[5px] h-2.5 w-2.5 rounded-full ring-2 ring-[var(--color-ink-850)]',
                                  DOT[e.kind ?? 'status'],
                                )}
                              />
                              <div className="flex flex-wrap items-baseline gap-x-3">
                                <span className="text-[13px] font-semibold">{e.label}</span>
                                <span className="ml-auto font-mono text-[11px] text-fg-faint">
                                  {fmtDate(e.at, 'HH:mm')} · {e.by}
                                </span>
                              </div>
                              {e.detail && <div className="mt-0.5 text-[12.5px] text-fg-mute">{e.detail}</div>}
                            </li>
                          ))}
                        </ol>
                      </div>
                    ))}
                    {sorted.length > 8 && (
                      <button
                        onClick={() => setAllHistory((v) => !v)}
                        className="mt-1 text-[12.5px] font-semibold text-brand-500 hover:underline"
                      >
                        {allHistory ? 'Arată mai puțin' : `Vezi tot istoricul (${sorted.length})`}
                      </button>
                    )}
                  </div>
                )
              })()
            )}
          </Card>
        </div>

        {/* sidebar */}
        <div className="flex flex-col gap-5">
          <Card>
            {/* clientul */}
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <button
                  onClick={() => nav(`/clienti/${client?.id}`)}
                  className="flex items-center gap-2 text-left text-[15px] font-bold hover:text-brand-500"
                >
                  {clientName(client)}
                  {client?.archivedAt && <Badge tone="neutral">client șters</Badge>}
                </button>
                <div className="mt-0.5 truncate font-mono text-[11.5px] text-fg-faint">
                  {[client?.phone, client?.email].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div className="flex flex-none gap-1.5">
                {client?.phone && (
                  <a
                    href={`tel:${client.phone.replace(/\s/g, '')}`}
                    title="Sună clientul"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-fg-mute transition hover:border-brand-500/50 hover:text-brand-500"
                  >
                    <IconPhone width={14} height={14} />
                  </a>
                )}
                {client?.email && (
                  <a
                    href={`mailto:${client.email}`}
                    title="Trimite e-mail"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-fg-mute transition hover:border-brand-500/50 hover:text-brand-500"
                  >
                    <IconMail width={14} height={14} />
                  </a>
                )}
              </div>
            </div>
            <button
              onClick={() => nav(`/masini/${car?.id}`)}
              className="mt-3 flex w-full items-center justify-between rounded-lg bg-ink-750/70 px-3 py-2 text-left text-[12.5px] transition hover:bg-black/[0.06]"
            >
              <span>
                <span className="font-semibold">{carName(car)}</span>
                <span className="ml-1.5 font-mono text-fg-faint">{car?.plate}</span>
              </span>
              <span className="text-fg-faint">→</span>
            </button>

            <div className="my-4 h-px bg-line" />
            <dl className="flex flex-col gap-2.5 text-[13px]">
              {[
                ['Primire', receivedAt ? `primită ${fmtDateTime(receivedAt)}` : `programată ${fmtDateTime(job.startAt)}`],
                ['Ridicare (estimat)', job.deliveryAt ? fmtDate(job.deliveryAt) : '—'],
                ['Responsabil', job.assignee],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-fg-mute">{k}</dt>
                  <dd className="text-right font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="my-4 h-px bg-line" />
            <TotalBreakdown value={jobTotal(job)} />
            {job.notes && (
              <>
                <div className="my-4 h-px bg-line" />
                <div className="mono-label mb-1.5">Mențiuni</div>
                <p className="text-[13px] text-fg-dim">{job.notes}</p>
              </>
            )}
          </Card>

          {/* documentele lucrării — se deschid în tab nou, gata de printat / PDF */}
          <Card title="Documente" pad={false}>
            <ul className="divide-y divide-line">
              {DOCS.map((d) => (
                <li key={d.kind}>
                  <a
                    href={`#/documente/${job.id}/${d.kind}`}
                    target="_blank"
                    rel="noopener"
                    className="group flex items-center gap-3 px-5 py-2.5 transition hover:bg-black/[0.03]"
                  >
                    <IconPrint width={15} height={15} className="flex-none text-fg-faint group-hover:text-brand-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold group-hover:text-brand-500">{d.label}</span>
                      <span className="block font-mono text-[10.5px] text-fg-faint">{docNumber(d.kind, job)}</span>
                    </span>
                    <span className="text-[12px] text-fg-faint group-hover:text-brand-500">↗</span>
                  </a>
                </li>
              ))}
            </ul>
          </Card>

          {/* notificări + retuș — doar când e ceva de urmărit */}
          {(jobNotifs.some((n) => n.status !== 'anulata') ||
            (needsRetouch && (job.status === 'predat' || job.retouchDoneAt))) && (
            <Card title="Notificări client" pad={false}>
              {needsRetouch && job.retouchDoneAt && (
                <div className="flex items-center gap-2 border-b border-line px-5 py-3">
                  <Badge tone="mint">Retuș efectuat</Badge>
                  <span className="text-[12px] text-fg-mute">{fmtDate(job.retouchDoneAt)}</span>
                </div>
              )}
              {needsRetouch && !job.retouchDoneAt && job.status === 'predat' && (
                <div className="flex items-center gap-3 border-b border-line bg-ember/6 px-5 py-3">
                  <div className="min-w-0 flex-1 text-[12.5px]">
                    Retuș până la{' '}
                    <strong>{retouchDeadline ? fmtDate(retouchDeadline) : '—'}</strong>
                  </div>
                  <Button size="sm" variant="primary" onClick={() => markRetouchDone(job.id)}>
                    ✓ Efectuat
                  </Button>
                </div>
              )}
              <ul className="divide-y divide-line">
                {jobNotifs
                  .filter((n) => n.status !== 'anulata')
                  .map((n) => (
                    <li key={n.id} className="flex items-center gap-3 px-5 py-2.5">
                      {(() => {
                        // trimis · de trimis acum (scadent) · programat în viitor
                        const due = n.status === 'programata' && parseISO(n.dueAt) <= new Date()
                        return (
                          <>
                            <span
                              className={cx(
                                'h-2 w-2 flex-none rounded-full',
                                n.status === 'trimisa' ? 'bg-mint' : due ? 'bg-ember' : 'bg-black/20',
                              )}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[12.5px] font-semibold">
                                {NOTIF_KIND_LABEL[n.kind]}
                              </div>
                              <div
                                className={cx(
                                  'font-mono text-[10.5px]',
                                  n.status === 'trimisa' ? 'text-mint' : due ? 'text-ember' : 'text-fg-faint',
                                )}
                              >
                                {n.channel.toUpperCase()} ·{' '}
                                {n.status === 'trimisa'
                                  ? `✓ trimis ${fmtDate(n.sentAt)}`
                                  : due
                                    ? `de trimis · scadent ${fmtDate(n.dueAt)}`
                                    : `programat pe ${fmtDate(n.dueAt)}`}
                              </div>
                            </div>
                            {due && (
                              <Button size="sm" variant="subtle" onClick={() => markNotificationSent(n.id)}>
                                Marchează trimis
                              </Button>
                            )}
                          </>
                        )
                      })()}
                    </li>
                  ))}
              </ul>
            </Card>
          )}

          <button
            onClick={() => {
              if (confirm(`Ștergi programarea ${job.code}?`)) {
                removeJob(job.id)
                nav('/programari')
              }
            }}
            className="flex items-center justify-center gap-2 py-1 text-[12.5px] font-semibold text-fg-faint transition hover:text-rose"
          >
            <IconTrash width={14} height={14} /> Șterge programarea
          </button>
        </div>
      </div>

      {/* finalizare serviciu: poze „după” pentru tracking */}
      {doneSvc && job.services.some((x) => x.id === doneSvc) && (
        <ServiceDoneModal
          service={job.services.find((x) => x.id === doneSvc)!}
          onClose={() => setDoneSvc(null)}
          onDone={(data) => {
            const svc = job.services.find((x) => x.id === doneSvc)!
            if (svc.done) {
              // serviciu deja finalizat: doar se adaugă poze
              data.photos.forEach((p) => addJobPhoto(job.id, p))
              if (data.note) patchService(svc.id, { doneNote: data.note })
              toast(`${data.photos.length} poze adăugate`)
            } else {
              completeService(job.id, svc.id, data)
              setCollapsed((prev) => new Set(prev).add(svc.id))
            }
            setDoneSvc(null)
          }}
        />
      )}

      {/* modal finalizare: rola + metrii folosiți, cu scădere din stoc */}
      {confirmFinish && (
        <FinishFoilModal
          job={job}
          stock={stock}
          onClose={() => setConfirmFinish(false)}
          onFinish={finish}
        />
      )}

      {/* modal motiv „Blocat” — motivul apare și clientului, pe tracking */}
      <Modal
        open={block !== null}
        onClose={() => setBlock(null)}
        title="De ce e blocată lucrarea?"
        subtitle="Motivul apare și pe pagina de tracking a clientului."
        footer={
          <>
            <Button onClick={() => setBlock(null)}>Renunță</Button>
            <Button
              variant="primary"
              disabled={!block?.trim()}
              onClick={() => {
                updateJob(job.id, { blockedReason: block!.trim() })
                if (job.status !== 'blocat') {
                  setJobStatus(job.id, 'blocat')
                  toast('Status → Blocat')
                } else logEvent(job.id, 'status', 'Motivul blocării actualizat', block!.trim())
                setBlock(null)
              }}
            >
              {job.status === 'blocat' ? 'Salvează motivul' : 'Marchează blocat'}
            </Button>
          </>
        }
      >
        {block !== null && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {BLOCK_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setBlock(r)}
                  className={cx(
                    'rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition',
                    block === r
                      ? 'border-brand-500/50 bg-brand-500/12 text-brand-500'
                      : 'border-line bg-ink-750/60 text-fg-mute hover:text-fg',
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <Field label="Detalii" hint="Ex.: „difuzorul vine pe 12”, „așteptăm acordul pentru piesa suplimentară”.">
              <Textarea rows={3} value={block} onChange={(e) => setBlock(e.target.value)} />
            </Field>
          </div>
        )}
      </Modal>

      {/* modal anunțare ridicare (Setări → „Întreabă înainte”) */}
      <Modal
        open={pickup !== null}
        onClose={() => setPickup(null)}
        title="Anunți clientul că poate ridica mașina?"
        subtitle={`${clientName(client)} · ${client?.phone ?? ''}`}
        footer={
          <>
            <Button onClick={() => setPickup(null)}>Nu acum</Button>
            <Button
              variant="primary"
              disabled={!pickup?.message.trim()}
              onClick={() => {
                if (pickup) schedulePickup(job.id, pickup)
                setPickup(null)
              }}
            >
              Anunță clientul
            </Button>
          </>
        }
      >
        {pickup && (
          <div className="flex flex-col gap-4">
            <Field label="Canal">
              <Select
                value={pickup.channel}
                onChange={(e) =>
                  setPickup({ ...pickup, channel: e.target.value as NotificationChannel })
                }
              >
                <option value="sms">SMS</option>
                <option value="email">E-mail</option>
                <option value="whatsapp">WhatsApp</option>
              </Select>
            </Field>
            <Field label="Mesaj" hint="Mesajul intră în coada de notificări a clientului.">
              <Textarea
                rows={4}
                value={pickup.message}
                onChange={(e) => setPickup({ ...pickup, message: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Modal>

      {/* modal adaugare serviciu */}
      <Modal open={addSvc} onClose={() => setAddSvc(false)} title="Adaugă serviciu">
        <div className="flex flex-wrap gap-2">
          {activeServices(settings).map((s) => (
            <button
              key={s.kind}
              onClick={() => addService(s.kind)}
              className="rounded-lg border border-line bg-ink-750/60 px-3.5 py-2 text-[13px] font-semibold text-fg-mute transition hover:text-fg"
            >
              {s.label}
            </button>
          ))}
        </div>
      </Modal>

      {planOpen && <PlanExecutionModal job={job} onClose={() => setPlanOpen(false)} />}

      {/* modal editare meta */}
      <Modal
        open={editMeta}
        onClose={() => setEditMeta(false)}
        title="Editează programarea"
        width="max-w-xl"
        footer={<Button variant="primary" onClick={() => setEditMeta(false)}>Gata</Button>}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Data și ora">
            <Input
              type="datetime-local"
              value={toLocalInput(job.startAt)}
              onChange={(e) => updateJob(job.id, { startAt: new Date(e.target.value).toISOString() })}
            />
          </Field>
          <Field label="Slot primire">
            <Select
              value={String(job.durationMin)}
              onChange={(e) => updateJob(job.id, { durationMin: Number(e.target.value) })}
            >
              {[...new Set([15, 30, 45, 60, 90, 120, job.durationMin])]
                .sort((a, b) => a - b)
                .map((m) => (
                  <option key={m} value={m}>
                    {m < 60 ? `${m} min` : `${m / 60} ore`}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Start execuție" hint="Gol = încă neplanificată.">
            <Input
              type="datetime-local"
              value={job.workStartAt ? toLocalInput(job.workStartAt) : ''}
              onChange={(e) => {
                if (!e.target.value) return updateJob(job.id, { workStartAt: null, workEndAt: null })
                const ws = new Date(e.target.value).toISOString()
                const we = new Date(new Date(ws).getTime() + job.estimateMin * 60_000).toISOString()
                updateJob(job.id, {
                  workStartAt: ws,
                  workEndAt: we,
                  ...(job.deliveryAt ? {} : { deliveryAt: we }),
                })
              }}
            />
          </Field>
          <Field label="Timp de lucru estimat (min)" hint={`Sugestie din servicii: ${estimateRounded(job.services.map((s) => s.kind), settings, car?.bodyType)} min`}>
            <Input
              type="number"
              step={15}
              value={job.estimateMin}
              onChange={(e) => {
                const est = Number(e.target.value)
                updateJob(job.id, {
                  estimateMin: est,
                  estimateManual: true,
                  workEndAt: job.workStartAt
                    ? new Date(new Date(job.workStartAt).getTime() + est * 60_000).toISOString()
                    : null,
                })
              }}
            />
          </Field>
          <Field
            label="Ridicare estimată"
            hint="Când clientul poate lua mașina — apare pe tracking. Se propune singură la planificarea execuției."
          >
            <Input
              type="date"
              value={job.deliveryAt ? job.deliveryAt.slice(0, 10) : ''}
              onChange={(e) =>
                updateJob(job.id, {
                  deliveryAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                })
              }
            />
          </Field>
          <Field label="Responsabil">
            <Select
              value={job.assignee}
              onChange={(e) => updateJob(job.id, { assignee: e.target.value })}
            >
              {['Andrei', 'Cosmin', 'Robert', 'Echipa'].map((a) => (
                <option key={a}>{a}</option>
              ))}
            </Select>
          </Field>
          <Field label="Mențiuni" className="sm:col-span-2">
            <Textarea value={job.notes} onChange={(e) => updateJob(job.id, { notes: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </>
  )
}
