import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { addHours } from 'date-fns'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Card, Field, Input, Select, Textarea } from '@/components/ui'
import ServiceForm from '@/components/ServiceForm'
import ClientModal from '@/components/modals/ClientModal'
import CarModal from '@/components/modals/CarModal'
import { SERVICE_CATALOG, estimateRounded, serviceDef } from '@/data/serviceCatalog'
import type { ServiceEntry, ServiceKind } from '@/data/types'
import { carName, clientName, useStore } from '@/data/store'
import { cx, fmtDateTime, toLocalInput, uid } from '@/lib/utils'
import { Money, TotalBreakdown } from '@/components/Money'
import { IconPlus } from '@/components/Icons'

const STEPS = ['Client', 'Mașină', 'Servicii', 'Program & execuție']

export default function JobNewPage() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const { clients, cars, stock, addJob, toast } = useStore()

  const preset = useMemo(() => {
    const kinds = (params.get('services') ?? '')
      .split(',')
      .filter(Boolean) as ServiceKind[]
    return {
      clientId: params.get('client') ?? '',
      carId: params.get('car') ?? '',
      start: params.get('start') ?? addHours(new Date(), 24).toISOString(),
      duration: Number(params.get('duration') ?? 30),
      delivery: params.get('delivery') ?? '',
      work: params.get('work') ?? '',
      estimate: Number(params.get('estimate') ?? 0),
      services: kinds.map<ServiceEntry>((k) => ({
        id: uid(),
        kind: k,
        values: {},
        elements: [],
        rollUsages: [],
        price: serviceDef(k).defaultPrice,
        done: false,
      })),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [step, setStep] = useState(preset.clientId && preset.carId ? 2 : 0)
  const [clientId, setClientId] = useState(preset.clientId)
  const [carId, setCarId] = useState(preset.carId)
  const [services, setServices] = useState<ServiceEntry[]>(preset.services)
  const [activeSvc, setActiveSvc] = useState<ServiceKind | null>(preset.services[0]?.kind ?? null)
  const [startAt, setStartAt] = useState(toLocalInput(preset.start))
  const [durationMin, setDurationMin] = useState(preset.duration)
  const [workStartAt, setWorkStartAt] = useState(
    toLocalInput(preset.work || preset.start),
  )
  const [estimateMin, setEstimateMin] = useState(preset.estimate || 0)
  const [estimateTouched, setEstimateTouched] = useState(Boolean(preset.estimate))
  const [deliveryAt, setDeliveryAt] = useState(preset.delivery ? toLocalInput(preset.delivery) : '')
  const [assignee, setAssignee] = useState(() => useStore.getState().staff[0]?.name ?? '')
  const [notes, setNotes] = useState('')
  const [clientModal, setClientModal] = useState(false)
  const [carModal, setCarModal] = useState(false)

  const clientCars = useMemo(() => cars.filter((c) => c.clientId === clientId), [cars, clientId])
  const total = services.reduce((s, x) => s + (x.price || 0), 0)
  const suggestedMin = useMemo(
    () => estimateRounded(services.map((s) => s.kind)),
    [services],
  )
  useEffect(() => {
    if (!estimateTouched) setEstimateMin(suggestedMin)
  }, [suggestedMin, estimateTouched])
  const workEnd = new Date(new Date(workStartAt).getTime() + estimateMin * 60_000)

  const toggleService = (kind: ServiceKind) => {
    setServices((prev) => {
      const has = prev.find((s) => s.kind === kind)
      if (has) {
        if (activeSvc === kind) setActiveSvc(null)
        return prev.filter((s) => s.kind !== kind)
      }
      setActiveSvc(kind)
      return [
        ...prev,
        {
          id: uid(),
          kind,
          values: {},
          elements: [],
          rollUsages: [],
          price: serviceDef(kind).defaultPrice,
          done: false,
        },
      ]
    })
  }

  const patchService = (id: string, patch: Partial<ServiceEntry>) =>
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))

  const canSave = clientId && carId && services.length > 0 && startAt

  const save = () => {
    if (!canSave) return
    const job = addJob({
      clientId,
      carId,
      status: 'programat',
      startAt: new Date(startAt).toISOString(),
      durationMin,
      workStartAt: new Date(workStartAt).toISOString(),
      workEndAt: workEnd.toISOString(),
      estimateMin,
      estimateManual: estimateTouched,
      deliveryAt: deliveryAt ? new Date(deliveryAt).toISOString() : workEnd.toISOString(),
      assignee,
      notes,
      services,
      photos: [],
    })
    toast(`Programare ${job.code} salvată`)
    nav(`/programari/${job.id}`)
  }

  return (
    <>
      <PageHeader
        title="Programare nouă"
        crumbs={[{ label: 'Programări', to: '/programari' }, { label: 'Nouă' }]}
        action={
          <>
            <Button onClick={() => nav('/programari')}>Anulează</Button>
            <Button variant="primary" disabled={!canSave} onClick={save}>
              Salvează programarea
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <button
            key={s}
            onClick={() => setStep(i)}
            className={cx(
              'flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[13px] font-semibold transition',
              i === step
                ? 'border-brand-500/50 bg-brand-500/12 text-brand-400'
                : 'border-line bg-ink-850 text-fg-mute hover:text-fg',
            )}
          >
            <span
              className={cx(
                'flex h-5 w-5 items-center justify-center rounded-md font-mono text-[11px]',
                i === step ? 'bg-brand-500 text-white' : 'bg-black/[0.07]',
              )}
            >
              {i + 1}
            </span>
            {s}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-5">
          {step === 0 && (
            <Card title="1 · Client">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Client" required className="sm:col-span-2">
                  <Select
                    value={clientId}
                    onChange={(e) => {
                      setClientId(e.target.value)
                      setCarId('')
                    }}
                  >
                    <option value="">— alege client —</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {clientName(c)} · {c.phone}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <Button onClick={() => setClientModal(true)}>
                  <IconPlus width={15} height={15} /> Client nou
                </Button>
                {clientId && (
                  <Button variant="ghost" onClick={() => setStep(1)}>
                    Continuă →
                  </Button>
                )}
              </div>
              {clientId && (
                <div className="mt-5 rounded-lg border border-line bg-ink-750/60 p-4 text-[13px]">
                  {(() => {
                    const c = clients.find((x) => x.id === clientId)!
                    return (
                      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div>
                          <dt className="mono-label">Telefon</dt>
                          <dd>{c.phone || '—'}</dd>
                        </div>
                        <div>
                          <dt className="mono-label">Email</dt>
                          <dd className="truncate">{c.email || '—'}</dd>
                        </div>
                        <div>
                          <dt className="mono-label">{c.type === 'pj' ? 'CUI' : 'CNP'}</dt>
                          <dd className="font-mono">{c.type === 'pj' ? c.vatId : c.cnp || '—'}</dd>
                        </div>
                        <div>
                          <dt className="mono-label">Adresă</dt>
                          <dd className="truncate">{c.address || '—'}</dd>
                        </div>
                      </dl>
                    )
                  })()}
                </div>
              )}
            </Card>
          )}

          {step === 1 && (
            <Card title="2 · Mașină">
              {!clientId ? (
                <p className="text-sm text-fg-mute">Alege întâi clientul.</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3">
                    {clientCars.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setCarId(c.id)}
                        className={cx(
                          'flex items-center justify-between rounded-lg border px-4 py-3 text-left transition',
                          carId === c.id
                            ? 'border-brand-500/50 bg-brand-500/8'
                            : 'border-line bg-ink-750/60 hover:border-line-strong',
                        )}
                      >
                        <div>
                          <div className="font-semibold">{carName(c)}</div>
                          <div className="font-mono text-[11.5px] text-fg-faint">
                            {c.year || '—'} · {c.engine || '—'} · {c.plate}
                          </div>
                        </div>
                        {carId === c.id && <Badge tone="gold">selectată</Badge>}
                      </button>
                    ))}
                    {clientCars.length === 0 && (
                      <p className="text-sm text-fg-mute">Clientul nu are mașini înregistrate.</p>
                    )}
                  </div>
                  <div className="mt-4 flex gap-3">
                    <Button onClick={() => setCarModal(true)}>
                      <IconPlus width={15} height={15} /> Mașină nouă
                    </Button>
                    {carId && (
                      <Button variant="ghost" onClick={() => setStep(2)}>
                        Continuă →
                      </Button>
                    )}
                  </div>
                </>
              )}
            </Card>
          )}

          {step === 2 && (
            <>
              <Card title="3 · Servicii prestate">
                <div className="flex flex-wrap gap-2">
                  {SERVICE_CATALOG.map((s) => {
                    const on = services.some((x) => x.kind === s.kind)
                    return (
                      <button
                        key={s.kind}
                        onClick={() => toggleService(s.kind)}
                        style={on ? { borderColor: `${s.accent}80`, background: `${s.accent}14` } : {}}
                        className={cx(
                          'rounded-lg border px-3.5 py-2 text-[13px] font-semibold transition',
                          on ? 'text-fg' : 'border-line bg-ink-750/60 text-fg-mute hover:text-fg',
                        )}
                      >
                        {s.label}
                      </button>
                    )
                  })}
                </div>
                {services.length === 0 && (
                  <p className="mt-4 text-[13px] text-fg-mute">
                    Selectează unul sau mai multe servicii de mai sus.
                  </p>
                )}
              </Card>

              {services.map((svc) => {
                const def = serviceDef(svc.kind)
                const open = activeSvc === svc.kind
                return (
                  <Card
                    key={svc.id}
                    title={
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: def.accent }} />
                        Fișă {def.label}
                      </span>
                    }
                    action={
                      <button
                        onClick={() => setActiveSvc(open ? null : svc.kind)}
                        className="text-[13px] font-semibold text-brand-400"
                      >
                        {open ? 'restrânge' : 'completează'}
                      </button>
                    }
                  >
                    {open ? (
                      <ServiceForm
                        entry={svc}
                        stock={stock}
                        onChange={(patch) => patchService(svc.id, patch)}
                      />
                    ) : (
                      <p className="text-[13px] text-fg-mute">
                        <Money value={svc.price} /> ·{' '}
                        {svc.elements.filter((e) => e.checked).length || 0} elemente bifate
                      </p>
                    )}
                  </Card>
                )
              })}
            </>
          )}

          {step === 3 && (
            <>
              <Card title="4 · Primirea mașinii">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Când vine clientul cu mașina" required>
                    <Input
                      type="datetime-local"
                      value={startAt}
                      onChange={(e) => setStartAt(e.target.value)}
                    />
                  </Field>
                  <Field label="Durata slotului de primire" hint="Cât ține preluarea mașinii, nu lucrarea.">
                    <Select
                      value={String(durationMin)}
                      onChange={(e) => setDurationMin(Number(e.target.value))}
                    >
                      {[...new Set([15, 30, 45, 60, 90, 120, durationMin])]
                        .sort((a, b) => a - b)
                        .map((m) => (
                          <option key={m} value={m}>
                            {m < 60 ? `${m} min` : `${m / 60} ore`}
                          </option>
                        ))}
                    </Select>
                  </Field>
                  <Field label="Responsabil">
                    <Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                      {['Andrei', 'Cosmin', 'Robert', 'Daniel', 'Echipa'].map((a) => (
                        <option key={a}>{a}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Predare mașină către client (estimat)">
                    <Input
                      type="datetime-local"
                      value={deliveryAt}
                      onChange={(e) => setDeliveryAt(e.target.value)}
                    />
                  </Field>
                  <Field label="Mențiuni" className="sm:col-span-2">
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Defecte constatate, cerințe speciale, discuții cu clientul…"
                    />
                  </Field>
                </div>
              </Card>

              <Card title="5 · Execuția lucrării">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="Start execuție"
                    hint="Poate fi în aceeași zi cu primirea sau mai târziu."
                  >
                    <Input
                      type="datetime-local"
                      value={workStartAt}
                      onChange={(e) => setWorkStartAt(e.target.value)}
                    />
                  </Field>
                  <Field
                    label="Timp de lucru estimat (min)"
                    hint={
                      services.length
                        ? `Sugestie din servicii: ${(suggestedMin / 60).toFixed(1)} h${estimateTouched ? ' · suprascris manual' : ''}`
                        : 'Alege serviciile pentru sugestie automată.'
                    }
                  >
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step={15}
                        value={estimateMin}
                        onChange={(e) => {
                          setEstimateMin(Number(e.target.value))
                          setEstimateTouched(true)
                        }}
                      />
                      {estimateTouched && (
                        <Button
                          variant="ghost"
                          className="flex-none"
                          onClick={() => {
                            setEstimateTouched(false)
                            setEstimateMin(suggestedMin)
                          }}
                        >
                          auto
                        </Button>
                      )}
                    </div>
                  </Field>
                </div>

                <div className="mt-4 rounded-lg border border-line bg-ink-750/60 p-4">
                  <div className="mono-label mb-2">Fereastră execuție</div>
                  <p className="text-[13px]">
                    <span className="font-mono">{startAt.replace('T', ' · ')}</span> primire →{' '}
                    <span className="font-mono text-brand-500">
                      {workStartAt.replace('T', ' · ')} → {fmtDateTime(workEnd.toISOString())}
                    </span>{' '}
                    ({(estimateMin / 60).toFixed(1)} h)
                  </p>
                  {services.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-1">
                      {services.map((s) => (
                        <li
                          key={s.id}
                          className="flex justify-between font-mono text-[11.5px] text-fg-mute"
                        >
                          <span>{serviceDef(s.kind).label}</span>
                          <span>{(serviceDef(s.kind).estimateMin / 60).toFixed(1)} h</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            </>
          )}
        </div>

        {/* rezumat */}
        <Card title="Sumar programare" className="h-fit">
          <dl className="flex flex-col gap-3 text-[13px]">
            <div className="flex justify-between gap-3">
              <dt className="text-fg-mute">Client</dt>
              <dd className="text-right font-semibold">
                {clientName(clients.find((c) => c.id === clientId))}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-fg-mute">Mașină</dt>
              <dd className="text-right font-semibold">
                {carId ? carName(cars.find((c) => c.id === carId)) : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-fg-mute">Data</dt>
              <dd className="text-right font-mono">{startAt.replace('T', ' · ')}</dd>
            </div>
          </dl>

          <div className="my-4 h-px bg-line" />

          {services.length === 0 ? (
            <p className="text-[13px] text-fg-faint">Niciun serviciu selectat.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {services.map((s) => (
                <li key={s.id} className="flex justify-between gap-3 text-[13px]">
                  <span>{serviceDef(s.kind).label}</span>
                  <Money value={s.price} className="font-mono" />
                </li>
              ))}
            </ul>
          )}

          <div className="my-4 h-px bg-line" />
          <TotalBreakdown value={total} />

          <Button variant="primary" className="mt-5 w-full" disabled={!canSave} onClick={save}>
            Salvează programarea
          </Button>
          {!canSave && (
            <p className="mt-2 text-center text-[11.5px] text-fg-faint">
              Necesar: client, mașină, minim un serviciu.
            </p>
          )}
        </Card>
      </div>

      <ClientModal open={clientModal} onClose={() => setClientModal(false)} onSaved={(c) => setClientId(c.id)} />
      <CarModal
        open={carModal}
        onClose={() => setCarModal(false)}
        defaultClientId={clientId}
        onSaved={(c) => setCarId(c.id)}
      />
    </>
  )
}
