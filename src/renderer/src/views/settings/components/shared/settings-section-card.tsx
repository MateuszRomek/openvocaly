import type { ReactNode } from 'react'

type SettingsSectionCardProps = {
  children: ReactNode
}

export function SettingsSectionCard({ children }: SettingsSectionCardProps): React.JSX.Element {
  return (
    <div className="border-border/45 bg-card/28 overflow-hidden rounded-2xl border backdrop-blur-sm">
      {children}
    </div>
  )
}
