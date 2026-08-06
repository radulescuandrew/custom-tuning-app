import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useCalendarEvents } from './useCalendarEvents'
import { useStore } from '@/data/store'
import type { Job } from '@/data/types'

const job = (over: Partial<Job>): Job =>
  ({
    id: 'j1',
    code: 'PRG-1',
    clientId: '',
    carId: '',
    status: 'programat',
    startAt: '2026-08-03T09:00:00.000Z',
    durationMin: 30,
    workStartAt: '2026-08-03T10:00:00.000Z',
    workEndAt: '2026-08-03T13:00:00.000Z',
    estimateMin: 180,
    estimateManual: false,
    actualStartAt: null,
    actualEndAt: null,
    deliveryAt: null,
    assignee: 'Robert',
    notes: '',
    services: [],
    photos: [],
    events: [],
    trackingToken: 't',
    createdAt: '2026-08-01T00:00:00.000Z',
    completedAt: null,
    ...over,
  }) as Job

const asRole = (role: 'owner' | 'operator') => {
  const member = useStore.getState().staff.find((s) => s.role === role)!
  useStore.getState().setCurrentUser(member.id)
}

describe('useCalendarEvents', () => {
  beforeEach(() => asRole('owner'))

  it('produce un eveniment de primire și unul de execuție', () => {
    const { result } = renderHook(() =>
      useCalendarEvents([job({})], { layers: ['primire', 'executie'], who: 'toti' }),
    )
    const kinds = result.current.filter((e) => e.kind !== 'timeoff').map((e) => e.kind)
    expect(kinds).toEqual(['primire', 'executie'])
  })

  it('ascunde stratul dezactivat', () => {
    const { result } = renderHook(() =>
      useCalendarEvents([job({})], { layers: ['primire'], who: 'toti' }),
    )
    expect(result.current.some((e) => e.kind === 'executie')).toBe(false)
  })

  it('filtrează după operator', () => {
    const { result } = renderHook(() =>
      useCalendarEvents([job({})], { layers: ['primire', 'executie'], who: 'Daniel' }),
    )
    expect(result.current.filter((e) => e.kind !== 'timeoff')).toHaveLength(0)
  })

  it('nu produce execuție pentru o lucrare fără workStartAt', () => {
    const { result } = renderHook(() =>
      useCalendarEvents([job({ workStartAt: null })], {
        layers: ['primire', 'executie'],
        who: 'toti',
      }),
    )
    expect(result.current.some((e) => e.kind === 'executie')).toBe(false)
  })

  it('duce statusul și culoarea pe eveniment', () => {
    const { result } = renderHook(() =>
      useCalendarEvents([job({ status: 'in_lucru' })], { layers: ['primire'], who: 'toti' }),
    )
    const ev = result.current.find((e) => e.kind === 'primire')!
    expect(ev.status).toBe('in_lucru')
    expect(ev.color).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('produce concedii pentru owner, ca evenimente all-day needitabile', () => {
    const { result } = renderHook(() => useCalendarEvents([], { layers: ['concedii'], who: 'toti' }))
    const off = result.current.filter((e) => e.kind === 'timeoff')
    expect(off.length).toBeGreaterThan(0)
    expect(off.every((e) => e.allDay && !e.editable)).toBe(true)
  })

  it('ascunde concediile când stratul e stins, chiar și pentru owner', () => {
    const { result } = renderHook(() =>
      useCalendarEvents([], { layers: ['primire', 'executie'], who: 'toti' }),
    )
    expect(result.current.some((e) => e.kind === 'timeoff')).toBe(false)
  })

  it('nu produce concedii pentru operator, nici cu stratul aprins', () => {
    asRole('operator')
    const { result } = renderHook(() => useCalendarEvents([], { layers: ['concedii'], who: 'toti' }))
    expect(result.current.some((e) => e.kind === 'timeoff')).toBe(false)
  })
})
