import { useMemo, useRef, useState } from 'react'
import { differenceInCalendarDays, isWithinInterval, parseISO } from 'date-fns'
import { PageHeader } from '@/components/PageHeader'
import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  TableWrap,
  Td,
  Textarea,
  Th,
} from '@/components/ui'
import {
  ROLE_LABEL,
  TIME_OFF_COLOR,
  TIME_OFF_LABEL,
  canSeeTimeOff,
  leaveBalance,
  useCurrentUser,
  useStore,
} from '@/data/store'
import type { StaffMember, TimeOff, TimeOffType } from '@/data/types'
import { businessDaysBetween, cx, fmtDate, initials } from '@/lib/utils'
import { IconPlus, IconTrash, IconWarn } from '@/components/Icons'

const daysOf = (t: TimeOff) => businessDaysBetween(t.startDate, t.endDate)

const todayKey = () => new Date().toISOString().slice(0, 10)

type SortKey = 'nume' | 'ramase' | 'consumate' | 'vechime'

export default function TimeOffPage() {
  const { staff, timeOff, jobs, addTimeOff, updateTimeOff, removeTimeOff, toast } = useStore()
  const me = useCurrentUser()
  const [tab, setTab] = useState<'viitoare' | 'toate' | 'asteptare'>('viitoare')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortKey>('ramase')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<TimeOff | null>(null)
  const absenceListRef = useRef<HTMLDivElement>(null)
  const [form, setForm] = useState({
    staffId: '',
    type: 'concediu' as TimeOffType,
    startDate: '',
    endDate: '',
    note: '',
    approved: true,
  })

  const list = useMemo(() => {
    const today = todayKey()
    return timeOff
      .filter((t) =>
        tab === 'toate' ? true : tab === 'asteptare' ? !t.approved : t.endDate >= today,
      )
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
  }, [timeOff, tab])

  /** Situația pe fiecare angajat: drept pro-rata din data angajării, consumat, planificat, rămas. */
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    const all = staff
      .filter((p) => p.active)
      .map((p) => ({ person: p, bal: leaveBalance(p, timeOff) }))
      .filter((r) =>
        !s ? true : [r.person.name, r.person.position, ROLE_LABEL[r.person.role]].join(' ').toLowerCase().includes(s),
      )
    const by: Record<SortKey, (a: (typeof all)[number], b: (typeof all)[number]) => number> = {
      nume: (a, b) => a.person.name.localeCompare(b.person.name, 'ro'),
      /** cei cu sold mic primii — ei sunt cazurile de urmărit */
      ramase: (a, b) => a.bal.remaining - b.bal.remaining,
      consumate: (a, b) => b.bal.taken - a.bal.taken,
      vechime: (a, b) => a.person.hireDate.localeCompare(b.person.hireDate),
    }
    return all.sort(by[sort])
  }, [staff, timeOff, q, sort])

  /** Absențele care urmează în următoarele 60 de zile + cele în curs azi. */
  const upcoming = useMemo(() => {
    const today = todayKey()
    return timeOff
      .filter((t) => t.endDate >= today)
      .map((t) => ({
        t,
        person: staff.find((s) => s.id === t.staffId),
        inDays: differenceInCalendarDays(parseISO(t.startDate), new Date()),
      }))
      .filter((x) => x.inDays <= 60)
      .sort((a, b) => a.t.startDate.localeCompare(b.t.startDate))
  }, [timeOff, staff])

  const onLeaveToday = upcoming.filter((x) => x.t.startDate <= todayKey() && x.t.approved)
  const pendingCount = timeOff.filter((t) => !t.approved).length
  const teamRemaining = rows.reduce((s, r) => s + r.bal.remaining, 0)

  /** programări care cad peste o absență — conflicte de planificare */
  const conflicts = useMemo(
    () =>
      timeOff.flatMap((t) => {
        const person = staff.find((s) => s.id === t.staffId)
        if (!person) return []
        const interval = { start: parseISO(t.startDate), end: parseISO(`${t.endDate}T23:59:59`) }
        return jobs
          .filter(
            (j) =>
              j.status !== 'anulat' &&
              (t.type === 'inchis' || j.assignee === person.name) &&
              isWithinInterval(parseISO(j.startAt), interval),
          )
          .map((j) => ({ t, person, job: j }))
      }),
    [timeOff, staff, jobs],
  )

  if (!canSeeTimeOff(me?.role))
    return (
      <Card>
        <div className="flex items-center gap-3">
          <IconWarn className="text-ember" />
          <div>
            <p className="font-semibold">Acces restricționat</p>
            <p className="text-[13px] text-fg-mute">
              Concediile sunt vizibile doar pentru owner și manager. Ești logat ca {me?.name} (
              {ROLE_LABEL[me?.role ?? 'operator']}).
            </p>
          </div>
        </div>
      </Card>
    )

  const startAdd = (staffId?: string) => {
    const today = todayKey()
    setEditing(null)
    setForm({
      staffId: staffId ?? staff[0]?.id ?? '',
      type: 'concediu',
      startDate: today,
      endDate: today,
      note: '',
      approved: true,
    })
    setOpen(true)
  }

  const startEdit = (t: TimeOff) => {
    setEditing(t)
    setForm({
      staffId: t.staffId,
      type: t.type,
      startDate: t.startDate,
      endDate: t.endDate,
      note: t.note,
      approved: t.approved,
    })
    setOpen(true)
  }

  const save = () => {
    if (!form.staffId || !form.startDate || !form.endDate) return
    const payload = {
      ...form,
      endDate: form.endDate < form.startDate ? form.startDate : form.endDate,
    }
    if (editing) {
      updateTimeOff(editing.id, payload)
      toast('Absență actualizată')
    } else {
      addTimeOff(payload)
      toast('Absență adăugată')
    }
    setOpen(false)
  }

  /** Sare direct la lista filtrată — altfel cererile stau îngropate sub tabel. */
  const goToPending = () => {
    setTab('asteptare')
    requestAnimationFrame(() =>
      absenceListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    )
  }

  const kpis = [
    { label: 'Angajați activi', value: String(rows.length), sub: `${staff.length} în total` },
    {
      label: 'În concediu azi',
      value: String(onLeaveToday.length),
      sub: onLeaveToday.map((x) => x.person?.name.split(' ')[0]).slice(0, 3).join(', ') || 'nimeni',
    },
    {
      label: 'Cereri de aprobat',
      value: String(pendingCount),
      sub: pendingCount ? 'așteaptă decizie' : 'nimic în așteptare',
      cta: pendingCount ? { label: 'Vezi cererile', onClick: goToPending } : undefined,
      alert: pendingCount > 0,
    },
    {
      label: 'Zile rămase în echipă',
      value: String(teamRemaining),
      sub: `an ${new Date().getFullYear()}`,
    },
  ]

  return (
    <>
      <PageHeader
        title="Concedii & absențe"
        subtitle="Zile lucrătoare, drept pro-rata din data angajării. Vizibil doar pentru owner și manager."
        action={
          <Button variant="primary" onClick={() => startAdd()}>
            <IconPlus width={16} height={16} /> Adaugă absență
          </Button>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className={k.alert ? 'border-ember/50 bg-ember/[0.04]' : undefined}>
            <div className="mono-label">{k.label}</div>
            <div
              className={cx(
                'mt-2 text-[26px] leading-none font-extrabold',
                k.alert && 'text-ember',
              )}
            >
              {k.value}
            </div>
            <div className="mt-1 truncate text-[12px] text-fg-mute">{k.sub}</div>
            {k.cta && (
              <Button size="sm" variant="primary" className="mt-3 w-full" onClick={k.cta.onClick}>
                {k.cta.label} →
              </Button>
            )}
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_340px]">
        <Card
          title="Situația concediilor pe angajat"
          pad={false}
          action={
            <div className="flex items-center gap-2">
              <Select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                style={{ width: 180 }}
                className="py-1.5 text-[12px]"
              >
                <option value="ramase">Zile rămase ↑</option>
                <option value="consumate">Zile consumate ↓</option>
                <option value="nume">Nume A–Z</option>
                <option value="vechime">Vechime</option>
              </Select>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Caută angajat…"
                className="w-44 rounded-lg border border-line-strong bg-ink-750 px-3 py-1.5 text-[13px] outline-none focus:border-brand-500/60"
              />
            </div>
          }
        >
          {rows.length === 0 ? (
            <EmptyState text="Niciun angajat găsit." />
          ) : (
            <TableWrap>
              <thead className="border-b border-line">
                <tr>
                  <Th>Angajat</Th>
                  <Th>Angajare</Th>
                  <Th>Drept</Th>
                  <Th>Consumate</Th>
                  <Th>Planificate</Th>
                  <Th>Cereri</Th>
                  <Th>Rămase</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ person, bal }) => (
                  <tr key={person.id} className="border-b border-line/70 last:border-0 hover:bg-black/[0.035]">
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[10px] font-bold text-white"
                          style={{ background: person.color }}
                        >
                          {initials(person.name)}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{person.name}</div>
                          <div className="truncate text-[11.5px] text-fg-faint">
                            {person.position} · {ROLE_LABEL[person.role]}
                          </div>
                        </div>
                      </div>
                    </Td>
                    <Td className="font-mono text-[12px] text-fg-mute">
                      {fmtDate(person.hireDate)}
                      <div className="text-[11px] text-fg-faint">
                        {bal.tenureYears < 1
                          ? `${Math.round(bal.tenureYears * 12)} luni`
                          : `${bal.tenureYears.toFixed(1)} ani`}
                      </div>
                    </Td>
                    <Td className="font-mono">{bal.entitled}</Td>
                    <Td className="font-mono">{bal.taken}</Td>
                    <Td className="font-mono text-fg-mute">{bal.planned || '—'}</Td>
                    <Td>
                      {bal.pending ? (
                        <Badge tone="ember">{bal.pending} în cerere</Badge>
                      ) : (
                        <span className="text-fg-faint">—</span>
                      )}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono text-[15px] font-bold ${
                            bal.remaining <= 0
                              ? 'text-rose'
                              : bal.remaining <= 3
                                ? 'text-ember'
                                : 'text-mint'
                          }`}
                        >
                          {bal.remaining}
                        </span>
                        <div className="h-1.5 w-16 rounded-full bg-black/[0.08]">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, Math.max(0, (bal.remaining / Math.max(1, bal.entitled)) * 100))}%`,
                              background: person.color,
                            }}
                          />
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <Button size="sm" variant="subtle" onClick={() => startAdd(person.id)}>
                        + absență
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>

        <div className="flex flex-col gap-5">
          <Card title="Următoarele absențe" pad={false}>
            {upcoming.length === 0 ? (
              <EmptyState text="Nimic în următoarele 60 de zile." />
            ) : (
              <ul className="divide-y divide-line">
                {upcoming.slice(0, 12).map(({ t, person, inDays }) => (
                  <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                    <span
                      className="h-8 w-1 flex-none rounded-full"
                      style={{ background: TIME_OFF_COLOR[t.type] }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold">
                        {person?.name ?? '—'}
                        {!t.approved && <span className="ml-2 text-[11px] text-ember">cerere</span>}
                      </div>
                      <div className="truncate font-mono text-[11px] text-fg-faint">
                        {TIME_OFF_LABEL[t.type]} · {fmtDate(t.startDate, 'dd MMM')} →{' '}
                        {fmtDate(t.endDate, 'dd MMM')} · {daysOf(t)} zile
                      </div>
                    </div>
                    <span className="font-mono text-[11.5px] whitespace-nowrap text-fg-mute">
                      {inDays <= 0 ? 'în curs' : inDays === 1 ? 'mâine' : `în ${inDays} zile`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {pendingCount > 0 && (
            <Card title="Cereri în așteptare" pad={false}>
              <ul className="divide-y divide-line">
                {timeOff
                  .filter((t) => !t.approved)
                  .sort((a, b) => a.startDate.localeCompare(b.startDate))
                  .map((t) => {
                    const person = staff.find((s) => s.id === t.staffId)
                    return (
                      <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-semibold">{person?.name}</div>
                          <div className="truncate font-mono text-[11px] text-fg-faint">
                            {fmtDate(t.startDate, 'dd MMM')} → {fmtDate(t.endDate, 'dd MMM')} ·{' '}
                            {daysOf(t)} zile
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="subtle"
                          onClick={() => {
                            updateTimeOff(t.id, { approved: true })
                            toast('Cerere aprobată')
                          }}
                        >
                          Aprobă
                        </Button>
                      </li>
                    )
                  })}
              </ul>
            </Card>
          )}
        </div>
      </div>

      {conflicts.length > 0 && (
        <Card className="mt-5 border-ember/40" title="Conflicte cu programări">
          <ul className="flex flex-col gap-2">
            {conflicts.map(({ t, person, job }) => (
              <li key={`${t.id}-${job.id}`} className="flex flex-wrap items-center gap-2 text-[13px]">
                <IconWarn width={15} height={15} className="text-ember" />
                <span className="font-mono text-brand-400">{job.code}</span>
                <span className="text-fg-mute">
                  {fmtDate(job.startAt)} · responsabil {job.assignee}
                </span>
                <span className="text-fg-mute">
                  — {t.type === 'inchis' ? 'atelier închis' : `${person.name} în ${TIME_OFF_LABEL[t.type].toLowerCase()}`}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div ref={absenceListRef} className="mt-5 mb-4 flex scroll-mt-4 flex-wrap items-center gap-2">
        {(['viitoare', 'asteptare', 'toate'] as const).map((t) => (
          <Chip key={t} active={tab === t} onClick={() => setTab(t)}>
            {t === 'viitoare' ? 'Curente și viitoare' : t === 'asteptare' ? 'În așteptare' : 'Toate'}
            {t === 'asteptare' && pendingCount > 0 && (
              <span className="ml-1.5 rounded-full bg-ember px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                {pendingCount}
              </span>
            )}
          </Chip>
        ))}
        {tab === 'asteptare' && pendingCount > 0 && (
          <Button
            size="sm"
            variant="subtle"
            className="ml-auto"
            onClick={() => {
              if (!confirm(`Aprobi toate cele ${pendingCount} cereri?`)) return
              timeOff.filter((t) => !t.approved).forEach((t) => updateTimeOff(t.id, { approved: true }))
              toast(`${pendingCount} cereri aprobate`)
            }}
          >
            Aprobă toate ({pendingCount})
          </Button>
        )}
      </div>

      <Card pad={false}>
        {list.length === 0 ? (
          <EmptyState text="Nicio absență înregistrată." />
        ) : (
          <TableWrap>
            <thead className="border-b border-line">
              <tr>
                <Th>Persoană</Th>
                <Th>Tip</Th>
                <Th>Perioadă</Th>
                <Th>Zile</Th>
                <Th>Stare</Th>
                <Th>Notă</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {list.map((t) => {
                const person = staff.find((s) => s.id === t.staffId)
                return (
                  <tr key={t.id} className="border-b border-line/70 last:border-0 hover:bg-black/[0.035]">
                    <Td className="font-semibold">{person?.name ?? '—'}</Td>
                    <Td>
                      <span
                        className="rounded-md px-2 py-0.5 font-mono text-[10.5px] font-bold"
                        style={{
                          background: `${TIME_OFF_COLOR[t.type]}22`,
                          color: TIME_OFF_COLOR[t.type],
                        }}
                      >
                        {TIME_OFF_LABEL[t.type]}
                      </span>
                    </Td>
                    <Td className="font-mono text-[12.5px] text-fg-mute">
                      {fmtDate(t.startDate, 'dd MMM')} → {fmtDate(t.endDate, 'dd MMM yyyy')}
                    </Td>
                    <Td className="font-mono">{daysOf(t)}</Td>
                    <Td>
                      {t.approved ? (
                        <Badge tone="mint">aprobat</Badge>
                      ) : (
                        <Badge tone="ember">în așteptare</Badge>
                      )}
                    </Td>
                    <Td className="max-w-[260px] truncate text-fg-mute">{t.note || '—'}</Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        {!t.approved && (
                          <Button
                            size="sm"
                            variant="subtle"
                            onClick={() => {
                              updateTimeOff(t.id, { approved: true })
                              toast('Absență aprobată')
                            }}
                          >
                            Aprobă
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => startEdit(t)}>
                          Editează
                        </Button>
                        <button
                          onClick={() => {
                            if (confirm('Ștergi absența?')) removeTimeOff(t.id)
                          }}
                          className="text-fg-faint hover:text-rose"
                        >
                          <IconTrash width={15} height={15} />
                        </button>
                      </div>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Editează absența' : 'Absență nouă'}
        subtitle="Se poate adăuga și direct din calendar, trăgând peste zile."
        width="max-w-xl"
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Anulează</Button>
            <Button variant="primary" onClick={save}>
              Salvează
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Persoană" required className="sm:col-span-2">
            <Select
              value={form.staffId}
              onChange={(e) => setForm((f) => ({ ...f, staffId: e.target.value }))}
            >
              {groupByPosition(staff).map(([position, people]) => (
                <optgroup key={position} label={position}>
                  {people.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
          <Field label="Tip">
            <Select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as TimeOffType }))}
            >
              {(Object.keys(TIME_OFF_LABEL) as TimeOffType[]).map((t) => (
                <option key={t} value={t}>
                  {TIME_OFF_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Stare">
            <Select
              value={form.approved ? 'da' : 'nu'}
              onChange={(e) => setForm((f) => ({ ...f, approved: e.target.value === 'da' }))}
            >
              <option value="da">Aprobat</option>
              <option value="nu">În așteptare</option>
            </Select>
          </Field>
          <Field label="De la" required>
            <Input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            />
          </Field>
          <Field
            label="Până la (inclusiv)"
            required
            hint={
              form.startDate && form.endDate
                ? `${businessDaysBetween(form.startDate, form.endDate < form.startDate ? form.startDate : form.endDate)} zile lucrătoare`
                : undefined
            }
          >
            <Input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
            />
          </Field>
          {form.staffId && form.type === 'concediu' && (
            <div className="rounded-lg border border-line bg-ink-750 px-3 py-2 text-[12.5px] text-fg-mute sm:col-span-2">
              {(() => {
                const person = staff.find((s) => s.id === form.staffId)
                if (!person) return null
                const bal = leaveBalance(person, timeOff)
                const req =
                  form.startDate && form.endDate
                    ? businessDaysBetween(
                        form.startDate,
                        form.endDate < form.startDate ? form.startDate : form.endDate,
                      )
                    : 0
                const after = bal.remaining - (editing ? 0 : req)
                return (
                  <>
                    {person.name}: {bal.remaining} zile rămase din {bal.entitled}
                    {req > 0 && (
                      <>
                        {' '}
                        · după această cerere:{' '}
                        <span className={after < 0 ? 'font-bold text-rose' : 'font-bold text-fg'}>
                          {after}
                        </span>
                        {after < 0 && ' — depășește dreptul anual'}
                      </>
                    )}
                  </>
                )
              })()}
            </div>
          )}
          <Field label="Notă" className="sm:col-span-2">
            <Textarea
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              rows={2}
            />
          </Field>
        </div>
      </Modal>
    </>
  )
}

/** Selectorul de persoană devine greu la 30 de oameni — se grupează pe funcție. */
const groupByPosition = (staff: StaffMember[]): [string, StaffMember[]][] => {
  const map = new Map<string, StaffMember[]>()
  staff.forEach((s) => {
    const key = s.position || 'Echipă'
    map.set(key, [...(map.get(key) ?? []), s])
  })
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ro'))
}
