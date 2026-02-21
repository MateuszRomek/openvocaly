import type { ReactNode } from 'react'

type SettingsRowShellProps = {
  isLast: boolean
  left: ReactNode
  right?: ReactNode
  footer?: ReactNode
  minHeightClass?: string
  stackOnMobile?: boolean
}

export function SettingsRowShell({
  isLast,
  left,
  right,
  footer,
  minHeightClass = 'min-h-[7.5rem]',
  stackOnMobile = false
}: SettingsRowShellProps): React.JSX.Element {
  const layoutClass = stackOnMobile
    ? 'flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-3'
    : 'items-center gap-3'

  return (
    <article className={`px-5 py-5 ${isLast ? '' : 'border-border/40 border-b'}`}>
      <div className={`flex ${minHeightClass} ${layoutClass}`}>
        <div className="min-w-0 flex-1">{left}</div>
        {right}
      </div>
      {footer && <div className="pt-3">{footer}</div>}
    </article>
  )
}
