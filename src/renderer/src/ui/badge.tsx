/* eslint-disable react-refresh/only-export-components */
import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@renderer/lib/utils'

const badgeVariants = cva(
  'h-5 gap-1 rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium transition-all has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:size-3! inline-flex items-center justify-center w-fit whitespace-nowrap shrink-0 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive overflow-hidden group/badge',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground [a]:hover:bg-primary/80',
        secondary: 'bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80',
        success:
          'border-emerald-500/35 bg-emerald-500/12 text-emerald-700 [a]:hover:bg-emerald-500/18 dark:border-emerald-400/35 dark:bg-emerald-500/18 dark:text-emerald-300',
        warning:
          'border-amber-500/35 bg-amber-500/12 text-amber-700 [a]:hover:bg-amber-500/18 dark:border-amber-400/40 dark:bg-amber-500/18 dark:text-amber-300',
        destructive:
          'border-destructive/40 bg-destructive/12 [a]:hover:bg-destructive/20 focus-visible:ring-destructive/20 dark:border-red-300/45 dark:bg-red-500/28 dark:text-red-100 dark:[a]:hover:bg-red-500/35 dark:focus-visible:ring-destructive/45 text-destructive',
        outline: 'border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground',
        ghost: 'hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50',
        link: 'text-primary underline-offset-4 hover:underline'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

function Badge({
  className,
  variant = 'default',
  render,
  ...props
}: useRender.ComponentProps<'span'> & VariantProps<typeof badgeVariants>): React.JSX.Element {
  return useRender({
    defaultTagName: 'span',
    props: mergeProps<'span'>(
      {
        className: cn(badgeVariants({ variant }), className)
      },
      props
    ),
    render,
    state: {
      slot: 'badge',
      variant
    }
  })
}

export { Badge, badgeVariants }
