/* eslint-disable @typescript-eslint/explicit-function-return-type */

import * as React from 'react'

import { cn } from '@renderer/lib/utils'
import { Label } from '@renderer/ui/label'

function Field({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="field" className={cn('grid gap-2', className)} {...props} />
}

function FieldLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cn('text-muted-foreground text-xs font-medium tracking-wide uppercase', className)}
      {...props}
    />
  )
}

function FieldDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="field-description"
      className={cn('text-muted-foreground text-xs leading-relaxed', className)}
      {...props}
    />
  )
}

function FieldError({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="field-error"
      className={cn('text-destructive text-xs leading-relaxed', className)}
      {...props}
    />
  )
}

export { Field, FieldDescription, FieldError, FieldLabel }
