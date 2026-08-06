import { useMemo } from 'react'
import { addDays, format, isSameDay, isToday, startOfDay } from 'date-fns'
import { ro } from 'date-fns/locale'
import { cx } from '@/lib/utils'
import type { CalEvent } from './useCalendarEvents'

const dayKey = (d: Date) => format(d, 'yyyy-MM-dd')

export function AgendaView({
  start,
  days = 14,
  events,
  onEventTap,
}: {
  start: Date
  days?: number
  events: CalEvent[]
  onEventTap: (e: CalEvent) => void
}) {
  const grouped = useMemo(() => {
    const buckets = new Map<string, CalEvent[]>()
    events.forEach((e) => {
      const k = dayKey(e.start)
      buckets.set(k, [...(buckets.get(k) ?? []), e])
    })
    buckets.forEach((list) => list.sort((a, b) => +a.start - +b.start))
    return Array.from({ length: days }, (_, i) => {
      const d = startOfDay(addDays(start, i))
      return { day: d, items: buckets.get(dayKey(d)) ?? [] }
    })
  }, [events, start, days])

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      {grouped.map(({ day, items }) => (
        <section key={day.toISOString()}>
          <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-ink-900/95 px-4 py-2 backdrop-blur">
            {isToday(day) && <span className="h-2 w-2 rounded-full bg-brand-500" />}
            <h3
              className={cx(
                'text-[13px] font-bold capitalize',
                isToday(day) ? 'text-brand-500' : 'text-fg-mute',
              )}
            >
              {format(day, 'EEEE, d MMMM', { locale: ro })}
            </h3>
          </header>

          {items.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-fg-faint">nimic programat</p>
          ) : (
            items.map((e) => (
              <button
                key={e.id}
                onClick={() => onEventTap(e)}
                className="flex min-h-[56px] w-full items-center gap-3 border-b border-line/60 px-4 py-2 text-left transition active:bg-black/[0.04]"
              >
                <span className="w-11 flex-none font-mono text-[11px] leading-tight text-fg-mute">
                  {e.allDay ? (
                    '—'
                  ) : (
                    <>
                      {format(e.start, 'HH:mm')}
                      <span className="block text-[9px] font-bold text-fg-faint uppercase">
                        {e.kind === 'primire' ? 'prim' : 'exec'}
                      </span>
                    </>
                  )}
                </span>
                {/* goală pentru primire, plină pentru execuție — aceeași distincție ca pe desktop */}
                <span
                  className="h-9 w-1.5 flex-none rounded-full border-[1.5px]"
                  style={{
                    borderColor: e.color,
                    backgroundColor: e.kind === 'primire' ? 'transparent' : e.color,
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{e.title}</span>
                  <span className="block truncate font-mono text-[11px] text-fg-mute">
                    {[e.client, e.services, e.assignee].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </button>
            ))
          )}
        </section>
      ))}
    </div>
  )
}

/** Evenimentele care încep în fereastra afișată de agendă. */
export const agendaWindow = (events: CalEvent[], start: Date, days: number) =>
  events.filter((e) =>
    Array.from({ length: days }, (_, i) => addDays(start, i)).some((d) => isSameDay(d, e.start)),
  )
