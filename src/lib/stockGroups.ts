import type { StockCategory, StockItem } from '@/data/types'

/** Categoriile care se țin pe role (metri); restul sunt bucăți / loturi. */
export const isRollCategory = (c: StockCategory) =>
  c === 'ppf' || c === 'folie_color' || c === 'folie_geam'

/** Lungimea implicită a unei role noi (oferta: 15 m; colantul de culoare vine des la 5 m). */
export const defaultRollLength = (c: StockCategory) => (c === 'folie_color' ? 5 : 15)

/** Lungimea nominală a unei role — pentru rolele vechi fără câmp, 15 m. */
export const rollLength = (i: StockItem) => i.rollLength || 15

export interface StockGroup {
  key: string
  category: StockCategory
  maker: string
  name: string
  width: string
  finish: StockItem['finish']
  unit: StockItem['unit']
  location: string
  /** rolele / loturile produsului, ordonate după număr */
  items: StockItem[]
  total: number
  /** role pline (cât lungimea nominală) */
  full: number
  /** role începute, cu metri rămași */
  started: StockItem[]
  /** role consumate complet */
  empty: number
  /** pragul de alertă al produsului (cel mai mare dintre role) */
  minQty: number
  low: boolean
}

/** Același produs = aceeași categorie, producător, denumire, lățime și finisaj. */
export const groupKey = (i: StockItem) =>
  [i.category, i.maker, i.name, i.width, i.finish].join('|')

const round = (n: number) => Math.round(n * 100) / 100

export const groupStock = (stock: StockItem[]): StockGroup[] => {
  const map = new Map<string, StockItem[]>()
  for (const i of stock) {
    const k = groupKey(i)
    map.set(k, [...(map.get(k) ?? []), i])
  }
  return [...map.entries()].map(([key, items]) => {
    const sorted = [...items].sort((a, b) =>
      a.rollNumber.localeCompare(b.rollNumber, 'ro', { numeric: true }),
    )
    const first = sorted[0]
    const roll = isRollCategory(first.category)
    const total = round(sorted.reduce((s, i) => s + i.qty, 0))
    const minQty = Math.max(...sorted.map((i) => i.minQty))
    return {
      key,
      category: first.category,
      maker: first.maker,
      name: first.name,
      width: first.width,
      finish: first.finish,
      unit: first.unit,
      location: first.location,
      items: sorted,
      total,
      full: roll ? sorted.filter((i) => i.qty >= rollLength(i) - 0.001).length : 0,
      started: roll ? sorted.filter((i) => i.qty > 0 && i.qty < rollLength(i) - 0.001) : [],
      empty: roll ? sorted.filter((i) => i.qty <= 0).length : 0,
      minQty,
      low: total <= minQty,
    }
  })
}

/**
 * Rezumatul din ofertă: „8 role + 10 m” — rolele pline plus metrii rămași pe cele începute.
 * Rolele goale nu se numără.
 */
export const rollSummary = (g: StockGroup) => {
  const rest = round(g.started.reduce((s, i) => s + i.qty, 0))
  const parts: string[] = []
  if (g.full) parts.push(`${g.full} ${g.full === 1 ? 'rolă' : 'role'}`)
  if (rest) parts.push(`${rest} m`)
  return parts.join(' + ') || 'fără stoc'
}

/** Număr de rolă consecutiv: „R-09” + 2 → „R-11” (păstrează zerourile din față). */
export const incRollNumber = (rn: string, k: number) => {
  if (k === 0) return rn
  const m = rn.match(/^(.*?)(\d+)$/)
  if (!m) return `${rn}-${k + 1}`
  return `${m[1]}${String(Number(m[2]) + k).padStart(m[2].length, '0')}`
}
