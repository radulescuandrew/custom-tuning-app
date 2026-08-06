import { useRef, useState, type ReactNode } from 'react'
import { addDays, addMonths, startOfMonth } from 'date-fns'

export type PagerStep = { unit: 'days'; count: number } | { unit: 'month' }

/** Pasul lunar trece prin startOfMonth, altfel o ancoră pe 31 sare peste februarie. */
export const shiftAnchor = (anchor: Date, step: PagerStep, dir: -1 | 1): Date =>
  step.unit === 'month'
    ? startOfMonth(addMonths(anchor, dir))
    : addDays(anchor, step.count * dir)

const CLAIM_PX = 10
const COMMIT_PX = 60
const FLICK_PX_PER_MS = 0.4

/**
 * Trei pagini — anterioară, curentă, următoare — într-un rând tras cu -100%.
 * Gestul e revendicat doar când e clar orizontal, ca scroll-ul vertical din grilă să rămână al grilei.
 */
export function CalendarPager({
  anchor,
  step,
  onAnchorChange,
  render,
}: {
  anchor: Date
  step: PagerStep
  onAnchorChange: (d: Date) => void
  render: (start: Date) => ReactNode
}) {
  const [dx, setDx] = useState(0)
  const [animating, setAnimating] = useState(false)
  const startX = useRef(0)
  const startY = useRef(0)
  const startT = useRef(0)
  const claimed = useRef(false)
  const width = useRef(1)

  const settle = (dir: -1 | 1 | 0) => {
    setAnimating(true)
    setDx(dir * width.current * -1)
    window.setTimeout(() => {
      setAnimating(false)
      setDx(0)
      if (dir !== 0) onAnchorChange(shiftAnchor(anchor, step, dir))
    }, 200)
  }

  return (
    <div
      className="relative h-full overflow-hidden"
      style={{ touchAction: 'pan-y' }}
      onPointerDown={(e) => {
        if (animating) return
        startX.current = e.clientX
        startY.current = e.clientY
        startT.current = e.timeStamp
        claimed.current = false
        width.current = e.currentTarget.clientWidth || 1
      }}
      onPointerMove={(e) => {
        if (animating || !e.buttons) return
        const dX = e.clientX - startX.current
        const dY = e.clientY - startY.current
        if (!claimed.current) {
          if (Math.abs(dX) < CLAIM_PX || Math.abs(dX) <= Math.abs(dY)) return
          claimed.current = true
        }
        setDx(dX)
      }}
      onPointerUp={(e) => {
        if (!claimed.current) return
        claimed.current = false
        const dX = e.clientX - startX.current
        const speed = Math.abs(dX) / Math.max(1, e.timeStamp - startT.current)
        if (Math.abs(dX) > COMMIT_PX || speed > FLICK_PX_PER_MS) settle(dX < 0 ? 1 : -1)
        else settle(0)
      }}
      onPointerCancel={() => {
        claimed.current = false
        settle(0)
      }}
    >
      <div
        className="flex h-full w-[300%]"
        style={{
          transform: `translateX(calc(-33.3333% + ${dx}px))`,
          transition: animating ? 'transform 200ms cubic-bezier(.2,.8,.2,1)' : 'none',
        }}
      >
        <div className="h-full w-1/3 shrink-0">{render(shiftAnchor(anchor, step, -1))}</div>
        <div className="h-full w-1/3 shrink-0">{render(anchor)}</div>
        <div className="h-full w-1/3 shrink-0">{render(shiftAnchor(anchor, step, 1))}</div>
      </div>
    </div>
  )
}
