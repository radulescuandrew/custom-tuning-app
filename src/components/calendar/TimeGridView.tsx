import { useEffect, useMemo, useRef, useState } from 'react'
import { addDays, addMinutes, format, isSameDay, startOfDay } from 'date-fns'
import { ro } from 'date-fns/locale'
import { cx } from '@/lib/utils'
import {
  DAY_END_MIN,
  DAY_START_MIN,
  MIN_BLOCK_MIN,
  type Interval,
  layoutDay,
  minutesFromY,
  snapMinutes,
  yFromMinutes,
} from './layout'
import { type DragState, useLongPressDrag } from './useLongPressDrag'
import type { CalEvent } from './useCalendarEvents'

export const PX_PER_MIN = 1.1
export const GUTTER_PX = 52
const GRID_HEIGHT = (DAY_END_MIN - DAY_START_MIN) * PX_PER_MIN
const HOURS = Array.from(
  { length: (DAY_END_MIN - DAY_START_MIN) / 60 + 1 },
  (_, i) => DAY_START_MIN / 60 + i,
)
const LONG_PRESS_MS = 400

const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes()

export type MoveEdge = 'move' | 'start' | 'end'

export interface PlacedEvent {
  ev: CalEvent
  startMin: number
  endMin: number
  col: number
  cols: number
}

/** Evenimentele unei zile, decupate la fereastra vizibilă și repartizate pe coloane paralele. */
export function placeDay(events: CalEvent[], day: Date): PlacedEvent[] {
  const onDay = events.filter((e) => !e.allDay && isSameDay(e.start, day))
  const byId = new Map(onDay.map((e) => [e.id, e]))

  const intervals: Interval[] = onDay.map((e) => {
    const startMin = Math.max(DAY_START_MIN, minutesOfDay(e.start))
    const rawEnd = isSameDay(e.end, day) ? minutesOfDay(e.end) : DAY_END_MIN
    return {
      id: e.id,
      startMin,
      endMin: Math.min(DAY_END_MIN, Math.max(startMin + MIN_BLOCK_MIN, rawEnd)),
    }
  })

  return layoutDay(intervals).map((p) => ({ ...p, ev: byId.get(p.id)! }))
}

/** Cum arată blocul în timpul gestului: start/end deplasate, încă necomise. */
function preview(p: PlacedEvent, drag: DragState | null) {
  if (!drag || drag.id !== p.ev.id) return { startMin: p.startMin, endMin: p.endMin }
  if (drag.edge === 'move')
    return { startMin: p.startMin + drag.deltaMin, endMin: p.endMin + drag.deltaMin }
  if (drag.edge === 'start')
    return {
      startMin: Math.min(p.startMin + drag.deltaMin, p.endMin - MIN_BLOCK_MIN),
      endMin: p.endMin,
    }
  return {
    startMin: p.startMin,
    endMin: Math.max(p.endMin + drag.deltaMin, p.startMin + MIN_BLOCK_MIN),
  }
}

const hhmm = (min: number) =>
  `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(Math.round(min) % 60).padStart(2, '0')}`

export interface TimeGridProps {
  start: Date
  days: 1 | 3
  events: CalEvent[]
  onEventTap: (e: CalEvent) => void
  onEmptyLongPress: (start: Date) => void
  onMove: (e: CalEvent, deltaMin: number, deltaDays: number, edge: MoveEdge) => void
}

