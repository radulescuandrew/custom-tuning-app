import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { useEffect } from 'react'
import { cx } from '@/lib/utils'
import { IconX } from './Icons'
import { Sheet } from './ui/Sheet'
import { useIsDesktop } from '@/hooks/useMediaQuery'

/* ---------- Button ---------- */
type BtnVariant = 'primary' | 'ghost' | 'outline' | 'danger' | 'subtle'
export function Button({
  variant = 'outline',
  size = 'md',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' }) {
  const variants: Record<BtnVariant, string> = {
    primary:
      'bg-gradient-to-br from-brand-500 to-brand-600 text-white font-bold hover:brightness-110',
    outline:
      'border border-line-strong bg-ink-800 text-fg hover:bg-ink-700 hover:border-line-strong',
    ghost: 'text-fg-mute hover:text-fg hover:bg-black/[0.05]',
    subtle: 'bg-black/[0.05] text-fg-dim hover:bg-black/10',
    danger: 'border border-rose/40 text-rose hover:bg-rose/10',
  }
  return (
    <button
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:opacity-40 disabled:pointer-events-none',
        size === 'sm' ? 'px-3 py-1.5 text-[13px]' : 'px-4 py-2.5 text-sm',
        variants[variant],
        className,
      )}
    />
  )
}

/* ---------- Card ---------- */
export function Card({
  children,
  className,
  title,
  action,
  pad = true,
}: {
  children?: ReactNode
  className?: string
  title?: ReactNode
  action?: ReactNode
  pad?: boolean
}) {
  return (
    <section
      className={cx('rounded-xl border border-line bg-ink-850 backdrop-blur-sm', className)}
    >
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-bold tracking-wide">{title}</h2>
          {action}
        </header>
      )}
      <div className={cx(pad && 'p-5')}>{children}</div>
    </section>
  )
}

/* ---------- Form primitives ---------- */
export function Field({
  label,
  hint,
  required,
  children,
  className,
}: {
  label: string
  hint?: string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cx('flex flex-col gap-1.5', className)}>
      <span className="mono-label">
        {label}
        {required && <span className="text-brand-500"> *</span>}
      </span>
      {children}
      {hint && <span className="text-[11px] text-fg-faint">{hint}</span>}
    </label>
  )
}

const controlCls =
  'w-full rounded-lg border border-line-strong bg-ink-750 px-3 py-2.5 text-sm text-fg placeholder:text-fg-faint outline-none transition focus:border-brand-500/70 focus:ring-2 focus:ring-brand-500/15'

export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => (
  <input {...p} className={cx(controlCls, className)} />
)

export const Textarea = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...p} rows={p.rows ?? 3} className={cx(controlCls, 'resize-y', className)} />
)

export const Select = ({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...p} className={cx(controlCls, 'cursor-pointer appearance-none pr-8', className)} />
)

/* ---------- Badge ---------- */
export type Tone = 'gold' | 'mint' | 'ember' | 'sky' | 'rose' | 'neutral'
const toneCls: Record<Tone, string> = {
  gold: 'bg-brand-500/15 text-brand-400 border-brand-500/30',
  mint: 'bg-mint/12 text-mint border-mint/30',
  ember: 'bg-ember/15 text-ember border-ember/30',
  sky: 'bg-sky/15 text-sky border-sky/30',
  rose: 'bg-rose/15 text-rose border-rose/30',
  neutral: 'bg-black/[0.06] text-fg-mute border-line-strong',
}
export const Badge = ({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone
  children: ReactNode
  className?: string
}) => (
  <span
    className={cx(
      'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10.5px] font-semibold tracking-wider uppercase',
      toneCls[tone],
      className,
    )}
  >
    {children}
  </span>
)

/* ---------- Modal ---------- */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  const isDesktop = useIsDesktop()

  useEffect(() => {
    if (!open || !isDesktop) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose, isDesktop])

  if (!open) return null

  if (!isDesktop)
    return (
      <Sheet open={open} onClose={onClose} title={title} subtitle={subtitle} footer={footer}>
        {children}
      </Sheet>
    )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={cx(
          'animate-fade relative w-full overflow-hidden rounded-2xl border border-line-strong bg-ink-850 shadow-2xl',
          width,
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div>
            <h3 className="text-base font-bold">{title}</h3>
            {subtitle && <p className="mt-0.5 text-[13px] text-fg-mute">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-fg-faint hover:bg-black/[0.05] hover:text-fg">
            <IconX width={18} height={18} />
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <footer className="flex justify-end gap-2 border-t border-line bg-ink-750/60 px-6 py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}

/* ---------- Table shell ---------- */
export const Th = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <th className={cx('mono-label px-4 py-2.5 text-left font-medium', className)}>{children}</th>
)

export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <td className={cx('px-4 py-3 align-middle text-sm', className)}>{children}</td>
)

export const TableWrap = ({ children }: { children: ReactNode }) => (
  <div className="overflow-x-auto">
    <table className="w-full border-collapse">{children}</table>
  </div>
)

/* ---------- Misc ---------- */
export const EmptyState = ({ text, action }: { text: string; action?: ReactNode }) => (
  <div className="flex flex-col items-center gap-3 py-12 text-center">
    <p className="text-sm text-fg-mute">{text}</p>
    {action}
  </div>
)

export const Avatar = ({ text, tone = 'gold' }: { text: string; tone?: 'gold' | 'neutral' }) => (
  <div
    className={cx(
      'flex h-9 w-9 flex-none items-center justify-center rounded-lg text-[13px] font-extrabold',
      tone === 'gold'
        ? 'bg-gradient-to-br from-brand-500 to-brand-600 text-white'
        : 'bg-black/[0.07] text-fg-dim',
    )}
  >
    {text}
  </div>
)

export const Divider = ({ className }: { className?: string }) => (
  <div className={cx('h-px w-full bg-line', className)} />
)

export const Chip = ({
  active,
  children,
  onClick,
}: {
  active?: boolean
  children: ReactNode
  onClick?: () => void
}) => (
  <button
    onClick={onClick}
    className={cx(
      'rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition',
      active
        ? 'border-brand-500/50 bg-brand-500/12 text-brand-400'
        : 'border-line-strong bg-ink-800 text-fg-mute hover:text-fg',
    )}
  >
    {children}
  </button>
)
