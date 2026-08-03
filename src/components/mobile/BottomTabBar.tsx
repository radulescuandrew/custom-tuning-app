import { NavLink } from 'react-router-dom'
import { cx } from '@/lib/utils'
import { useStore } from '@/data/store'
import { IconBox, IconCalendar, IconDashboard, IconMenu, IconUsers } from '../Icons'

const TABS = [
  { to: '/azi', label: 'Azi', Icon: IconDashboard },
  { to: '/programari', label: 'Calendar', Icon: IconCalendar },
  { to: '/clienti', label: 'Clienți', Icon: IconUsers },
  { to: '/stoc', label: 'Stoc', Icon: IconBox },
]

const item =
  'no-tap-highlight flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-[10px] font-semibold'

export function BottomTabBar({ onOpenMore }: { onOpenMore: () => void }) {
  const pending = useStore(
    (s) =>
      s.notifications.filter((n) => n.status === 'programata' && new Date(n.dueAt) <= new Date())
        .length,
  )

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-ink-900/95 backdrop-blur md:hidden">
      {TABS.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => cx(item, isActive ? 'text-brand-500' : 'text-fg-mute')}
        >
          <Icon />
          {label}
        </NavLink>
      ))}
      <button onClick={onOpenMore} className={cx(item, 'relative text-fg-mute')}>
        <IconMenu />
        Mai multe
        {pending > 0 && <span className="absolute top-2 right-1/4 h-2 w-2 rounded-full bg-ember" />}
      </button>
    </nav>
  )
}
