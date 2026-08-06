import { useCallback, useEffect, useRef, useState } from 'react'
import { useHaptics } from '@/hooks/useHaptics'
import { autoScrollSpeed, snapMinutes } from './layout'

export interface DragState {
  id: string
  /** deplasare în minute, deja rotunjită la sfert de oră */
  deltaMin: number
  edge: 'move' | 'start' | 'end'
  /** offset în coloane de zi (doar view-ul 3 zile) */
  deltaDays: number
}

/** Cât se poate mișca degetul înainte ca gestul să fie al scroll-ului, nu al blocului. */
const MOVE_TOLERANCE_PX = 8

/**
 * Long-press → ridicare → drag cu snap la 15 minute și auto-scroll la margini.
 * Pe pointer events, ca să meargă identic cu mouse-ul în DevTools.
 */
export function useLongPressDrag({
  scrollRef,
  pxPerMin,
  colWidth,
  onCommit,
  holdMs = 400,
}: {
  scrollRef: React.RefObject<HTMLElement | null>
  pxPerMin: number
  /** lățimea unei coloane de zi, 0 dacă view-ul are o singură zi */
  colWidth: number
  onCommit: (s: DragState) => void
  holdMs?: number
}) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const { tap } = useHaptics()

  const startY = useRef(0)
  const startX = useRef(0)
  const lastY = useRef(0)
  const holdTimer = useRef<number | null>(null)
  const rafId = useRef<number | null>(null)
  /** px de auto-scroll acumulați, ca blocul să urmeze degetul peste conținutul mutat */
  const scrolled = useRef(0)
  const active = useRef<{ id: string; edge: 'move' | 'start' | 'end' } | null>(null)
  const dragRef = useRef<DragState | null>(null)

  const setDragBoth = (s: DragState | null) => {
    dragRef.current = s
    setDrag(s)
  }

  const stopRaf = () => {
    if (rafId.current !== null) cancelAnimationFrame(rafId.current)
    rafId.current = null
  }

  const cancel = useCallback(() => {
    if (holdTimer.current !== null) clearTimeout(holdTimer.current)
    holdTimer.current = null
    stopRaf()
    active.current = null
    scrolled.current = 0
    setDragBoth(null)
  }, [])

  /** Recalculează deltaMin/deltaDays din poziția curentă a degetului plus scroll-ul acumulat. */
  const applyPointer = useCallback(
    (clientY: number, clientX: number) => {
      const cur = dragRef.current
      if (!cur) return
      const dyPx = clientY - startY.current + scrolled.current
      const dxPx = clientX - startX.current
      setDragBoth({
        ...cur,
        deltaMin: snapMinutes(dyPx / pxPerMin),
        deltaDays: colWidth > 0 && cur.edge === 'move' ? Math.round(dxPx / colWidth) : 0,
      })
    },
    [pxPerMin, colWidth],
  )

  /** Bucla de auto-scroll: rulează cât degetul stă în ultimele 15% din înălțimea vizibilă. */
  const runAutoScroll = useCallback(() => {
    const tick = () => {
      const el = scrollRef.current
      if (!el || !dragRef.current) return
      const rect = el.getBoundingClientRect()
      const speed = autoScrollSpeed(lastY.current, rect.top, rect.height)
      if (speed !== 0) {
        const before = el.scrollTop
        el.scrollTop += speed
        scrolled.current += el.scrollTop - before
        applyPointer(lastY.current, startX.current)
      }
      rafId.current = requestAnimationFrame(tick)
    }
    stopRaf()
    rafId.current = requestAnimationFrame(tick)
  }, [scrollRef, applyPointer])

  useEffect(() => {
    if (!drag) return

    const onMove = (e: PointerEvent) => {
      lastY.current = e.clientY
      applyPointer(e.clientY, e.clientX)
    }
    const onUp = () => {
      const cur = dragRef.current
      if (cur) onCommit(cur)
      cancel()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && cancel()

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('keydown', onKey)
    }
  }, [drag, applyPointer, onCommit, cancel])

  useEffect(() => cancel, [cancel])

  const bind = useCallback(
    (id: string, edge: 'move' | 'start' | 'end' = 'move') => ({
      onPointerDown: (e: React.PointerEvent) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return
        const target = e.currentTarget as HTMLElement
        startY.current = e.clientY
        startX.current = e.clientX
        lastY.current = e.clientY
        scrolled.current = 0
        active.current = { id, edge }

        /** Până expiră timer-ul, gestul poate fi încă un scroll — îl abandonăm la prima mișcare. */
        const watch = (ev: PointerEvent) => {
          if (
            Math.abs(ev.clientY - startY.current) > MOVE_TOLERANCE_PX ||
            Math.abs(ev.clientX - startX.current) > MOVE_TOLERANCE_PX
          ) {
            if (holdTimer.current !== null) clearTimeout(holdTimer.current)
            holdTimer.current = null
            active.current = null
            window.removeEventListener('pointermove', watch)
          }
        }
        window.addEventListener('pointermove', watch)

        holdTimer.current = window.setTimeout(() => {
          window.removeEventListener('pointermove', watch)
          if (!active.current) return
          holdTimer.current = null
          try {
            target.setPointerCapture(e.pointerId)
          } catch {
            /* pointer-ul poate fi deja eliberat */
          }
          tap()
          setDragBoth({ id, edge, deltaMin: 0, deltaDays: 0 })
          runAutoScroll()
        }, holdMs)

        const cleanup = () => {
          window.removeEventListener('pointermove', watch)
          window.removeEventListener('pointerup', cleanup)
          if (holdTimer.current !== null) {
            clearTimeout(holdTimer.current)
            holdTimer.current = null
            active.current = null
          }
        }
        window.addEventListener('pointerup', cleanup)
      },
    }),
    [holdMs, tap, runAutoScroll],
  )

  return { drag, bind }
}
