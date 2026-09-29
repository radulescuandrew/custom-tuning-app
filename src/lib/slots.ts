import { addDays, format, isSunday, setHours, setMinutes, startOfDay } from 'date-fns'
import type { Job, TimeOff } from '@/data/types'
import { timeOffCoversDay } from '@/data/store'

/** Program de lucru al atelierului (luni–sâmbătă). */
const WORK_START_H = 9
const WORK_END_H = 18
const DAY_MIN = (WORK_END_H - WORK_START_H) * 60

export interface FreeSlot {
  start: Date
  /** câte zile lucrătoare acoperă lucrarea (colantarea întreagă nu încape într-o zi) */
  days: number
}

const dayAt = (day: Date, h: number) => setMinutes(setHours(startOfDay(day), h), 0)

const isWorkday = (day: Date) => !isSunday(day)

/**
 * Caută intervale libere pentru execuție în următoarele zile: ocolește ferestrele de
 * lucru ale programărilor existente și zilele cu atelier închis. Lucrările mai lungi
 * de o zi cer zile consecutive complet libere.
 */
export const findFreeSlots = (
  jobs: Job[],
  timeOff: TimeOff[],
  durationMin: number,
  { count = 4, daysAhead = 21, from = new Date() }: { count?: number; daysAhead?: number; from?: Date } = {},
): FreeSlot[] => {
  if (!durationMin) return []
  const busy = jobs
    .filter((j) => j.status !== 'anulat' && j.workStartAt)
    .map((j) => ({
      start: new Date(j.workStartAt!).getTime(),
      end: new Date(
        j.workEndAt ?? new Date(new Date(j.workStartAt!).getTime() + j.estimateMin * 60_000),
      ).getTime(),
    }))
  const closed = timeOff.filter((t) => t.type === 'inchis' && t.approved)

  const dayIsOpen = (day: Date) =>
    isWorkday(day) && !closed.some((t) => timeOffCoversDay(t, format(day, 'yyyy-MM-dd')))

  const overlaps = (a: number, b: number) => busy.some((x) => a < x.end && b > x.start)

  const neededDays = Math.max(1, Math.ceil(durationMin / DAY_MIN))
  const out: FreeSlot[] = []

  for (let d = 1; d <= daysAhead && out.length < count; d++) {
    const day = addDays(from, d)
    if (!dayIsOpen(day)) continue

    if (neededDays === 1) {
      // căutăm primul început liber al zilei, în pași de 30 min
      for (let m = 0; m + durationMin <= DAY_MIN; m += 30) {
        const start = dayAt(day, WORK_START_H).getTime() + m * 60_000
        const end = start + durationMin * 60_000
        if (!overlaps(start, end)) {
          out.push({ start: new Date(start), days: 1 })
          break
        }
      }
      continue
    }

    // lucrare multi-zi: toate zilele necesare trebuie să fie deschise și complet libere
    let ok = true
    for (let k = 0; k < neededDays; k++) {
      const dk = addDays(day, k)
      if (
        !dayIsOpen(dk) ||
        overlaps(dayAt(dk, WORK_START_H).getTime(), dayAt(dk, WORK_END_H).getTime())
      ) {
        ok = false
        break
      }
    }
    if (ok) out.push({ start: dayAt(day, WORK_START_H), days: neededDays })
  }

  return out
}
