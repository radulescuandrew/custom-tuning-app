import { useCallback } from 'react'

/** iOS Safari nu implementează Vibration API — degradează tăcut. */
export function useHaptics() {
  const tap = useCallback(() => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(10)
  }, [])
  return { tap }
}
