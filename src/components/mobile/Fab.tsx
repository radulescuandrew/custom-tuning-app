import { IconPlus } from '../Icons'

export function Fab({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+72px)] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-xl active:brightness-110 md:hidden"
    >
      <IconPlus width={24} height={24} />
    </button>
  )
}
