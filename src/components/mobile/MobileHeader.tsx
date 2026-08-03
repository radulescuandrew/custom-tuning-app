import { initials } from '@/lib/utils'
import { useCurrentUser } from '@/data/store'
import { IconSearch } from '../Icons'
import { Logo, LogoMark } from '../Logo'
import { Avatar } from '../ui'

export function MobileHeader({
  onOpenSearch,
  onOpenMore,
}: {
  onOpenSearch: () => void
  onOpenMore: () => void
}) {
  const me = useCurrentUser()

  return (
    <header className="pt-safe sticky top-0 z-30 flex flex-none items-center gap-2 border-b border-line bg-ink-900/95 px-3 backdrop-blur">
      <div className="flex min-h-[56px] min-w-0 flex-1 items-center gap-2.5">
        <LogoMark size={28} />
        <Logo size="sm" />
      </div>
      <button
        onClick={onOpenSearch}
        aria-label="Caută"
        className="no-tap-highlight flex h-11 w-11 flex-none items-center justify-center rounded-lg text-fg-mute active:bg-black/[0.05]"
      >
        <IconSearch width={20} height={20} />
      </button>
      <button
        onClick={onOpenMore}
        aria-label="Meniu"
        className="no-tap-highlight flex h-11 w-11 flex-none items-center justify-center rounded-lg active:bg-black/[0.05]"
      >
        <Avatar text={initials(me?.name ?? '?')} />
      </button>
    </header>
  )
}
