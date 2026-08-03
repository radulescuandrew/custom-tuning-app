import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { cx, initials } from '@/lib/utils'
import { ROLE_LABEL, canSeeTimeOff, useCurrentUser, useStore } from '@/data/store'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { MobileHeader } from './mobile/MobileHeader'
import { SearchOverlay, useGlobalSearch } from './mobile/SearchOverlay'
import { BottomTabBar } from './mobile/BottomTabBar'
import { MoreSheet } from './mobile/MoreSheet'
import { Fab } from './mobile/Fab'
import {
  IconBell,
  IconBox,
  IconCalendar,
  IconCar,
  IconChart,
  IconDashboard,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSettings,
  IconUsers,
} from './Icons'
import { Avatar, Button } from './ui'
import { Logo } from './Logo'

const NAV = [
  { to: '/', label: 'Dashboard', Icon: IconDashboard, end: true },
  { to: '/programari', label: 'Programări', Icon: IconCalendar },
  { to: '/clienti', label: 'Clienți', Icon: IconUsers },
  { to: '/masini', label: 'Mașini', Icon: IconCar },
  { to: '/stoc', label: 'Stoc', Icon: IconBox },
  { to: '/notificari', label: 'Notificări', Icon: IconBell },
  { to: '/concedii', label: 'Concedii', Icon: IconUsers, managerOnly: true },
  { to: '/rapoarte', label: 'Rapoarte', Icon: IconChart },
  { to: '/setari', label: 'Setări', Icon: IconSettings, managerOnly: true },
]

function GlobalSearch() {
  const [q, setQ] = useState('')
  const nav = useNavigate()
  const results = useGlobalSearch(q).slice(0, 8)

  return (
    <div className="relative w-full max-w-md">
      <IconSearch
        width={16}
        height={16}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-faint"
      />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Caută client, mașină, nr. înmatriculare, PRG-…"
        className="w-full rounded-lg border border-line-strong bg-ink-750 py-2 pr-3 pl-9 text-sm outline-none placeholder:text-fg-faint focus:border-brand-500/60"
      />
      {results.length > 0 && (
        <div className="absolute top-full z-40 mt-2 w-full overflow-hidden rounded-lg border border-line-strong bg-ink-850 shadow-2xl">
          {results.map((r) => (
            <button
              key={r.to + r.label}
              onMouseDown={() => {
                nav(r.to)
                setQ('')
              }}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-black/[0.05]"
            >
              <span className="text-sm">{r.label}</span>
              <span className="font-mono text-[11px] text-fg-faint">{r.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Toasts() {
  const toasts = useStore((s) => s.toasts)
  return (
    <div className="pointer-events-none fixed top-3 right-3 left-3 z-[60] flex flex-col gap-2 md:top-auto md:right-6 md:bottom-6 md:left-auto">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            'animate-fade rounded-lg border px-4 py-3 text-sm font-semibold shadow-xl backdrop-blur',
            t.tone === 'ok' && 'border-mint/40 bg-mint/12 text-mint',
            t.tone === 'warn' && 'border-ember/40 bg-ember/12 text-ember',
            t.tone === 'info' && 'border-brand-500/40 bg-brand-500/12 text-brand-400',
          )}
        >
          {t.text}
        </div>
      ))}
    </div>
  )
}

export default function AppLayout() {
  const isDesktop = useIsDesktop()
  const nav = useNavigate()
  const { pathname } = useLocation()
  const [search, setSearch] = useState(false)
  const [more, setMore] = useState(false)

  if (isDesktop) return <DesktopShell />

  const showFab = pathname === '/azi' || pathname === '/programari'

  return (
    <div className="flex h-dvh flex-col">
      <MobileHeader onOpenSearch={() => setSearch(true)} onOpenMore={() => setMore(true)} />
      <main className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+72px)]">
        <Outlet />
      </main>
      {showFab && <Fab label="Programare nouă" onClick={() => nav('/programari/nou')} />}
      <BottomTabBar onOpenMore={() => setMore(true)} />
      <MoreSheet open={more} onClose={() => setMore(false)} />
      <SearchOverlay open={search} onClose={() => setSearch(false)} />
      <Toasts />
    </div>
  )
}

function DesktopShell() {
  const nav = useNavigate()
  const reset = useStore((s) => s.reset)
  const staff = useStore((s) => s.staff)
  const setCurrentUser = useStore((s) => s.setCurrentUser)
  const me = useCurrentUser()
  const pending = useStore(
    (s) => s.notifications.filter((n) => n.status === 'programata' && new Date(n.dueAt) <= new Date()).length,
  )
  /** cereri de concediu neaprobate — se văd din orice ecran */
  const leaveRequests = useStore((s) => s.timeOff.filter((t) => !t.approved).length)

  return (
    <div className="flex h-full">
      {/* sidebar */}
      <aside className="flex w-[236px] flex-none flex-col border-r border-line bg-ink-750 py-5">
        <div className="mb-3.5 border-b border-line px-5 pb-5">
          <Logo size="md" />
        </div>

        <nav className="flex flex-col gap-[3px] px-3">
          {NAV.filter((n) => !n.managerOnly || canSeeTimeOff(me?.role)).map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-3 rounded-[9px] px-3.5 py-2.5 text-sm font-semibold transition',
                  isActive
                    ? 'bg-brand-500/12 text-brand-400'
                    : 'text-fg-mute hover:bg-black/[0.045] hover:text-fg',
                )
              }
            >
              <Icon />
              <span className="flex-1">{label}</span>
              {to === '/notificari' && pending > 0 && (
                <span className="rounded-full bg-ember px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                  {pending}
                </span>
              )}
              {to === '/concedii' && leaveRequests > 0 && (
                <span className="rounded-full bg-ember px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                  {leaveRequests}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto px-3">
          <button
            onClick={() => {
              if (confirm('Resetezi datele demo la starea inițială?')) reset()
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] text-fg-faint transition hover:bg-black/[0.05] hover:text-fg-mute"
          >
            <IconRefresh width={15} height={15} /> Resetează demo
          </button>
          <div className="mt-2 flex items-center gap-3 border-t border-line px-1 pt-4">
            <Avatar text={initials(me?.name ?? '?')} />
            <div className="min-w-0 flex-1 leading-tight">
              <select
                value={me?.id}
                onChange={(e) => setCurrentUser(e.target.value)}
                title="Demo: schimbă utilizatorul pentru a vedea diferența de permisiuni"
                className="w-full cursor-pointer appearance-none bg-transparent text-[13px] font-semibold text-fg outline-none"
              >
                {staff.map((s) => (
                  <option key={s.id} value={s.id} className="bg-ink-850">
                    {s.name}
                  </option>
                ))}
              </select>
              <div className="text-[11px] text-fg-faint">{ROLE_LABEL[me?.role ?? 'operator']}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-none items-center gap-4 border-b border-line bg-ink-900/85 px-6 py-3.5 backdrop-blur">
          <GlobalSearch />
          <Button variant="primary" className="ml-auto" onClick={() => nav('/programari/nou')}>
            <IconPlus width={16} height={16} /> Programare
          </Button>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <Outlet />
        </main>
      </div>

      <Toasts />
    </div>
  )
}