export function TimeGridView({
  start,
  days,
  events,
  onEventTap,
  onEmptyLongPress,
  onMove,
}: TimeGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const colsRef = useRef<HTMLDivElement>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const columns = useMemo(
    () => Array.from({ length: days }, (_, i) => startOfDay(addDays(start, i))),
    [start, days],
  )

  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events])

  const { drag, bind } = useLongPressDrag({
    scrollRef,
    pxPerMin: PX_PER_MIN,
    colWidth: days > 1 ? (colsRef.current?.clientWidth ?? 0) / days : 0,
    onCommit: (s) => {
      const ev = byId.get(s.id)
      if (!ev) return
      if (s.deltaMin === 0 && s.deltaDays === 0) return
      onMove(ev, s.deltaMin, s.deltaDays, s.edge)
    },
  })

  /** Prima deschidere aterizează pe ora curentă, nu la 07:00. */
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const target = yFromMinutes(minutesOfDay(new Date()) - 60, PX_PER_MIN)
    el.scrollTop = Math.max(0, Math.min(target, GRID_HEIGHT - el.clientHeight))
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-none border-b border-line" style={{ paddingLeft: GUTTER_PX }}>
        {columns.map((d) => (
          <div key={d.toISOString()} className="flex-1 py-1.5 text-center">
            <div className="font-mono text-[10px] tracking-wide text-fg-faint uppercase">
              {format(d, 'EEE', { locale: ro })}
            </div>
            <div
              className={cx(
                'text-[15px] font-bold',
                isSameDay(d, now) ? 'text-brand-500' : 'text-fg',
              )}
            >
              {format(d, 'd')}
            </div>
          </div>
        ))}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="relative flex" style={{ height: GRID_HEIGHT }}>
          <div className="relative flex-none" style={{ width: GUTTER_PX }}>
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute right-2 -translate-y-1/2 font-mono text-[11px] text-fg-faint"
                style={{ top: yFromMinutes(h * 60, PX_PER_MIN) }}
              >
                {String(h).padStart(2, '0')}
              </div>
            ))}
          </div>

          <div ref={colsRef} className="flex flex-1">
            {columns.map((day) => (
              <DayColumn
                key={day.toISOString()}
                day={day}
                events={events}
                drag={drag}
                bind={bind}
                onEventTap={onEventTap}
                onEmptyLongPress={onEmptyLongPress}
              />
            ))}
          </div>

          {columns.some((d) => isSameDay(d, now)) &&
            minutesOfDay(now) >= DAY_START_MIN &&
            minutesOfDay(now) <= DAY_END_MIN && (
              <div
                className="pointer-events-none absolute right-0 z-10 flex items-center"
                style={{ left: GUTTER_PX - 4, top: yFromMinutes(minutesOfDay(now), PX_PER_MIN) }}
              >
                <span className="h-2 w-2 flex-none rounded-full bg-brand-500" />
                <span className="h-0.5 flex-1 bg-brand-500" />
              </div>
            )}
        </div>
      </div>
    </div>
  )
}

function DayColumn({
  day,
  events,
  drag,
  bind,
  onEventTap,
  onEmptyLongPress,
}: {
  day: Date
  events: CalEvent[]
  drag: DragState | null
  bind: (id: string, edge?: MoveEdge) => { onPointerDown: (e: React.PointerEvent) => void }
  onEventTap: (e: CalEvent) => void
  onEmptyLongPress: (start: Date) => void
}) {
  const placed = useMemo(() => placeDay(events, day), [events, day])
  const pressTimer = useRef<number | null>(null)

  const clearPress = () => {
    if (pressTimer.current !== null) clearTimeout(pressTimer.current)
    pressTimer.current = null
  }

  return (
    <div
      className="relative flex-1 border-l border-line"
      onPointerDown={(e) => {
        if (e.target !== e.currentTarget) return // apăsare pe un bloc, nu pe gol
        const rect = e.currentTarget.getBoundingClientRect()
        const offsetY = e.clientY - rect.top
        pressTimer.current = window.setTimeout(() => {
          const min = snapMinutes(minutesFromY(offsetY, PX_PER_MIN))
          const at = new Date(day)
          at.setHours(Math.floor(min / 60), min % 60, 0, 0)
          onEmptyLongPress(at)
        }, LONG_PRESS_MS)
      }}
      onPointerMove={clearPress}
      onPointerUp={clearPress}
      onPointerCancel={clearPress}
    >
      {HOURS.map((h) => (
        <div key={h}>
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-line-strong"
            style={{ top: yFromMinutes(h * 60, PX_PER_MIN) }}
          />
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-line"
            style={{ top: yFromMinutes(h * 60 + 30, PX_PER_MIN) }}
          />
        </div>
      ))}

      {placed.map((p) => (
        <EventBlock key={p.ev.id} placed={p} drag={drag} bind={bind} onTap={onEventTap} />
      ))}
    </div>
  )
}

