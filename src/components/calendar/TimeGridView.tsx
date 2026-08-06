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
import { useHaptics } from '@/hooks/useHaptics'
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
/** durata implicită a unei selecții noi, înainte de a fi trasă */
const SLOT_MIN = 30

const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes()

export type MoveEdge = 'move' | 'start' | 'end'

export interface PlacedEvent {
  ev: CalEvent
  startMin: number
  endMin: number
  col: number
  cols: number
}

/**
 * Evenimentele unei zile, decupate la fereastra vizibilă și repartizate pe coloane paralele.
 * `maxCols` plafonează lățimea împărțită: o zi cu 14 lucrări suprapuse ar da blocuri de 7px
 * pe un telefon. Ce nu încape se numără în `hidden`, ca desktopul cu `eventMaxStack`.
 */
export function placeDay(
  events: CalEvent[],
  day: Date,
  maxCols = Number.MAX_SAFE_INTEGER,
): { placed: PlacedEvent[]; hidden: number } {
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

  const all = layoutDay(intervals)
  const visible = all.filter((p) => p.col < maxCols)

  return {
    placed: visible.map((p) => ({
      ...p,
      cols: Math.min(p.cols, maxCols),
      ev: byId.get(p.id)!,
    })),
    hidden: all.length - visible.length,
  }
}

/**
 * Cum arată blocul în timpul gestului: start/end deplasate, încă necomise.
 * Totul rămâne în fereastra 07:00–21:00 — altfel un bloc tras în jos afișează ore de după miezul nopții.
 */
export function preview(p: PlacedEvent, drag: DragState | null) {
  if (!drag || drag.id !== p.ev.id) return { startMin: p.startMin, endMin: p.endMin }

  if (drag.edge === 'move') {
    const span = p.endMin - p.startMin
    const startMin = Math.min(
      Math.max(DAY_START_MIN, p.startMin + drag.deltaMin),
      DAY_END_MIN - span,
    )
    return { startMin, endMin: startMin + span }
  }

  if (drag.edge === 'start')
    return {
      startMin: Math.max(
        DAY_START_MIN,
        Math.min(p.startMin + drag.deltaMin, p.endMin - MIN_BLOCK_MIN),
      ),
      endMin: p.endMin,
    }

  return {
    startMin: p.startMin,
    endMin: Math.min(
      DAY_END_MIN,
      Math.max(p.endMin + drag.deltaMin, p.startMin + MIN_BLOCK_MIN),
    ),
  }
}

const hhmm = (min: number) =>
  `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(Math.round(min) % 60).padStart(2, '0')}`

/** Câte coloane paralele încap fără ca blocul să devină o așchie. */
const MAX_COLS: Record<1 | 3, number> = { 1: 4, 3: 2 }

export interface TimeGridProps {
  start: Date
  days: 1 | 3
  events: CalEvent[]
  onEventTap: (e: CalEvent) => void
  /** apăsare lungă pe gol, apoi tragere: start + durata trasă */
  onEmptySelect: (start: Date, durationMin: number) => void
  onMove: (e: CalEvent, deltaMin: number, deltaDays: number, edge: MoveEdge) => void
  /** tap pe „+N" dintr-o zi aglomerată — duce ziua aia pe tot ecranul */
  onPickDay?: (d: Date) => void
}

