import { describe, expect, it } from 'vitest'
import { type PlacedEvent, preview } from './TimeGridView'
import { DAY_END_MIN, DAY_START_MIN, MIN_BLOCK_MIN } from './layout'
import type { CalEvent } from './useCalendarEvents'

const ev = { id: 'a' } as CalEvent

const at = (startMin: number, endMin: number): PlacedEvent => ({
  ev,
  startMin,
  endMin,
  col: 0,
  cols: 1,
})

const drag = (deltaMin: number, edge: 'move' | 'start' | 'end' = 'move') => ({
  id: 'a',
  deltaMin,
  edge,
  deltaDays: 0,
})

describe('preview', () => {
  it('lasă blocul neatins când nu el e tras', () => {
    expect(preview(at(540, 600), { ...drag(60), id: 'altul' })).toEqual({
      startMin: 540,
      endMin: 600,
    })
  })

  it('deplasează tot blocul, păstrându-i durata', () => {
    expect(preview(at(540, 600), drag(90))).toEqual({ startMin: 630, endMin: 690 })
  })

  it('nu lasă blocul să iasă peste capătul zilei', () => {
    /** Fără plafon, badge-ul afișa ore de după miezul nopții — „00:45" pentru un bloc de seară. */
    const out = preview(at(DAY_END_MIN - 60, DAY_END_MIN), drag(600))
    expect(out.endMin).toBe(DAY_END_MIN)
    expect(out.endMin - out.startMin).toBe(60)
  })

  it('nu lasă blocul să iasă înainte de începutul zilei', () => {
    const out = preview(at(DAY_START_MIN, DAY_START_MIN + 60), drag(-600))
    expect(out.startMin).toBe(DAY_START_MIN)
    expect(out.endMin - out.startMin).toBe(60)
  })

  it('la resize de sus nu trece de sfârșit minus înălțimea minimă', () => {
    const out = preview(at(540, 600), drag(600, 'start'))
    expect(out.startMin).toBe(600 - MIN_BLOCK_MIN)
    expect(out.endMin).toBe(600)
  })

  it('la resize de jos nu coboară sub înălțimea minimă', () => {
    const out = preview(at(540, 600), drag(-600, 'end'))
    expect(out.endMin).toBe(540 + MIN_BLOCK_MIN)
  })

  it('la resize de jos nu trece de capătul zilei', () => {
    expect(preview(at(1100, 1200), drag(600, 'end')).endMin).toBe(DAY_END_MIN)
  })
})
