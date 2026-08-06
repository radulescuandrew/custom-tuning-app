import { useMemo, useState } from 'react'
import { addDays, addMinutes, differenceInMinutes, format, startOfDay } from 'date-fns'
import { ro } from 'date-fns/locale'
import type { Job } from '@/data/types'
import { carName, clientName, useStore } from '@/data/store'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { IconChevronLeft, IconChevronRight, IconFilter } from '@/components/Icons'
import QuickCreateModal, { type QuickRange } from '@/components/modals/QuickCreateModal'
import { cx } from '@/lib/utils'
import { CalendarPager, type PagerStep, shiftAnchor } from './CalendarPager'
import { MonthView } from './MonthView'
import { AgendaView } from './AgendaView'
import { TimeGridView, type MoveEdge, shiftedStart } from './TimeGridView'
import { EventSheet } from './EventSheet'
import { CalendarFilters, DEFAULT_FILTERS, type MobileFilters, activeFilterCount } from './CalendarFilters'
import { type CalEvent, useCalendarEvents } from './useCalendarEvents'

type View = 'luna' | 'agenda' | 'zi' | '3zile'

const VIEWS: { value: View; label: string }[] = [
  { value: 'luna', label: 'Lună' },
  { value: 'agenda', label: 'Agendă' },
  { value: 'zi', label: 'Zi' },
  { value: '3zile', label: '3 zile' },
]

const AGENDA_DAYS = 14

const STEP: Record<View, PagerStep> = {
  luna: { unit: 'month' },
  agenda: { unit: 'days', count: AGENDA_DAYS },
  zi: { unit: 'days', count: 1 },
  '3zile': { unit: 'days', count: 3 },
}

const dayKey = (d: Date) => format(d, 'yyyy-MM-dd')

const periodLabel = (view: View, anchor: Date) => {
  if (view === 'luna') return format(anchor, 'LLLL yyyy', { locale: ro })
  if (view === 'zi') return format(anchor, 'EEEE, d MMMM', { locale: ro })
  if (view === '3zile')
    return `${format(anchor, 'd MMM', { locale: ro })} – ${format(addDays(anchor, 2), 'd MMM', { locale: ro })}`
  return `${format(anchor, 'd MMM', { locale: ro })} – ${format(addDays(anchor, AGENDA_DAYS - 1), 'd MMM', { locale: ro })}`
}