export function TimeGridView({
  start,
  days,
  events,
  onEventTap,
  onEmptySelect,
  onMove,
  onPickDay,
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
      {/* Într-o singură zi, bara de dată de deasupra spune deja ce zi e — antetul ar fi 60px pierduți. */}
      {days > 1 && (
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
      )}

      {/* py-2: eticheta primei ore e centrată pe linia 07:00, deci jumătate din ea cade deasupra grilei */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2">
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
                maxCols={MAX_COLS[days]}
                drag={drag}
                bind={bind}
                onEventTap={onEventTap}
                onEmptySelect={onEmptySelect}
                onPickDay={onPickDay}
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
  maxCols,
  drag,
  bind,
  onEventTap,
  onEmptySelect,
  onPickDay,
}: {
  day: Date
  events: CalEvent[]
  maxCols: number
  drag: DragState | null
  bind: (id: string, edge?: MoveEdge) => { onPointerDown: (e: React.PointerEvent) => void }
  onEventTap: (e: CalEvent) => void
  onEmptySelect: (start: Date, durationMin: number) => void
  onPickDay?: (d: Date) => void
}) {
  const { placed, hidden } = useMemo(
    () => placeDay(events, day, maxCols),
    [events, day, maxCols],
  )
  const { tap } = useHaptics()

  const pressTimer = useRef<number | null>(null)
  const anchorMin = useRef(0)
  /** intervalul desenat cât timp degetul e jos; null = nu selectăm */
  const [range, setRange] = useState<{ from: number; to: number } | null>(null)

  const cancelPress = () => {
    if (pressTimer.current !== null) clearTimeout(pressTimer.current)
    pressTimer.current = null
  }

  /**
   * La `pointerdown` coloana are încă `touch-action` permisiv, ca scroll-ul normal să meargă,
   * deci Chrome a apucat să clasifice gestul ca pan. Schimbarea proprietății după long-press
   * vine prea târziu — singurul lucru care mai oprește scroll-ul e `preventDefault` pe touchmove.
   */
  useEffect(() => {
    if (!range) return
    const stop = (e: TouchEvent) => e.preventDefault()
    window.addEventListener('touchmove', stop, { passive: false })
    return () => window.removeEventListener('touchmove', stop)
  }, [range])

  const minuteAt = (clientY: number, el: HTMLElement) =>
    snapMinutes(minutesFromY(clientY - el.getBoundingClientRect().top, PX_PER_MIN))

  const dateAt = (min: number) => {
    const d = new Date(day)
    d.setHours(Math.floor(min / 60), min % 60, 0, 0)
    return d
  }

  return (
    <div
      className="relative flex-1 border-l border-line"
      style={{ touchAction: range ? 'none' : undefined }}
      onPointerDown={(e) => {
        if (e.target !== e.currentTarget) return // apăsare pe un bloc, nu pe gol
        const el = e.currentTarget
        const min = minuteAt(e.clientY, el)
        anchorMin.current = min
        pressTimer.current = window.setTimeout(() => {
          pressTimer.current = null
          tap()
          el.setPointerCapture(e.pointerId)
          setRange({ from: min, to: min + SLOT_MIN })
        }, LONG_PRESS_MS)
      }}
      onPointerMove={(e) => {
        /** Înainte de long-press mișcarea aparține scroll-ului; după, extinde selecția. */
        if (!range) return cancelPress()
        const min = minuteAt(e.clientY, e.currentTarget)
        const from = Math.min(anchorMin.current, min)
        const to = Math.max(anchorMin.current + SLOT_MIN, min)
        setRange({
          from: Math.max(DAY_START_MIN, from),
          to: Math.min(DAY_END_MIN, Math.max(to, from + SLOT_MIN)),
        })
      }}
      onPointerUp={() => {
        cancelPress()
        if (!range) return
        onEmptySelect(dateAt(range.from), range.to - range.from)
        setRange(null)
      }}
      onPointerCancel={() => {
        cancelPress()
        setRange(null)
      }}
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

      {range && (
        <div
          className="pointer-events-none absolute inset-x-1 z-30 rounded-md border-2 border-brand-500 bg-brand-500/15"
          style={{
            top: yFromMinutes(range.from, PX_PER_MIN),
            height: (range.to - range.from) * PX_PER_MIN,
          }}
        >
          <span className="absolute -top-6 left-0 rounded-md bg-brand-500 px-1.5 py-0.5 font-mono text-[11px] font-bold whitespace-nowrap text-white">
            {hhmm(range.from)} – {hhmm(range.to)}
          </span>
        </div>
      )}

      {hidden > 0 && (
        <button
          onClick={() => onPickDay?.(day)}
          className="sticky top-1 z-10 float-right mr-1 rounded-md bg-ink-900 px-1.5 py-0.5 font-mono text-[10px] font-bold text-fg shadow-md"
        >
          +{hidden}
        </button>
      )}
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
      {/* Conținutul se decupează la cutia blocului; badge-ul și mânerele stau în afara ei, deci sunt frați. */}
      <div className="absolute inset-0 overflow-hidden rounded-md">
        {/* lipicioasă: un bloc de câteva ore rămâne altfel un dreptunghi anonim când e scrollat la mijloc */}
        <div className="sticky top-0 px-1.5 py-0.5">
          <div className="flex items-center gap-1 truncate text-[11.5px] leading-tight font-bold">
            <span className="font-mono text-[9px] font-bold uppercase" style={{ color: ev.color }}>
              {primire ? 'PRIM' : 'EXEC'}
            </span>
            <span className="font-mono">{format(ev.start, 'HH:mm')}</span>
            <span className="truncate">{ev.title}</span>
          </div>
          {/* Sub ~45 min a doua linie nu are loc și ar ieși peste blocul următor. */}
          {endMin - startMin >= 45 && (
            <div className="truncate font-mono text-[10px] leading-tight text-fg-mute">
              {ev.client} · {ev.services}
            </div>
          )}
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
