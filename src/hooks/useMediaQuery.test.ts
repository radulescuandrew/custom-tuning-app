import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useMediaQuery } from './useMediaQuery'

function mockMatchMedia(initial: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>()
  const mql = {
    matches: initial,
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb),
  }
  vi.stubGlobal('matchMedia', () => mql)
  return {
    emit(matches: boolean) {
      mql.matches = matches
      listeners.forEach((cb) => cb({ matches } as MediaQueryListEvent))
    },
  }
}

describe('useMediaQuery', () => {
  it('returnează starea inițială', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    expect(result.current).toBe(true)
  })

  it('reacționează la schimbarea lățimii', () => {
    const mm = mockMatchMedia(false)
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    act(() => mm.emit(true))
    expect(result.current).toBe(true)
  })
})