export default function MobileCalendar({ jobs }: { jobs: Job[] }) {
  const { clients, cars, updateJob, toast } = useStore()

  const [view, setView] = useState<View>('luna')
  const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()))
  const [filters, setFilters] = useState<MobileFilters>(DEFAULT_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selected, setSelected] = useState<CalEvent | null>(null)
  const [quick, setQuick] = useState<QuickRange | null>(null)

  /** Statusul și căutarea taie lucrările — aceeași regulă pe care JobsPage o aplică pe desktop. */
  const narrowed = useMemo(() => {
    const q = filters.q.trim().toLowerCase()
    return jobs
      .filter((j) => j.status !== 'anulat')
      .filter((j) => (filters.status === 'toate' ? true : j.status === filters.status))
      .filter((j) => {
        if (!q) return true
        const client = clients.find((c) => c.id === j.clientId)
        const car = cars.find((c) => c.id === j.carId)
        return [j.code, clientName(client), carName(car), car?.plate, j.assignee]
          .join(' ')
          .toLowerCase()
          .includes(q)
      })
  }, [jobs, clients, cars, filters.status, filters.q])

  const events = useCalendarEvents(narrowed, { layers: filters.layers, who: filters.who })
  const activeCount = activeFilterCount(filters)

  /** Aceleași scrieri ca pe desktop — stratul decide ce câmpuri se ating. */
  const applyMove = (ev: CalEvent, deltaMin: number, deltaDays: number, edge: MoveEdge) => {
    if (!ev.jobId) return
    const start = shiftedStart(ev, edge === 'end' ? 0 : deltaMin, deltaDays)
    const end = addMinutes(
      shiftedStart(ev, edge === 'start' ? 0 : deltaMin, deltaDays),
      differenceInMinutes(ev.end, ev.start),
    )
    const durationMin = Math.max(15, differenceInMinutes(end, start))

    if (ev.kind === 'primire') {
      if (edge === 'move') {
        updateJob(ev.jobId, { startAt: start.toISOString() })
        toast(`Primire mutată la ${format(start, 'dd.MM HH:mm')}`)
      } else {
        updateJob(ev.jobId, { startAt: start.toISOString(), durationMin })
        toast('Slot de primire actualizat')
      }
      return
    }

    if (edge === 'move') {
      updateJob(ev.jobId, { workStartAt: start.toISOString(), workEndAt: end.toISOString() })
      toast(`Execuție mutată la ${format(start, 'dd.MM HH:mm')}`)
    } else {
      updateJob(ev.jobId, {
        workStartAt: start.toISOString(),
        workEndAt: end.toISOString(),
        estimateMin: durationMin,
        estimateManual: true,
      })
      toast(`Timp de lucru: ${(durationMin / 60).toFixed(1)} ore`)
    }
  }

  const openHourSlot = (at: Date) =>
    setQuick({
      kind: 'ore',
      startDate: dayKey(at),
      endDate: dayKey(at),
      startMin: at.getHours() * 60 + at.getMinutes(),
      durationMin: 30,
    })

  const renderPage = (start: Date) => {
    if (view === 'luna')
      return (
        <MonthView
          anchor={start}
          events={events}
          onPickDay={(d) => {
            setAnchor(startOfDay(d))
            setView('zi')
          }}
          /** O celulă de lună nu poartă oră, deci creăm pe zi întreagă. */
          onCreateDay={(d) => setQuick({ kind: 'zile', startDate: dayKey(d), endDate: dayKey(d) })}
        />
      )
    if (view === 'agenda')
      return (
        <AgendaView
          start={start}
          days={AGENDA_DAYS}
          events={events}
          onEventTap={setSelected}
        />
      )
    return (
      <TimeGridView
        start={start}
        days={view === 'zi' ? 1 : 3}
        events={events}
        onEventTap={setSelected}
        onEmptyLongPress={openHourSlot}
        onMove={applyMove}
        onPickDay={(d) => {
          setAnchor(startOfDay(d))
          setView('zi')
        }}
      />
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-ink-900">
      <header className="flex flex-none items-center gap-1 border-b border-line px-2 py-1.5">
        <button
          onClick={() => setAnchor(shiftAnchor(anchor, STEP[view], -1))}
          aria-label="Perioada anterioară"
          className="flex h-11 w-11 flex-none items-center justify-center text-fg-mute"
        >
          <IconChevronLeft width={18} height={18} />
        </button>

        <button
          onClick={() => setView('luna')}
          className="min-w-0 flex-1 truncate px-1 text-center text-[15px] font-bold capitalize"
        >
          {periodLabel(view, anchor)}
        </button>

        <button
          onClick={() => setAnchor(shiftAnchor(anchor, STEP[view], 1))}
          aria-label="Perioada următoare"
          className="flex h-11 w-11 flex-none items-center justify-center text-fg-mute"
        >
          <IconChevronRight width={18} height={18} />
        </button>

        <button
          onClick={() => setAnchor(startOfDay(new Date()))}
          className="h-11 flex-none rounded-lg px-2.5 text-[13px] font-semibold text-fg-mute"
        >
          Azi
        </button>

        <button
          onClick={() => setFiltersOpen(true)}
          aria-label="Filtre"
          className={cx(
            'relative flex h-11 w-11 flex-none items-center justify-center',
            activeCount > 0 ? 'text-brand-500' : 'text-fg-mute',
          )}
        >
          <IconFilter width={18} height={18} />
          {activeCount > 0 && (
            <span className="absolute top-1.5 right-1 rounded-full bg-brand-500 px-1 font-mono text-[9px] font-bold text-white">
              {activeCount}
            </span>
          )}
        </button>
      </header>

      <div className="flex-none px-2 pb-1.5">
        <SegmentedControl options={VIEWS} value={view} onChange={setView} />
      </div>

      <div className="min-h-0 flex-1">
        <CalendarPager
          key={view}
          anchor={anchor}
          step={STEP[view]}
          onAnchorChange={setAnchor}
          render={renderPage}
        />
      </div>

      <EventSheet event={selected} onClose={() => setSelected(null)} />
      <CalendarFilters
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        value={filters}
        onChange={setFilters}
        jobs={jobs.filter((j) => j.status !== 'anulat')}
      />
      <QuickCreateModal range={quick} onClose={() => setQuick(null)} />
    </div>
  )
}
