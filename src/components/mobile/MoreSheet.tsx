import { useNavigate } from 'react-router-dom'
import { initials } from '@/lib/utils'
import {
  ROLE_LABEL,
  canEditSettings,
  canSeeTimeOff,
  useCurrentUser,
  useStore,
} from '@/data/store'
import {
  IconBell,
  IconCar,
  IconChart,
  IconChevronRight,
  IconDashboard,
  IconRefresh,
  IconSettings,
  IconUsers,
} from '../Icons'
import { Avatar } from '../ui'
import { Sheet } from '../ui/Sheet'

export function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate()
  const me = useCurrentUser()
  const staff = useStore((s) => s.staff)
  const setCurrentUser = useStore((s) => s.setCurrentUser)
  const reset = useStore((s) => s.reset)
  const pending = useStore(
    (s) =>
      s.notifications.filter((n) => n.status === 'programata' && new Date(n.dueAt) <= new Date())
        .length,
  )
  const leaveRequests = useStore((s) => s.timeOff.filter((t) => !t.approved).length)

  const links = [
    { to: '/', label: 'Dashboard', Icon: IconDashboard, badge: 0, show: true },
    { to: '/masini', label: 'Mașini', Icon: IconCar, badge: 0, show: true },
    { to: '/notificari', label: 'Notificări', Icon: IconBell, badge: pending, show: true },
    {
      to: '/concedii',
      label: 'Concedii',
      Icon: IconUsers,
      badge: leaveRequests,
      show: canSeeTimeOff(me?.role),
    },
    { to: '/rapoarte', label: 'Rapoarte', Icon: IconChart, badge: 0, show: true },
    {
      to: '/setari',
      label: 'Setări',
      Icon: IconSettings,
      badge: 0,
      show: canEditSettings(me?.role),
    },
  ].filter((l) => l.show)

  const go = (to: string) => {
    nav(to)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="mb-3 flex items-center gap-3 rounded-xl border border-line bg-ink-750 p-3">
        <Avatar text={initials(me?.name ?? '?')} />
        <div className="min-w-0 flex-1 leading-tight">
          <select
            value={me?.id}
            onChange={(e) => setCurrentUser(e.target.value)}
            className="w-full cursor-pointer appearance-none bg-transparent text-[15px] font-bold text-fg outline-none"
          >
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <div className="text-[12px] text-fg-faint">{ROLE_LABEL[me?.role ?? 'operator']}</div>
        </div>
      </div>

      <ul className="flex flex-col">
        {links.map(({ to, label, Icon, badge }) => (
          <li key={to}>
            <button
              onClick={() => go(to)}
              className="no-tap-highlight flex min-h-[52px] w-full items-center gap-3 border-b border-line text-left text-[15px] font-semibold active:bg-black/[0.04]"
            >
              <Icon />
              <span className="flex-1">{label}</span>
              {badge > 0 && (
                <span className="rounded-full bg-ember px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                  {badge}
                </span>
              )}
              <IconChevronRight width={16} height={16} className="text-fg-faint" />
            </button>
          </li>
        ))}

        <li>
          <button
            onClick={() => {
              if (confirm('Resetezi datele demo la starea inițială?')) {
                reset()
                onClose()
              }
            }}
            className="no-tap-highlight flex min-h-[52px] w-full items-center gap-3 text-left text-[15px] text-fg-mute active:bg-black/[0.04]"
          >
            <IconRefresh />
            <span className="flex-1">Resetează demo</span>
          </button>
        </li>
      </ul>
    </Sheet>
  )
}
