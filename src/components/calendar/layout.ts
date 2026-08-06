/**
 * Geometria calendarului — numere pure, fără React și fără date-fns.
 * Tot ce se poate greși tăcut în grila orară stă aici și e acoperit de teste.
 */

export const DAY_START_MIN = 7 * 60
export const DAY_END_MIN = 21 * 60
export const SNAP_MIN = 15
export const MIN_BLOCK_MIN = 20
export const MAX_DENSITY_DOTS = 4
const SCROLL_ZONE = 0.15
const MAX_SCROLL_PX = 14

export interface Interval {
  id: string
  startMin: number
  endMin: number
}

export interface Placed extends Interval {
  col: number
  cols: number
}

/**
 * Împarte evenimentele unei zile pe coloane paralele.
 * Sortare după start → clustere de suprapunere → prima coloană liberă.
 */
export function layoutDay(items: Interval[]): Placed[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
  const out: Placed[] = []
  let cluster: Placed[] = []
  let clusterEnd = -Infinity
  let colEnds: number[] = []

  const flush = () => {
    const cols = colEnds.length || 1
    cluster.forEach((p) => out.push({ ...p, cols }))
    cluster = []
    colEnds = []
    clusterEnd = -Infinity
  }

  for (const it of sorted) {
    if (it.startMin >= clusterEnd) flush()
    let col = colEnds.findIndex((end) => end <= it.startMin)
    if (col === -1) {
      col = colEnds.length
      colEnds.push(it.endMin)
    } else {
      colEnds[col] = it.endMin
    }
    cluster.push({ ...it, col, cols: 1 })
    clusterEnd = Math.max(clusterEnd, it.endMin)
  }
  flush()

  return out.sort((a, b) => a.startMin - b.startMin || a.col - b.col)
}

export const snapMinutes = (min: number, step = SNAP_MIN) => Math.round(min / step) * step

export const minutesFromY = (y: number, pxPerMin: number, dayStartMin = DAY_START_MIN) =>
  dayStartMin + y / pxPerMin

export const yFromMinutes = (min: number, pxPerMin: number, dayStartMin = DAY_START_MIN) =>
  (min - dayStartMin) * pxPerMin

/**
 * Viteza de auto-scroll în px/cadru, când degetul intră în ultimele 15%
 * din înălțimea vizibilă. Negativ = în sus.
 */
export function autoScrollSpeed(pointerY: number, top: number, height: number): number {
  const zone = height * SCROLL_ZONE
  const rel = pointerY - top
  if (rel < zone) return -MAX_SCROLL_PX * Math.min(1, (zone - rel) / zone)
  if (rel > height - zone) return MAX_SCROLL_PX * Math.min(1, (rel - (height - zone)) / zone)
  return 0
}

export interface DayDensity {
  tones: string[]
  total: number
}

/**
 * Rezumatul unei zile pentru celula de lună: câte un punct per status distinct,
 * cel mult patru, plus totalul netăiat al lucrărilor.
 */
export function dayDensity(tones: string[]): DayDensity {
  return {
    tones: [...new Set(tones)].slice(0, MAX_DENSITY_DOTS),
    total: tones.length,
  }
}
