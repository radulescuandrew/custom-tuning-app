import { describe, expect, it } from 'vitest'
import { ceramicUses } from './ceramics'
import type { ServiceEntry, StockItem } from './types'

const lot = (id: string, name: string, rollNumber: string, qty: number): StockItem => ({
  id,
  category: 'ceramica',
  maker: 'Krytex',
  name,
  rollNumber,
  finish: '',
  width: '',
  unit: 'buc',
  qty,
  minQty: 1,
  location: '',
  createdAt: '',
})

const svc = (values: Record<string, string>): ServiceEntry => ({
  id: 's1',
  kind: 'ceramica',
  values,
  elements: [],
  rollUsages: [],
  price: 0,
  done: false,
})

describe('ceramicUses', () => {
  const stock = [
    lot('a', 'Krytex Mega 8', 'KX-1', 3),
    lot('b', 'Krytex Mega 8', 'KX-2', 2),
    lot('c', 'Krytex 7H', 'KX-9', 0),
  ]

  it('alege lotul cu același cod ca sticla din fișă', () => {
    const [u] = ceramicUses(svc({ 'Krytex Mega 8__used': 'Da', 'Krytex Mega 8__code': 'kx-2' }), stock)
    expect(u.item?.id).toBe('b')
  })

  it('fără cod: primul lot cu stoc; produs epuizat sau lipsă = null', () => {
    const uses = ceramicUses(
      svc({ 'Krytex Mega 8__used': 'Da', 'Krytex 7H__used': 'Da', 'Krytex Mega Tex__used': 'Da' }),
      stock,
    )
    expect(uses.find((u) => u.product === 'Krytex Mega 8')?.item?.id).toBe('a')
    expect(uses.find((u) => u.product === 'Krytex 7H')?.item).toBeNull()
    expect(uses.find((u) => u.product === 'Krytex Mega Tex')?.item).toBeNull()
  })

  it('ignoră produsele nebifate și alte servicii', () => {
    expect(ceramicUses(svc({ 'Krytex Mega 8__used': 'Nu' }), stock)).toHaveLength(0)
    expect(ceramicUses({ ...svc({ 'Krytex Mega 8__used': 'Da' }), kind: 'detailing' }, stock)).toHaveLength(0)
  })
})
