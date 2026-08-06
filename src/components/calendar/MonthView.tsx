import { useMemo, useRef } from 'react'
import {
  addDays,
  format,
  isSameMonth,
  isToday,
  isWithinInterval,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ro } from 'date-fns/locale'
import { cx } from '@/lib/utils'
import { useHaptics } from '@/hooks/useHaptics'
import { MAX_DENSITY_DOTS, dayDensity } from './layout'
import type { CalEvent } from './useCalendarEvents'

const ROWS = 6
const COLS = 7
const LONG_PRESS_MS = 400
const MOVE_TOLERANCE_PX = 10
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

const dayKey = (d: Date) => format(d, 'yyyy-MM-dd')

export interface MonthCell {
  day: Date
  tones: string[]
  total: number
  /** culoarea benzii de concediu, dacă ziua e acoperită */
  offColor: string | null
}

/**
 * Rezumatul celor 42 de zile ale grilei. La 55px lățime de celulă nu încape text —
 * ce se poate citi dintr-o privire e volumul și starea, nu cine și ce.
 */
export function monthCells(anchor: Date, events: CalEvent[]): MonthCell[] {
  const first = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 })

  const jobsByDay = new Map<string, string[]>()
  const allDay = events.filter((e) => e.allDay)

  events.forEach((e) => {
    if (e.allDay) return
    const k = dayKey(e.start)
    jobsByDay.set(k, [...(jobsByDay.get(k) ?? []), e.color])
  })

  return Array.from({ length: ROWS * COLS }, (_, i) => {
    const day = addDays(first, i)

    /** Concediile sunt intervale, deci se testează prin acoperire, nu prin ziua de start.
     *  `end` e exclusiv, ca la FullCalendar — de aici scăderea unei zile. */
    const covering = allDay.find((e) =>
      isWithinInterval(day, { start: e.start, end: addDays(e.end, -1) }),
    )

    const { tones, total } = dayDensity(jobsByDay.get(dayKey(day)) ?? [])
    return { day, tones, total, offColor: covering?.color ?? null }
  })
}

export function MonthView({
  anchor,
  events,
  onPickDay,
  onCreateDay,
}: {
  anchor: Date
  events: CalEvent[]
  onPickDay: (d: Date) => void
  onCreateDay: (d: Date) => void
}) {
  const cells = useMemo(() => monthCells(anchor, events), [anchor, events])
  const { tap } = useHaptics()

  const timer = useRef<number | null>(null)
  const fired = useRef(false)
  const origin = useRef({ x: 0, y: 0 })

  const clear = () => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
  }

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ touchAction: 'pan-x' }}>
      <div className="grid flex-none grid-cols-7 border-b border-line">
        {WEEKDAYS.map((w, i) => (
          <div
            key={i}
            className="py-1.5 text-center font-mono text-[10px] font-bold text-fg-faint uppercase"
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
        {cells.map(({ day, tones, total, offColor }) => {
          const outside = !isSameMonth(day, anchor)
          return (
            <button
              key={day.toISOString()}
              onPointerDown={(e) => {
                fired.current = false
                origin.current = { x: e.clientX, y: e.clientY }
                timer.current = window.setTimeout(() => {
                  fired.current = true
                  tap()
                  onCreateDay(day)
                }, LONG_PRESS_MS)
              }}
              onPointerMove={(e) => {
                if (
                  Math.abs(e.clientX - origin.current.x) > MOVE_TOLERANCE_PX ||
                  Math.abs(e.clientY - origin.current.y) > MOVE_TOLERANCE_PX
                )
                  clear()
              }}
              onPointerUp={() => {
                clear()
                if (!fired.current) onPickDay(day)
              }}
              onPointerCancel={clear}
              className={cx(
                'relative flex flex-col items-center gap-1 overflow-hidden border-r border-b border-line pt-1.5 text-center last:border-r-0',
                isToday(day) && 'bg-brand-500/8',
              )}
              aria-label={format(day, 'd MMMM yyyy', { locale: ro })}
            >
              {offColor && (
                <span
                  className="absolute inset-x-0 top-0 h-[3px]"
                  style={{ backgroundColor: offColor }}
                />
              )}

              <span
                className={cx(
                  'text-[13px] leading-none',
                  isToday(day) ? 'font-bold text-brand-500' : outside ? 'text-fg-faint' : 'text-fg',
                )}
              >
                {format(day, 'd')}
              </span>

              {total > 0 && (
                <>
                  <span className="flex gap-[3px]">
                    {tones.slice(0, MAX_DENSITY_DOTS).map((c, i) => (
                      <span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </span>
                  <span className="font-mono text-[11px] leading-none text-fg-mute">{total}</span>
                </>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
