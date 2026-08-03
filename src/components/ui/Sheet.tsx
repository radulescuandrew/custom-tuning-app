import { useEffect, useRef, useState, type ReactNode } from 'react'

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  const [dragY, setDragY] = useState(0)
  const startY = useRef(0)
  const dragging = useRef(false)

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', h)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  useEffect(() => {
    if (open) setDragY(0)
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div
        className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
        onClick={onClose}
        style={{ opacity: Math.max(0, 1 - dragY / 400) }}
      />
      <div
        className="animate-fade relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl border-t border-line-strong bg-ink-850 shadow-2xl"
        style={{
          transform: `translateY(${dragY}px)`,
          transition: dragging.current ? 'none' : 'transform 220ms cubic-bezier(.2,.8,.2,1)',
        }}
      >
        {/* mânerul de tras — singura zonă care închide prin gest */}
        <div
          className="flex-none cursor-grab touch-none py-3"
          onPointerDown={(e) => {
            dragging.current = true
            startY.current = e.clientY
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            if (!dragging.current) return
            setDragY(Math.max(0, e.clientY - startY.current))
          }}
          onPointerUp={() => {
            dragging.current = false
            setDragY((y) => {
              if (y > 110) onClose()
              return 0
            })
          }}
        >
          <div className="mx-auto h-1.5 w-11 rounded-full bg-line-strong" />
        </div>

        {title && (
          <header className="flex-none px-5 pb-3">
            <h3 className="text-base font-bold">{title}</h3>
            {subtitle && <p className="mt-0.5 text-[13px] text-fg-mute">{subtitle}</p>}
          </header>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>

        {footer && (
          <footer className="pb-safe flex flex-none gap-2 border-t border-line bg-ink-750/60 px-5 pt-4">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}
