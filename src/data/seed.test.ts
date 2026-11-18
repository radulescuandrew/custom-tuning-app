import { describe, expect, it } from 'vitest'
import { isSameMonth, parseISO, subMonths } from 'date-fns'
import { buildSeed } from './seed'

describe('istoricul demo (pentru rapoarte)', () => {
  const db = buildSeed()
  const past = db.jobs.filter((j) => j.code < 'PRG-2030')

  it('are lucrări predate în fiecare din ultimele 12 luni', () => {
    expect(past.length).toBeGreaterThan(30)
    for (let m = 1; m <= 11; m++) {
      const month = subMonths(new Date(), m)
      expect(past.some((j) => j.completedAt && isSameMonth(parseISO(j.completedAt), month))).toBe(true)
    }
  })

  it('codurile sunt unice și istoricul e predat, cu servicii finalizate', () => {
    expect(new Set(db.jobs.map((j) => j.code)).size).toBe(db.jobs.length)
    expect(past.every((j) => j.status === 'predat' && j.services.every((s) => s.done))).toBe(true)
  })

  it('consumul istoric e în jurnal, legat de lucrare, fără să schimbe stocul curent', () => {
    const withRolls = past.filter((j) => j.services.some((s) => s.rollUsages.length))
    expect(withRolls.length).toBeGreaterThan(0)
    for (const j of withRolls) expect(db.moves.some((m) => m.jobId === j.id && m.delta < 0)).toBe(true)
    expect(db.stock.every((i) => i.qty >= 0)).toBe(true)
  })
})
