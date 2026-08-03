import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import { ro } from 'date-fns/locale'
import { Badge, Button, Chip, Field, Input, Modal, Select, Textarea } from '../ui'
import {
  TIME_OFF_LABEL,
  canSeeTimeOff,
  carName,
  clientName,
  useCurrentUser,
  useStore,
} from '@/data/store'
import { SERVICE_CATALOG, estimateRounded, serviceDef } from '@/data/serviceCatalog'
import type { ServiceKind, TimeOffType } from '@/data/types'
import { cx, uid } from '@/lib/utils'
import ClientModal from './ClientModal'
import CarModal from './CarModal'
import { IconPlus } from '../Icons'
import { useMoney } from '@/components/Money'

export interface QuickRange {
  /** selecție pe zile întregi (vizualizarea lună / rândul all-day) sau pe ore */
  kind: 'zile' | 'ore'
  startDate: string // yyyy-MM-dd
  endDate: string // yyyy-MM-dd (inclusiv)
  startMin?: number
  durationMin?: number
}

const fmtMin = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

export default function QuickCreateModal({
  range,
  onClose,
}: {
  range: QuickRange | null
  onClose: () => void
}) {
  const nav = useNavigate()
  const { fmt, settings } = useMoney()
  const { clients, cars, staff, addJob, addTimeOff, toast } = useStore()
  const me = useCurrentUser()
  const canTimeOff = canSeeTimeOff(me?.role)

  const [tab, setTab] = useState<'programare' | 'concediu'>('programare')
  const [clientId, setClientId] = useState('')
  const [carId, setCarId] = useState('')
  const [kinds, setKinds] = useState<ServiceKind[]>([])
  const [assignee, setAssignee] = useState(() => useStore.getState().staff[0]?.name ?? '')
  const [notes, setNotes] = useState('')

  /** execuția: implicit în aceeași zi cu primirea, dar se poate muta */
  const [sameDay, setSameDay] = useState(true)
  const [workDate, setWorkDate] = useState('')
  const [workTime, setWorkTime] = useState('09:00')
  const [estimate, setEstimate] = useState(0)
  const [estimateTouched, setEstimateTouched] = useState(false)
  const [clientModal, setClientModal] = useState(false)
  const [carModal, setCarModal] = useState(false)

  const [staffId, setStaffId] = useState('')
  const [type, setType] = useState<TimeOffType>('concediu')
  const [approved, setApproved] = useState(true)
  const [offNote, setOffNote] = useState('')

  useEffect(() => {
    if (!range) return
    setTab('programare')
    setClientId('')
    setCarId('')
    setKinds([])
    setNotes('')
    setSameDay(true)
    setWorkDate(range.startDate)
    setWorkTime('09:00')
    setEstimate(0)
    setEstimateTouched(false)
    setStaffId(staff[0]?.id ?? '')
    setType('concediu')
    setApproved(true)
    setOffNote('')
  }, [range, staff])

  const clientCars = useMemo(() => cars.filter((c) => c.clientId === clientId), [cars, clientId])
  const suggested = useMemo(() => estimateRounded(kinds), [kinds])
  useEffect(() => {
    if (!estimateTouched) setEstimate(suggested)
  }, [suggested, estimateTouched])
  const days = range ? differenceInCalendarDays(parseISO(range.endDate), parseISO(range.startDate)) + 1 : 0
  const total = kinds.reduce((s, k) => s + serviceDef(k).defaultPrice, 0)

  if (!range) return null

  const startISO = () => {
    const d = parseISO(range.startDate)
    const m = range.kind === 'ore' ? (range.startMin ?? 540) : 540
    d.setHours(Math.floor(m / 60), m % 60, 0, 0)
    return d.toISOString()
  }

  /** slotul de PRIMIRE: ce a fost tras pe ore, altfel 30 min */
  const durationMin = range.kind === 'ore' ? (range.durationMin ?? 30) : 30

  /** fereastra de EXECUȚIE */
  const workStartISO = () => {
    if (sameDay) {
      const d = new Date(startISO())
      return d.toISOString()
    }
    const [h, m] = workTime.split(':').map(Number)
    const d = parseISO(workDate || range.startDate)
    d.setHours(h || 9, m || 0, 0, 0)
    return d.toISOString()
  }
  const workEndISO = () =>
    new Date(new Date(workStartISO()).getTime() + estimate * 60_000).toISOString()

  const deliveryISO = () => {
    if (days > 1) {
      const d = parseISO(range.endDate)
      d.setHours(18, 0, 0, 0)
      return d.toISOString()
    }
    return workEndISO()
  }

  const intervalLabel =
    range.kind === 'ore'
      ? `${format(parseISO(range.startDate), 'EEEE, d MMM', { locale: ro })} · ${fmtMin(
          range.startMin ?? 540,
        )} – ${fmtMin((range.startMin ?? 540) + (range.durationMin ?? 60))}`
      : days === 1
        ? format(parseISO(range.startDate), 'EEEE, d MMMM yyyy', { locale: ro })
        : `${format(parseISO(range.startDate), 'd MMM', { locale: ro })} → ${format(
            parseISO(range.endDate),
            'd MMM yyyy',
            { locale: ro },
          )} · ${days} zile`

  const canSaveJob = clientId && carId && kinds.length > 0
  const canSaveOff = staffId && range.startDate <= range.endDate

  const saveJob = (openFull: boolean) => {
    if (openFull) {
      const p = new URLSearchParams({
        start: startISO(),
        duration: String(durationMin),
        work: workStartISO(),
        estimate: String(estimate),
      })
      const del = deliveryISO()
      if (del) p.set('delivery', del)
      if (clientId) p.set('client', clientId)
      if (carId) p.set('car', carId)
      if (kinds.length) p.set('services', kinds.join(','))
      onClose()
      nav(`/programari/nou?${p.toString()}`)
      return
    }
    if (!canSaveJob) return
    const job = addJob({
      clientId,
      carId,
      status: 'programat',
      startAt: startISO(),
      durationMin,
      workStartAt: workStartISO(),
      workEndAt: workEndISO(),
      estimateMin: estimate,
      estimateManual: estimateTouched,
      deliveryAt: deliveryISO(),
      assignee,
      notes,
      services: kinds.map((k) => ({
        id: uid(),
        kind: k,
        values: {},
        elements: [],
        rollUsages: [],
        price: serviceDef(k).defaultPrice,
        done: false,
      })),
      photos: [],
    })
    toast(`Programare ${job.code} creată`)
    onClose()
    nav(`/programari/${job.id}`)
  }

  const saveOff = () => {
    if (!canSaveOff) return
    addTimeOff({
      staffId,
      type,
      startDate: range.startDate,
      endDate: range.endDate,
      note: offNote,
      approved,
    })
    toast(`${TIME_OFF_LABEL[type]} adăugat în calendar`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Adaugă în calendar"
      subtitle={intervalLabel}
      width="max-w-2xl"
      footer={
        tab === 'programare' ? (
          <>
            <Button onClick={onClose}>Anulează</Button>
            <Button onClick={() => saveJob(true)}>Deschide fișa completă →</Button>
            <Button variant="primary" disabled={!canSaveJob} onClick={() => saveJob(false)}>
              Salvează programarea
            </Button>
          </>
        ) : (
          <>
            <Button onClick={onClose}>Anulează</Button>
            <Button variant="primary" disabled={!canSaveOff} onClick={saveOff}>
              Salvează
            </Button>
          </>
        )
      }
    >
      {canTimeOff && (
        <div className="mb-5 flex gap-2">
          <Chip active={tab === 'programare'} onClick={() => setTab('programare')}>
            Programare
          </Chip>
          <Chip active={tab === 'concediu'} onClick={() => setTab('concediu')}>
            Concediu / zi liberă
          </Chip>
        </div>
      )}

      {tab === 'programare' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Client" required>
            <div className="flex gap-2">
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
              <Button size="sm" className="flex-none" onClick={() => setClientModal(true)} title="Client nou">
                <IconPlus width={15} height={15} />
              </Button>
            </div>
          </Field>
          <Field label="Mașină" required>
            <div className="flex gap-2">
              <Select value={carId} onChange={(e) => setCarId(e.target.value)} disabled={!clientId}>
                <option value="">— alege mașina —</option>
                {clientCars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {carName(c)} · {c.plate}
                  </option>
                ))}
              </Select>
              <Button
                size="sm"
                className="flex-none"
                disabled={!clientId}
                onClick={() => setCarModal(true)}
                title="Mașină nouă"
              >
                <IconPlus width={15} height={15} />
              </Button>
            </div>
          </Field>

          <div className="sm:col-span-2">
            <div className="mono-label mb-2">Servicii</div>
            <div className="flex flex-wrap gap-2">
              {SERVICE_CATALOG.map((s) => {
                const on = kinds.includes(s.kind)
                return (
                  <button
                    key={s.kind}
                    onClick={() =>
                      setKinds((k) => (on ? k.filter((x) => x !== s.kind) : [...k, s.kind]))
                    }
                    style={on ? { borderColor: `${s.accent}80`, background: `${s.accent}18` } : {}}
                    className={cx(
                      'rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition',
                      on ? 'text-fg' : 'border-line bg-ink-750/60 text-fg-mute hover:text-fg',
                    )}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>
            {kinds.length > 0 && (
              <p className="mt-2 text-[12.5px] text-fg-mute">
                Estimare: <span className="font-mono text-brand-400">{fmt(total)}</span>
                {settings.vatPayer && ` (TVA ${settings.vatRate}% inclus)`} · fișele detaliate se
                completează în pagina programării.
              </p>
            )}
          </div>

          <Field label="Responsabil">
            <Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              {staff.map((s) => (
                <option key={s.id}>{s.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Slot primire mașină">
            <Input readOnly value={`${durationMin} min`} />
          </Field>

          {/* ---- execuția ---- */}
          <div className="rounded-lg border border-line bg-ink-750/60 p-4 sm:col-span-2">
            <div className="mono-label mb-3">Execuție</div>
            <div className="mb-3 flex flex-wrap gap-2">
              <Chip active={sameDay} onClick={() => setSameDay(true)}>
                În aceeași zi cu primirea
              </Chip>
              <Chip active={!sameDay} onClick={() => setSameDay(false)}>
                Altă dată
              </Chip>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {!sameDay && (
                <>
                  <Field label="Data execuției">
                    <Input
                      type="date"
                      value={workDate}
                      onChange={(e) => setWorkDate(e.target.value)}
                    />
                  </Field>
                  <Field label="Ora de start">
                    <Input type="time" value={workTime} onChange={(e) => setWorkTime(e.target.value)} />
                  </Field>
                </>
              )}
              <Field
                label="Timp de lucru estimat"
                hint={
                  kinds.length
                    ? `Sugestie din servicii: ${(suggested / 60).toFixed(1)} h${
                        estimateTouched ? ' (suprascris manual)' : ''
                      }`
                    : 'Alege serviciile pentru o sugestie automată.'
                }
              >
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step={15}
                    value={estimate}
                    onChange={(e) => {
                      setEstimate(Number(e.target.value))
                      setEstimateTouched(true)
                    }}
                  />
                  <span className="self-center font-mono text-[12px] text-fg-mute">min</span>
                  {estimateTouched && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-none"
                      onClick={() => {
                        setEstimateTouched(false)
                        setEstimate(suggested)
                      }}
                    >
                      auto
                    </Button>
                  )}
                </div>
              </Field>
            </div>
            {estimate > 0 && (
              <p className="mt-3 text-[12.5px] text-fg-mute">
                Execuție:{' '}
                <span className="font-mono text-fg">
                  {format(parseISO(workStartISO()), 'dd MMM · HH:mm', { locale: ro })} →{' '}
                  {format(parseISO(workEndISO()), 'dd MMM · HH:mm', { locale: ro })}
                </span>{' '}
                ({(estimate / 60).toFixed(1)} h)
              </p>
            )}
          </div>

          <Field label="Mențiuni" className="sm:col-span-2">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </Field>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Persoană" required>
            <Select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tip">
            <Select value={type} onChange={(e) => setType(e.target.value as TimeOffType)}>
              {(Object.keys(TIME_OFF_LABEL) as TimeOffType[]).map((t) => (
                <option key={t} value={t}>
                  {TIME_OFF_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Perioadă">
            <Input
              readOnly
              value={`${range.startDate} → ${range.endDate} (${days} ${days === 1 ? 'zi' : 'zile'})`}
            />
          </Field>
          <Field label="Stare">
            <Select
              value={approved ? 'da' : 'nu'}
              onChange={(e) => setApproved(e.target.value === 'da')}
            >
              <option value="da">Aprobat</option>
              <option value="nu">În așteptare</option>
            </Select>
          </Field>
          <Field label="Notă" className="sm:col-span-2">
            <Textarea value={offNote} onChange={(e) => setOffNote(e.target.value)} rows={2} />
          </Field>
          <p className="text-[12px] text-fg-faint sm:col-span-2">
            Concediile sunt vizibile doar pentru owner și manager.{' '}
            <Badge tone="neutral">{me?.name}</Badge>
          </p>
        </div>
      )}
      <ClientModal
        open={clientModal}
        onClose={() => setClientModal(false)}
        onSaved={(c) => {
          setClientId(c.id)
          setCarId('')
          setCarModal(true)
        }}
      />
      <CarModal
        open={carModal}
        onClose={() => setCarModal(false)}
        defaultClientId={clientId}
        onSaved={(c) => setCarId(c.id)}
      />
    </Modal>
  )
}

/** helper exportat pentru pagina de concedii */
export const rangeDays = (start: string, end: string) =>
  differenceInCalendarDays(parseISO(end), parseISO(start)) + 1

export const nextDay = (iso: string) => format(addDays(parseISO(iso), 1), 'yyyy-MM-dd')
