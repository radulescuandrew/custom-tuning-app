import { describe, expect, it } from 'vitest'
import { amounts, fmtRon } from './money'
import type { Settings } from '@/data/types'

const base: Settings = {
  companyName: 'Custom Tuning SRL',
  vatId: 'RO12345678',
  vatPayer: true,
  vatRate: 21,
  pricesIncludeVat: true,
}

describe('amounts', () => {
  it('extrage TVA-ul dintr-un preț final', () => {
    const a = amounts(5600, base)
    expect(a.gross).toBe(5600)
    expect(a.net).toBe(4628.1)
    expect(a.vat).toBe(971.9)
    expect(a.showsVat).toBe(true)
  })

  it('adaugă TVA peste un preț de bază', () => {
    const a = amounts(1000, { ...base, pricesIncludeVat: false })
    expect(a.net).toBe(1000)
    expect(a.vat).toBe(210)
    expect(a.gross).toBe(1210)
  })

  it('nu arată nicio linie de TVA pentru firmă neplătitoare', () => {
    const a = amounts(1000, { ...base, vatPayer: false })
    expect(a).toMatchObject({ net: 1000, vat: 0, gross: 1000, rate: 0, showsVat: false })
  })
})

describe('fmtRon', () => {
  it('omite zecimalele pentru sume întregi', () => {
    expect(fmtRon(8900)).toBe('8.900 RON')
  })
})
