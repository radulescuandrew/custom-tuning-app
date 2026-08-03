import { cx } from '@/lib/utils'
import logoDark from '@/assets/custom-tuning-logo.png'
import logoWhite from '@/assets/custom-tuning-logo-white.png'

/**
 * Logo-ul oficial Custom Tuning (customtuning.ro): wordmark „CUSTOM” + linia de servicii.
 * `tone` alege varianta: `dark` pentru fundal deschis, `white` pentru fundal închis.
 */
export function Logo({
  size = 'md',
  tone = 'dark',
  className,
}: {
  size?: 'sm' | 'md' | 'lg'
  tone?: 'dark' | 'white'
  className?: string
}) {
  const h = size === 'lg' ? 'h-11' : size === 'md' ? 'h-8' : 'h-6'
  return (
    <img
      src={tone === 'white' ? logoWhite : logoDark}
      alt="Custom Tuning — tuning, wheels, detailing, wrap"
      className={cx(h, 'w-auto select-none', className)}
      draggable={false}
    />
  )
}

/** Varianta compactă pentru spații pătrate (avatar, badge): wordmark alb pe fundal negru. */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="flex flex-none items-center justify-center overflow-hidden rounded-[9px] bg-[#111]"
    >
      <img
        src={logoWhite}
        alt=""
        style={{ width: size * 0.78, maxWidth: 'none' }}
        className="select-none"
        draggable={false}
      />
    </div>
  )
}