function EventBlock({
  placed,
  drag,
  bind,
  onTap,
}: {
  placed: PlacedEvent
  drag: DragState | null
  bind: (id: string, edge?: MoveEdge) => { onPointerDown: (e: React.PointerEvent) => void }
  onTap: (e: CalEvent) => void
}) {
  const { ev, col, cols } = placed
  const primire = ev.kind === 'primire'
  const lifted = drag?.id === ev.id
  const { startMin, endMin } = preview(placed, drag)

  return (
    <div
      {...(ev.editable ? bind(ev.id) : {})}
      onClick={() => !lifted && onTap(ev)}
      className={cx(
        'absolute overflow-visible rounded-md text-left transition-[transform,box-shadow]',
        primire ? 'border border-dashed bg-white' : 'border-l-[3px]',
        lifted && 'z-20 scale-[1.03] shadow-xl',
      )}
      style={{
        top: yFromMinutes(startMin, PX_PER_MIN),
        height: (endMin - startMin) * PX_PER_MIN - 2,
        left: `calc(${(col / cols) * 100}% + 2px)`,
        width: `calc(${(1 / cols) * 100}% - 4px)`,
        borderColor: ev.color,
        backgroundColor: primire ? '#ffffff' : `${ev.color}26`,
        color: '#16161b',
        touchAction: ev.editable ? 'none' : undefined,
      }}
    >
      <div className="overflow-hidden px-1.5 py-1">
        <div className="flex items-center gap-1 truncate text-[11.5px] font-bold">
          <span className="font-mono text-[9px] font-bold uppercase" style={{ color: ev.color }}>
            {primire ? 'PRIM' : 'EXEC'}
          </span>
          <span className="font-mono">{format(ev.start, 'HH:mm')}</span>
          <span className="truncate">{ev.title}</span>
        </div>
        <div className="truncate font-mono text-[10px] text-fg-mute">
          {ev.client} · {ev.services}
        </div>
      </div>

      {lifted && (
        <>
          {/* ora propusă, cât timp blocul e ridicat */}
          <div className="pointer-events-none absolute -top-7 left-0 rounded-md bg-ink-900 px-2 py-1 font-mono text-[11px] font-bold whitespace-nowrap text-fg shadow-lg">
            {hhmm(startMin)} – {hhmm(endMin)}
          </div>
          {/* mânerele de resize apar doar pe blocul ridicat */}
          <span
            {...bind(ev.id, 'start')}
            className="absolute -top-5 left-1/2 h-11 w-11 -translate-x-1/2 cursor-ns-resize"
            style={{ touchAction: 'none' }}
          >
            <span
              className="absolute top-1/2 left-1/2 h-1 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ backgroundColor: ev.color }}
            />
          </span>
          <span
            {...bind(ev.id, 'end')}
            className="absolute -bottom-5 left-1/2 h-11 w-11 -translate-x-1/2 cursor-ns-resize"
            style={{ touchAction: 'none' }}
          >
            <span
              className="absolute top-1/2 left-1/2 h-1 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ backgroundColor: ev.color }}
            />
          </span>
        </>
      )}
    </div>
  )
}

/** Ora de start propusă după un drag, pentru scrierile din store. */
export const shiftedStart = (ev: CalEvent, deltaMin: number, deltaDays: number) =>
  addMinutes(addDays(ev.start, deltaDays), deltaMin)
