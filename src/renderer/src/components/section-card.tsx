import type { ReactNode } from 'react'

type SectionCardProps = {
  children: ReactNode
}

export function SectionCard({ children }: SectionCardProps): React.JSX.Element {
  return <div className="border-border bg-card overflow-hidden rounded-2xl border">{children}</div>
}
