import type { ReactNode } from 'react'

export function StickyBar({ children }: { children: ReactNode }) {
  return (
    <div className="pb-safe sticky bottom-0 z-30 -mx-4 flex gap-2 border-t border-line bg-ink-900/95 px-4 pt-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
      {children}
    </div>
  )
}
