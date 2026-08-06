import { describe, expect, it } from 'vitest'
import {
  autoScrollSpeed,
  dayDensity,
  layoutDay,
  minutesFromY,
  snapMinutes,
  yFromMinutes,
} from './layout'

describe('layoutDay', () => {
  it('pune evenimentele care nu se suprapun pe o singură coloană', () => {
    const out = layoutDay([
      { id: 'a', startMin: 540, endMin: 600 },
      { id: 'b', startMin: 600, endMin: 660 },
    ])
    expect(out.map((p) => [p.id, p.col, p.cols])).toEqual([
      ['a', 0, 1],
      ['b', 0, 1],
    ])
  })

  it('împarte două evenimente suprapuse în două coloane', () => {
    const out = layoutDay([
      { id: 'a', startMin: 540, endMin: 660 },
      { id: 'b', startMin: 570, endMin: 630 },
    ])
    expect(out.find((p) => p.id === 'a')).toMatchObject({ col: 0, cols: 2 })
    expect(out.find((p) => p.id === 'b')).toMatchObject({ col: 1, cols: 2 })
  })

  it('refolosește o coloană eliberată în același cluster', () => {
    const out = layoutDay([
      { id: 'a', startMin: 540, endMin: 720 },
      { id: 'b', startMin: 550, endMin: 600 },
      { id: 'c', startMin: 610, endMin: 660 },
    ])
    expect(out.find((p) => p.id === 'c')).toMatchObject({ col: 1, cols: 2 })
  })

  it('nu amestecă două clustere separate', () => {
    const out = layoutDay([
      { id: 'a', startMin: 540, endMin: 600 },
      { id: 'b', startMin: 545, endMin: 600 },
      { id: 'c', startMin: 700, endMin: 760 },
    ])
    expect(out.find((p) => p.id === 'c')).toMatchObject({ col: 0, cols: 1 })
  })
})

describe('snapMinutes', () => {
  it('rotunjește la sfertul de oră cel mai apropiat', () => {
    expect(snapMinutes(547)).toBe(540)
    expect(snapMinutes(553)).toBe(555)
  })
})

describe('minutesFromY / yFromMinutes', () => {
  it('sunt inverse', () => {
    const px = 1.2
    expect(minutesFromY(yFromMinutes(600, px, 420), px, 420)).toBeCloseTo(600)
  })
})

describe('autoScrollSpeed', () => {
  it('e zero în zona centrală', () => {
    expect(autoScrollSpeed(400, 0, 800)).toBe(0)
  })

  it('e negativ lângă marginea de sus și pozitiv lângă cea de jos', () => {
    expect(autoScrollSpeed(10, 0, 800)).toBeLessThan(0)
    expect(autoScrollSpeed(795, 0, 800)).toBeGreaterThan(0)
  })

  it('crește cu adâncimea în zonă', () => {
    expect(Math.abs(autoScrollSpeed(0, 0, 800))).toBeGreaterThan(
      Math.abs(autoScrollSpeed(100, 0, 800)),
    )
  })
})

describe('dayDensity', () => {
  it('o zi goală nu are nici puncte, nici total', () => {
    expect(dayDensity([])).toEqual({ tones: [], total: 0 })
  })

  it('păstrează un singur punct per status distinct', () => {
    expect(dayDensity(['brand', 'brand', 'mint'])).toEqual({ tones: ['brand', 'mint'], total: 3 })
  })

  it('păstrează ordinea primei apariții', () => {
    expect(dayDensity(['mint', 'brand', 'mint']).tones).toEqual(['mint', 'brand'])
  })

  it('taie punctele la patru, dar nu totalul', () => {
    const out = dayDensity(['a', 'b', 'c', 'd', 'e', 'a', 'b'])
    expect(out.tones).toEqual(['a', 'b', 'c', 'd'])
    expect(out.total).toBe(7)
  })
})
