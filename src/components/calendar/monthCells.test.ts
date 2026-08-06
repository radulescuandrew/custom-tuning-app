import { describe, expect, it } from 'vitest'
import { format } from 'date-fns'
import { monthCells } from './MonthView'
import type { CalEvent } from './useCalendarEvents'

const anchor = new Date(2026, 7, 6) // 6 august 2026
const key = (d: Date) => format(d, 'yyyy-MM-dd')

const base: CalEvent = {
  id: 'a',
  jobId: 'j',
  code: 'PRG-1',
  kind: 'primire',
  title: 'Golf',
  start: new Date(2026, 7, 6, 9, 0),
  end: new Date(2026, 7, 6, 9, 30),
  allDay: false,
  color: '#d51f1f',
  client: 'X',
  plate: '',
  services: '',
  assignee: 'Robert',
  status: 'programat',
  editable: true,
}

const at = (id: string, d: Date, color = '#d51f1f'): CalEvent => ({
  ...base,
  id,
  start: d,
  end: d,
  color,
})

const cellFor = (cells: ReturnType<typeof monthCells>, d: Date) =>
  cells.find((c) => key(c.day) === key(d))!

describe('monthCells', () => {
  it('produce exact șase rânduri de câte șapte zile', () => {
    expect(monthCells(anchor, [])).toHaveLength(42)
  })

  it('începe de luni, chiar când luna începe altă zi', () => {
    expect(monthCells(anchor, [])[0].day.getDay()).toBe(1)
  })

  it('numără lucrările zilei și le reduce la statusuri distincte', () => {
    const d = new Date(2026, 7, 7, 9, 0)
    const cells = monthCells(anchor, [
      at('a', d, '#d51f1f'),
      at('b', new Date(2026, 7, 7, 11, 0), '#d51f1f'),
      at('c', new Date(2026, 7, 7, 14, 0), '#0f8f5d'),
    ])
    const cell = cellFor(cells, d)
    expect(cell.total).toBe(3)
    expect(cell.tones).toEqual(['#d51f1f', '#0f8f5d'])
  })

  it('lasă zilele goale fără puncte și fără total', () => {
    const cell = cellFor(monthCells(anchor, []), new Date(2026, 7, 20))
    expect(cell).toMatchObject({ total: 0, tones: [], offColor: null })
  })

  it('marchează fiecare zi acoperită de un concediu, nu doar prima', () => {
    const off: CalEvent = {
      ...base,
      id: 'off-1',
      kind: 'timeoff',
      allDay: true,
      color: '#5b8def',
      start: new Date(2026, 7, 10),
      end: new Date(2026, 7, 13), // exclusiv, deci acoperă 10-12
    }
    const cells = monthCells(anchor, [off])
    expect(cellFor(cells, new Date(2026, 7, 10)).offColor).toBe('#5b8def')
    expect(cellFor(cells, new Date(2026, 7, 12)).offColor).toBe('#5b8def')
    expect(cellFor(cells, new Date(2026, 7, 13)).offColor).toBeNull()
  })

  it('nu numără concediile ca lucrări', () => {
    const off: CalEvent = {
      ...base,
      id: 'off-1',
      allDay: true,
      start: new Date(2026, 7, 10),
      end: new Date(2026, 7, 11),
    }
    expect(cellFor(monthCells(anchor, [off]), new Date(2026, 7, 10)).total).toBe(0)
  })

  it('păstrează densitatea zilelor din lunile vecine care apar în grilă', () => {
    const d = new Date(2026, 6, 30, 9, 0) // 30 iulie, în primul rând
    const cells = monthCells(anchor, [at('a', d)])
    expect(cellFor(cells, d).total).toBe(1)
  })
})
