import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import roLocale from '@fullcalendar/core/locales/ro'
import type { DatesSetArg } from '@fullcalendar/core'
import { addMinutes, differenceInMinutes, format } from 'date-fns'
import type { Job } from '@/data/types'
import { canSeeTimeOff, useCurrentUser, useStore } from '@/data/store'
import { Button, Chip, Select } from '@/components/ui'
import { IconChevronLeft, IconChevronRight } from '@/components/Icons'
import QuickCreateModal, { type QuickRange } from '@/components/modals/QuickCreateModal'
import { cx } from '@/lib/utils'
import { type Layer, useCalendarEvents } from './useCalendarEvents'
import { toFullCalendarEvents } from './fullCalendarAdapter'

export type CalendarMode = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay'

const MODES: { key: CalendarMode; label: string }[] = [
  { key: 'dayGridMonth', label: 'Lună' },
  { key: 'timeGridWeek', label: 'Săptămână' },
  { key: 'timeGridDay', label: 'Zi' },
]

const dayKey = (d: Date) => format(d, 'yyyy-MM-dd')

export default function JobCalendar({ jobs }: { jobs: Job[] }) {
  const nav = useNavigate()
  const api = useRef<FullCalendar>(null)
  const { staff, updateJob, toast } = useStore()
  const me = useCurrentUser()
  const showTimeOff = canSeeTimeOff(me?.role)

  const [mode, setMode] = useState<CalendarMode>('dayGridMonth')
  const [title, setTitle] = useState('')
  const [quick, setQuick] = useState<QuickRange | null>(null)
  const [layers, setLayers] = useState<Layer[]>(['primire', 'executie'])
  const [who, setWho] = useState<string>('toti')

  const toggleLayer = (l: Layer) =>
    setLayers((s) => (s.includes(l) ? s.filter((x) => x !== l) : [...s, l]))

  const calEvents = useCalendarEvents(jobs, { layers, who })
  const events = useMemo(() => toFullCalendarEvents(calEvents), [calEvents])

  const go = (dir: 'prev' | 'next' | 'today') => {
    const cal = api.current?.getApi()
    if (!cal) return
    dir === 'prev' ? cal.prev() : dir === 'next' ? cal.next() : cal.today()
  }

  const changeMode = (m: CalendarMode) => {
    setMode(m)
    api.current?.getApi().changeView(m)
  }

  return (
    <div className="ct-calendar rounded-xl border border-line bg-ink-850">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => go('prev')} aria-label="Anterior">
            <IconChevronLeft width={16} height={16} />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => go('next')} aria-label="Următor">
            <IconChevronRight width={16} height={16} />
          </Button>
        </div>
        <h3 className="text-[15px] font-bold capitalize">{title}</h3>
        <Button size="sm" variant="subtle" onClick={() => go('today')}>
          Azi
        </Button>
        <div className="ml-auto flex gap-1.5">
          {MODES.map((m) => (
            <Chip key={m.key} active={mode === m.key} onClick={() => changeMode(m.key)}>
              {m.label}
            </Chip>
          ))}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-2.5">
        <span className="mono-label">Afișează</span>
        <button
          onClick={() => toggleLayer('primire')}
          className={cx(
            'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12.5px] font-semibold transition',
            layers.includes('primire')
              ? 'border-line-strong bg-ink-750 text-fg'
              : 'border-line text-fg-faint',
          )}
        >
          <span className="h-3 w-3 rounded-[3px] border-2 border-fg-mute bg-white" /> Primire mașină
        </button>
        <button
          onClick={() => toggleLayer('executie')}
          className={cx(
            'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12.5px] font-semibold transition',
            layers.includes('executie')
              ? 'border-line-strong bg-ink-750 text-fg'
              : 'border-line text-fg-faint',
          )}
        >
          <span className="h-3 w-3 rounded-[3px] border-l-[3px] border-brand-500 bg-brand-500/20" />{' '}
          Execuție
        </button>
        {showTimeOff && (
          <button
            onClick={() => toggleLayer('concedii')}
            title="Concediile întregii echipe — se afișează la cerere, altfel acoperă programările"
            className={cx(
              'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12.5px] font-semibold transition',
              layers.includes('concedii')
                ? 'border-line-strong bg-ink-750 text-fg'
                : 'border-line text-fg-faint',
            )}
          >
            <span className="h-3 w-3 rounded-[3px] bg-[#5b8def]/40" /> Concedii
          </button>
        )}

        <span className="mono-label ml-2">Operator</span>
        {/* echipa are ~30 de oameni — un select grupat pe funcție, nu un zid de chips */}
        <Select
          value={who}
          onChange={(e) => setWho(e.target.value)}
          style={{ width: 210 }}
          className={cx('py-1.5 text-[12.5px]', who !== 'toti' && 'border-brand-500/60 text-brand-400')}
        >
          <option value="toti">Toți operatorii</option>
          {[...new Set(staff.map((s) => s.position || 'Echipă'))].sort((a, b) => a.localeCompare(b, 'ro')).map((pos) => (
            <optgroup key={pos} label={pos}>
              {staff
                .filter((s) => (s.position || 'Echipă') === pos)
                .map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </Select>
      </div>

      <div className="p-2">
        <FullCalendar
          ref={api}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale={roLocale}
          firstDay={1}
          headerToolbar={false}
          height="auto"
          expandRows
          nowIndicator
          slotMinTime="07:00:00"
          slotMaxTime="21:00:00"
          slotDuration="00:30:00"
          snapDuration="00:15:00"
          slotEventOverlap={false}
          eventMaxStack={4}
          allDaySlot={showTimeOff}
          allDayText="concedii"
          dayMaxEvents={3}
          moreLinkContent={(a) => `+${a.num} altele`}
          events={events}
          /* press & drag pe zile sau pe ore → creare rapidă */
          selectable
          selectMirror
          selectMinDistance={2}
          select={(info) => {
            setQuick(
              info.allDay
                ? {
                    kind: 'zile',
                    startDate: dayKey(info.start),
                    endDate: dayKey(addMinutes(info.end, -1)),
                  }
                : {
                    kind: 'ore',
                    startDate: dayKey(info.start),
                    endDate: dayKey(info.start),
                    startMin: info.start.getHours() * 60 + info.start.getMinutes(),
                    durationMin: Math.max(30, differenceInMinutes(info.end, info.start)),
                  },
            )
            api.current?.getApi().unselect()
          }}
          /* mutare / redimensionare */
          editable
          eventStartEditable
          eventDurationEditable
          eventDrop={(info) => {
            const kind = info.event.extendedProps.kind
            const start = info.event.start!
            if (kind === 'primire') {
              updateJob(info.event.id, { startAt: start.toISOString() })
              toast(`Primire mutată la ${format(start, 'dd.MM HH:mm')}`)
            } else if (kind === 'executie') {
              const jobId = info.event.id.replace('::work', '')
              updateJob(jobId, {
                workStartAt: start.toISOString(),
                workEndAt: info.event.end?.toISOString() ?? null,
              })
              toast(`Execuție mutată la ${format(start, 'dd.MM HH:mm')}`)
            } else {
              info.revert()
            }
          }}
          eventResize={(info) => {
            const { start, end } = info.event
            if (!start || !end) return
            const kind = info.event.extendedProps.kind
            if (kind === 'primire') {
              updateJob(info.event.id, { durationMin: differenceInMinutes(end, start) })
              toast('Slot de primire actualizat')
            } else if (kind === 'executie') {
              const jobId = info.event.id.replace('::work', '')
              updateJob(jobId, {
                workStartAt: start.toISOString(),
                workEndAt: end.toISOString(),
                estimateMin: differenceInMinutes(end, start),
                estimateManual: true,
              })
              toast(`Timp de lucru: ${(differenceInMinutes(end, start) / 60).toFixed(1)} ore`)
            }
          }}
          eventClick={(info) => {
            if (info.event.extendedProps.kind === 'timeoff') return nav('/concedii')
            nav(`/programari/${info.event.id.replace('::work', '')}`)
          }}
          eventContent={(arg) => {
            const p = arg.event.extendedProps as Record<string, string>
            if (p.kind === 'timeoff')
              return (
                <div className="truncate px-1.5 py-0.5 font-mono text-[10px] font-bold">
                  {arg.event.title}
                </div>
              )
            return (
              <div className="min-w-0 overflow-hidden px-1.5 py-0.5 leading-tight">
                <div className="flex items-center gap-1 truncate text-[11.5px] font-bold">
                  <span
                    className="font-mono text-[9px] font-bold uppercase"
                    style={{ color: p.color }}
                  >
                    {p.kind === 'primire' ? 'PRIM' : 'EXEC'}
                  </span>
                  {arg.timeText && <span className="font-mono">{arg.timeText}</span>}
                  <span className="truncate">{arg.event.title}</span>
                </div>
                <div className="truncate font-mono text-[10px] text-fg-mute">
                  {p.client} · {p.services} · {p.assignee}
                </div>
              </div>
            )
          }}
          datesSet={(arg: DatesSetArg) => {
            setTitle(arg.view.title)
            setMode(arg.view.type as CalendarMode)
          }}
        />
      </div>

      <QuickCreateModal range={quick} onClose={() => setQuick(null)} />
    </div>
  )
}
