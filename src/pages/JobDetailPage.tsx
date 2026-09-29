import { useState } from 'react'
import { differenceInMinutes, isSameDay, parseISO } from 'date-fns'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Card, Field, Input, Modal, Select, Textarea } from '@/components/ui'
import { StatusBadge } from '@/components/StatusBadge'
import ServiceForm from '@/components/ServiceForm'
import PhotoGrid from '@/components/PhotoGrid'
import {
  STATUS_FLOW,
  carName,
  clientName,
  jobTotal,
  statusLabel,
  useStore,
} from '@/data/store'
import { SERVICE_CATALOG, estimateRounded, serviceDef } from '@/data/serviceCatalog'
import type { JobStatus, ServiceEntry, ServiceKind } from '@/data/types'
import { cx, fmtDate, fmtDateTime, toLocalInput, uid } from '@/lib/utils'
import { Money, TotalBreakdown } from '@/components/Money'
import { IconLink, IconMail, IconPhone, IconPlus, IconPrint, IconTrash } from '@/components/Icons'

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
    startExecution,
    finishExecution,
    addJobPhoto,
    removeJobPhoto,
    markNotificationSent,
    settings,
    toast,
  } = useStore()

  const job = jobs.find((j) => j.id === id)
  const [openSvc, setOpenSvc] = useState<string | null>(null)
  const [editMeta, setEditMeta] = useState(false)
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [addSvc, setAddSvc] = useState(false)

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

  const changeStatus = (s: JobStatus) => {
    if (s === 'finalizat' && pendingUsages.length > 0) {
      setConfirmFinish(true)
      return
    }
    setJobStatus(job.id, s)
    toast(`Status → ${statusLabel(s)}`)
  }

  const finish = (deduct: boolean) => {
    if (deduct) {
      const n = applyRollUsages(job.id)
      if (n) toast(`${n} consum(uri) scăzute din stoc`, 'ok')
    }
    setJobStatus(job.id, 'finalizat')
    setConfirmFinish(false)
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
          price: serviceDef(kind).defaultPrice,
          done: false,
        },
      ],
    })
    setAddSvc(false)
  }

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Programări', to: '/programari' }, { label: job.code }]}
        title={`${carName(car)} · ${car?.plate ?? ''}`}
        subtitle={
          <>
            {clientName(client)} · {job.services.map((s) => serviceDef(s.kind).label).join(' + ')} ·
            Responsabil: {job.assignee}
          </>
        }
        action={
          <>
            <StatusBadge status={job.status} />
            <Button onClick={() => setEditMeta(true)}>Editează</Button>
            <Button onClick={() => window.print()}>
              <IconPrint width={15} height={15} /> Fișă PDF
            </Button>
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
        {pendingUsages.length > 0 && (
          <p className="mt-3 text-[12.5px] text-fg-mute">
            La trecerea în „Finalizat” se scad automat {pendingUsages.length} consum(uri) de folie din
            stoc și se programează notificarea de retuș (7 zile lucrătoare + reminder la 3 zile).
          </p>
        )}
      </Card>

      {/* programare vs execuție */}
      <Card
        className="mb-5"
        title="Primire mașină & execuție"
        action={
          <div className="flex gap-2">
            {!job.actualStartAt ? (
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-dashed border-line-strong p-4">
            <div className="mono-label">1 · Primire mașină</div>
            <div className="mt-2 text-[15px] font-bold">{fmtDateTime(job.startAt)}</div>
            <div className="mt-1 text-[12px] text-fg-mute">
              slot {job.durationMin} min · client aduce mașina
            </div>
          </div>

          <div className="rounded-lg border border-line bg-brand-500/6 p-4">
            <div className="mono-label">2 · Execuție planificată</div>
            <div className="mt-2 text-[15px] font-bold">
              {job.workStartAt ? fmtDateTime(job.workStartAt) : '—'}
            </div>
            <div className="mt-1 text-[12px] text-fg-mute">
              {job.workEndAt ? `→ ${fmtDateTime(job.workEndAt)}` : ''} · estimat{' '}
              {(job.estimateMin / 60).toFixed(1)} h{' '}
              {job.estimateManual ? '(manual)' : '(auto din servicii)'}
            </div>
            {job.workStartAt && !isSameDay(parseISO(job.workStartAt), parseISO(job.startAt)) && (
              <Badge tone="sky" className="mt-2">
                altă zi decât primirea
              </Badge>
            )}
          </div>

          <div className="rounded-lg border border-line p-4">
            <div className="mono-label">3 · Execuție reală</div>
            <div className="mt-2 text-[15px] font-bold">
              {job.actualStartAt ? fmtDateTime(job.actualStartAt) : 'neînceput'}
            </div>
            <div className="mt-1 text-[12px] text-fg-mute">
              {job.actualEndAt
                ? `→ ${fmtDateTime(job.actualEndAt)} · efectiv ${(
                    differenceInMinutes(parseISO(job.actualEndAt), parseISO(job.actualStartAt!)) / 60
                  ).toFixed(1)} h`
                : job.actualStartAt
                  ? `în lucru de ${(
                      differenceInMinutes(new Date(), parseISO(job.actualStartAt)) / 60
                    ).toFixed(1)} h`
                  : 'se pornește din butonul de sus'}
            </div>
            {job.actualEndAt && job.actualStartAt && (
              <Badge
                tone={
                  differenceInMinutes(parseISO(job.actualEndAt), parseISO(job.actualStartAt)) >
                  job.estimateMin
                    ? 'ember'
                    : 'mint'
                }
                className="mt-2"
              >
                {differenceInMinutes(parseISO(job.actualEndAt), parseISO(job.actualStartAt)) >
                job.estimateMin
                  ? 'peste estimare'
                  : 'în estimare'}
              </Badge>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_330px]">
        <div className="flex flex-col gap-5">
          {job.services.map((svc) => {
            const def = serviceDef(svc.kind)
            const open = openSvc === svc.id
            const checked = svc.elements.filter((e) => e.checked)
            return (
              <Card
                key={svc.id}
                title={
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: def.accent }} />
                    {def.label}
                    <Money value={svc.price} className="font-mono text-[11px] text-fg-faint" />
                  </span>
                }
                action={
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() =>
                        updateJob(job.id, {
                          services: job.services.filter((s) => s.id !== svc.id),
                        })
                      }
                      className="text-fg-faint hover:text-rose"
                    >
                      <IconTrash width={15} height={15} />
                    </button>
                    <button
                      onClick={() => setOpenSvc(open ? null : svc.id)}
                      className="text-[13px] font-semibold text-brand-400"
                    >
                      {open ? 'restrânge' : 'editează fișa'}
                    </button>
                  </div>
                }
              >
                {open ? (
                  <ServiceForm
                    entry={svc}
                    stock={stock}
                    bodyType={car?.bodyType}
                    onChange={(patch) => patchService(svc.id, patch)}
                  />
                ) : (
                  <div className="flex flex-col gap-3">
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
              photos={job.photos}
              onAdd={(p) => addJobPhoto(job.id, p)}
              onRemove={(pid) => removeJobPhoto(job.id, pid)}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => {
                  const body = encodeURIComponent(
                    `Bună, ${clientName(client)}!\n\nAm recepționat ${carName(car)} (${car?.plate}) pentru ${job.services
                      .map((s) => serviceDef(s.kind).label)
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

          <Card title="Istoric lucrare" pad={false}>
            <ul className="divide-y divide-line">
              {[...job.events].reverse().map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                  <span className="flex-1 text-[13px]">{e.label}</span>
                  <span className="font-mono text-[11px] text-fg-faint">
                    {fmtDateTime(e.at)} · {e.by}
                  </span>
                </li>
              ))}
              {job.events.length === 0 && (
                <li className="px-5 py-4 text-[13px] text-fg-mute">Fără evenimente.</li>
              )}
            </ul>
          </Card>
        </div>

        {/* sidebar */}
        <div className="flex flex-col gap-5">
          <Card title="Sumar">
            <dl className="flex flex-col gap-3 text-[13px]">
              {[
                ['Cod', job.code],
                ['Primire mașină', fmtDateTime(job.startAt)],
                ['Slot primire', `${job.durationMin} min`],
                ['Predare către client', job.deliveryAt ? fmtDate(job.deliveryAt) : '—'],
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

          <Card title="Client">
            <div className="text-sm font-semibold">{clientName(client)}</div>
            <div className="mt-1 font-mono text-[12px] text-fg-mute">{client?.phone}</div>
            <div className="font-mono text-[12px] text-fg-mute">{client?.email}</div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => nav(`/clienti/${client?.id}`)}>
                Fișa clientului
              </Button>
              <Button size="sm" onClick={() => nav(`/masini/${car?.id}`)}>
                Fișa mașinii
              </Button>
            </div>
          </Card>

          <Card title="Notificări client" pad={false}>
            <ul className="divide-y divide-line">
              {jobNotifs.map((n) => (
                <li key={n.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold">
                      {n.kind === 'retus_7z'
                        ? 'SMS retuș · 7 zile lucrătoare'
                        : n.kind === 'retus_reminder_3z'
                          ? 'SMS reminder retuș · +3 zile'
                          : 'Notificare'}
                    </div>
                    <div className="font-mono text-[11px] text-fg-faint">
                      scadent {fmtDate(n.dueAt)} ·{' '}
                      {n.status === 'trimisa' ? `trimis ${fmtDate(n.sentAt)}` : n.status}
                    </div>
                  </div>
                  {n.status === 'programata' && (
                    <Button size="sm" variant="subtle" onClick={() => markNotificationSent(n.id)}>
                      Marchează trimis
                    </Button>
                  )}
                </li>
              ))}
              {jobNotifs.length === 0 && (
                <li className="px-5 py-4 text-[13px] text-fg-mute">
                  Se programează automat la finalizare (doar pentru colantare).
                </li>
              )}
            </ul>
          </Card>

          <Card title="Tracking public">
            <p className="text-[12.5px] text-fg-mute">
              Clientul vede statusul fără cont, pe link privat.
            </p>
            <code className="mt-2 block truncate rounded-md bg-ink-750 px-2.5 py-2 font-mono text-[11px] text-brand-400">
              #/tracking/{job.trackingToken}
            </code>
            <Button size="sm" className="mt-3" onClick={() => nav(`/tracking/${job.trackingToken}`)}>
              Deschide pagina
            </Button>
          </Card>

          <Button
            variant="danger"
            onClick={() => {
              if (confirm(`Ștergi programarea ${job.code}?`)) {
                removeJob(job.id)
                nav('/programari')
              }
            }}
          >
            <IconTrash width={15} height={15} /> Șterge programarea
          </Button>
        </div>
      </div>

      {/* modal finalizare cu scădere stoc */}
      <Modal
        open={confirmFinish}
        onClose={() => setConfirmFinish(false)}
        title="Finalizezi lucrarea?"
        subtitle="Se scade folia consumată din stoc și se programează notificările de retuș."
        footer={
          <>
            <Button onClick={() => finish(false)}>Fără scădere stoc</Button>
            <Button variant="primary" onClick={() => finish(true)}>
              Confirmă & scade din stoc
            </Button>
          </>
        }
      >
        <ul className="flex flex-col gap-2">
          {pendingUsages.map((u) => {
            const item = stock.find((s) => s.id === u.stockItemId)
            return (
              <li
                key={u.id}
                className="flex items-center justify-between rounded-lg border border-line px-4 py-3"
              >
                <div>
                  <div className="text-sm font-semibold">
                    {item?.maker} {item?.name}
                  </div>
                  <div className="font-mono text-[11px] text-fg-faint">rola #{item?.rollNumber}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-bold text-ember">
                    −{u.qty}
                    {item?.unit}
                  </div>
                  <div className="font-mono text-[11px] text-fg-faint">
                    rămâne {Math.round(((item?.qty ?? 0) - u.qty) * 100) / 100}
                    {item?.unit}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </Modal>

      {/* modal adaugare serviciu */}
      <Modal open={addSvc} onClose={() => setAddSvc(false)} title="Adaugă serviciu">
        <div className="flex flex-wrap gap-2">
          {SERVICE_CATALOG.map((s) => (
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
          <Field label="Start execuție">
            <Input
              type="datetime-local"
              value={job.workStartAt ? toLocalInput(job.workStartAt) : ''}
              onChange={(e) => {
                const ws = new Date(e.target.value).toISOString()
                updateJob(job.id, {
                  workStartAt: ws,
                  workEndAt: new Date(new Date(ws).getTime() + job.estimateMin * 60_000).toISOString(),
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
          <Field label="Predare estimată">
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
