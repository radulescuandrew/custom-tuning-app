import { describe, expect, it } from 'vitest'
import { placeDay } from './TimeGridView'

const placeDayList = (...args: Parameters<typeof placeDay>) => placeDay(...args).placed
import { DAY_END_MIN, DAY_START_MIN, MIN_BLOCK_MIN } from './layout'
import type { CalEvent } from './useCalendarEvents'

const day = new Date(2026, 7, 6) // 6 august 2026, local

const ev = (id: string, from: [number, number], to: [number, number], over?: Partial<CalEvent>) =>
  ({
    id,
    jobId: id,
    code: 'PRG-1',
    kind: 'primire',
    title: 'Golf',
    start: new Date(2026, 7, 6, from[0], from[1]),
    end: new Date(2026, 7, 6, to[0], to[1]),
    allDay: false,
    color: '#d51f1f',
    client: 'X',
    plate: 'B 01 ABC',
    services: '',
    assignee: 'Robert',
    status: 'programat',
    editable: true,
    ...over,
  }) as CalEvent

describe('placeDay', () => {
  it('ignoră evenimentele din alte zile', () => {
    const other = ev('b', [9, 0], [10, 0], { start: new Date(2026, 7, 7, 9, 0) })
    expect(placeDay([ev('a', [9, 0], [10, 0]), other], day).placed.map((p) => p.ev.id)).toEqual(['a'])
  })

  it('ignoră evenimentele all-day', () => {
    expect(placeDay([ev('a', [9, 0], [10, 0], { allDay: true })], day).placed).toHaveLength(0)
  })

  it('taie startul la începutul ferestrei vizibile', () => {
    const [p] = placeDayList([ev('a', [5, 0], [8, 0])], day)
    expect(p.startMin).toBe(DAY_START_MIN)
  })

  it('taie sfârșitul la capătul ferestrei vizibile', () => {
    const [p] = placeDayList([ev('a', [20, 0], [23, 30])], day)
    expect(p.endMin).toBe(DAY_END_MIN)
  })

  it('duce un eveniment care trece de miezul nopții până la capătul ferestrei', () => {
    const [p] = placeDayList([ev('a', [20, 0], [1, 0], { end: new Date(2026, 7, 7, 1, 0) })], day)
    expect(p.endMin).toBe(DAY_END_MIN)
  })

  it('dă unui slot foarte scurt o înălțime minimă', () => {
    const [p] = placeDayList([ev('a', [9, 0], [9, 5])], day)
    expect(p.endMin - p.startMin).toBe(MIN_BLOCK_MIN)
  })

  it('pune două evenimente suprapuse pe coloane paralele', () => {
    const out = placeDayList([ev('a', [9, 0], [11, 0]), ev('b', [9, 30], [10, 30])], day)
    expect(out.every((p) => p.cols === 2)).toBe(true)
    expect(new Set(out.map((p) => p.col))).toEqual(new Set([0, 1]))
  })

  it('nu ascunde nimic cât timp coloanele încap în plafon', () => {
    const out = placeDay([ev('a', [9, 0], [11, 0]), ev('b', [9, 30], [10, 30])], day, 2)
    expect(out.hidden).toBe(0)
    expect(out.placed).toHaveLength(2)
  })

  it('taie coloanele peste plafon și le numără', () => {
    const many = Array.from({ length: 5 }, (_, i) => ev(String(i), [9, 0], [11, 0]))
    const out = placeDay(many, day, 2)
    expect(out.placed).toHaveLength(2)
    expect(out.hidden).toBe(3)
  })

  it('lățește blocurile rămase la plafon, nu la numărul real de coloane', () => {
    const many = Array.from({ length: 5 }, (_, i) => ev(String(i), [9, 0], [11, 0]))
    expect(placeDay(many, day, 2).placed.every((p) => p.cols === 2)).toBe(true)
  })
})
