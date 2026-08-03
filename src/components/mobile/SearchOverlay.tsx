import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { carName, clientName, useStore } from '@/data/store'
import { IconChevronLeft } from '../Icons'

/** Căutarea globală — aceeași sursă pentru desktop și pentru overlay-ul mobil. */
export function useGlobalSearch(q: string) {
  const { clients, cars, jobs } = useStore()
  return useMemo(() => {
    const s = q.trim().toLowerCase()
    if (s.length < 2) return []
    const out: { label: string; sub: string; to: string }[] = []
    clients.forEach((c) => {
      const name = clientName(c)
      if ([name, c.phone, c.vatId, c.cnp].join(' ').toLowerCase().includes(s))
        out.push({ label: name, sub: c.phone || 'client', to: `/clienti/${c.id}` })
    })
    cars.forEach((c) => {
      if ([carName(c), c.plate, c.vin].join(' ').toLowerCase().includes(s))
        out.push({ label: carName(c), sub: c.plate, to: `/masini/${c.id}` })
    })
    jobs.forEach((j) => {
      if (j.code.toLowerCase().includes(s))
        out.push({ label: j.code, sub: 'programare', to: `/programari/${j.id}` })
    })
    return out.slice(0, 12)
  }, [q, clients, cars, jobs])
}

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('')
  const nav = useNavigate()
  const results = useGlobalSearch(q)

  useEffect(() => {
    if (!open) setQ('')
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink-900">
      <div className="pt-safe flex flex-none items-center gap-2 border-b border-line px-3 py-2">
        <button
          onClick={onClose}
          aria-label="Închide căutarea"
          className="flex h-11 w-11 flex-none items-center justify-center rounded-lg text-fg-mute"
        >
          <IconChevronLeft width={20} height={20} />
        </button>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Client, mașină, nr. înmatriculare, PRG-…"
          className="h-11 min-w-0 flex-1 rounded-lg border border-line-strong bg-ink-750 px-3 text-base outline-none placeholder:text-fg-faint focus:border-brand-500/60"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {results.map((r) => (
          <button
            key={r.to + r.label}
            onClick={() => {
              nav(r.to)
              onClose()
            }}
            className="flex min-h-[56px] w-full items-center justify-between gap-3 border-b border-line px-4 text-left"
          >
            <span className="truncate text-sm font-semibold">{r.label}</span>
            <span className="flex-none font-mono text-[11px] text-fg-faint">{r.sub}</span>
          </button>
        ))}
        {q.trim().length >= 2 && results.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-fg-mute">Niciun rezultat.</p>
        )}
      </div>
    </div>
  )
}
