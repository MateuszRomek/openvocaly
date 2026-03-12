import type { LucideIcon } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@renderer/ui/empty'

type HomeCardEmptyStateProps = {
  icon: LucideIcon
  title: string
  description: string
  className?: string
}

export function HomeCardEmptyState({
  icon: Icon,
  title,
  description,
  className
}: HomeCardEmptyStateProps): React.JSX.Element {
  return (
    <Empty
      className={cn('border-border/60 bg-background/60 min-h-[14rem] rounded-lg border', className)}
    >
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon className="size-4" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
