import { addDays, format, isWeekend, parseISO } from 'date-fns'
import { ro } from 'date-fns/locale'

export const uid = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

export const cx = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ')

export const fmtDate = (iso: string | null | undefined, pattern = 'dd MMM yyyy') =>
  iso ? format(parseISO(iso), pattern, { locale: ro }) : '—'

export const fmtDateTime = (iso: string | null | undefined) =>
  iso ? format(parseISO(iso), "dd MMM yyyy · HH:mm", { locale: ro }) : '—'

/** Spec: retusul se anunta la 7 zile LUCRATOARE de la finalizare. */
export const addBusinessDays = (from: Date, days: number) => {
  let d = from
  let left = days
  while (left > 0) {
    d = addDays(d, 1)
    if (!isWeekend(d)) left--
  }
  return d
}

/** Zile lucrătoare între două date, inclusiv ambele capete (concediul se numără așa). */
export const businessDaysBetween = (startISO: string, endISO: string) => {
  let d = parseISO(startISO)
  const end = parseISO(endISO)
  let n = 0
  while (d <= end) {
    if (!isWeekend(d)) n++
    d = addDays(d, 1)
  }
  return n
}

export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

export const toLocalInput = (iso: string) => format(parseISO(iso), "yyyy-MM-dd'T'HH:mm")

export const daysUntil = (iso: string) =>
  Math.ceil((parseISO(iso).getTime() - Date.now()) / 86_400_000)
