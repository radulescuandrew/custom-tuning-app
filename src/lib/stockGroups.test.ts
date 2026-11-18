import { describe, expect, it } from 'vitest'
import type { StockItem } from '@/data/types'
import { groupStock, incRollNumber, rollSummary } from './stockGroups'

const roll = (n: number, qty: number, extra: Partial<StockItem> = {}): StockItem => ({
  id: `r${n}`,
  category: 'ppf',
  maker: 'SunTek',
  name: 'PPF lucioasă',
  rollNumber: `R-${String(n).padStart(2, '0')}`,
  finish: 'lucioasa',
  width: '1.52',
  unit: 'm',
  qty,
  minQty: 15,
  location: 'A1',
  createdAt: '',
  rollLength: 15,
  ...extra,
})

describe('groupStock', () => {
  it('exemplul din ofertă: 10 role de 15 m, se folosesc 20 m → 8 role + 10 m, total 130 m', () => {
    // 20 m consumați: o rolă întreagă (15) + 5 m din următoarea
    const stock = Array.from({ length: 10 }, (_, i) => roll(i + 1, i === 0 ? 0 : i === 1 ? 10 : 15))
    const [g] = groupStock(stock)
    expect(g.total).toBe(130)
    expect(g.full).toBe(8)
    expect(g.empty).toBe(1)
    expect(rollSummary(g)).toBe('8 role + 10 m')
  })

  it('separă produsele după lățime / finisaj și calculează pragul pe produs', () => {
    const groups = groupStock([roll(1, 15), roll(2, 4, { width: '1.82' }), roll(3, 3)])
    expect(groups).toHaveLength(2)
    const g152 = groups.find((g) => g.width === '1.52')!
    expect(g152.total).toBe(18)
    expect(g152.low).toBe(false)
    expect(groups.find((g) => g.width === '1.82')!.low).toBe(true)
  })
})

describe('incRollNumber', () => {
  it('numerotează consecutiv, păstrând zerourile', () => {
    expect(incRollNumber('R-09', 0)).toBe('R-09')
    expect(incRollNumber('R-09', 2)).toBe('R-11')
    expect(incRollNumber('KX-99182', 1)).toBe('KX-99183')
    expect(incRollNumber('ABC', 1)).toBe('ABC-2')
  })
})
