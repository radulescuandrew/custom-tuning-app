import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function PageHeader({
  title,
  subtitle,
  crumbs,
  action,
}: {
  title: ReactNode
  subtitle?: ReactNode
  crumbs?: { label: string; to?: string }[]
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {crumbs && crumbs.length > 0 && (
          <nav className="mb-1.5 flex items-center gap-1.5 font-mono text-[11px] tracking-wide text-fg-faint">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-fg-faint/60">/</span>}
                {c.to ? (
                  <Link to={c.to} className="text-fg-mute hover:text-brand-400">
                    {c.label}
                  </Link>
                ) : (
                  <span>{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="truncate text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] text-fg-mute">{subtitle}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  )
}
