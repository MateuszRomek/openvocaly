import { Badge } from '@renderer/ui/badge'
import { Button } from '@renderer/ui/button'
import { AlertCircleIcon } from 'lucide-react'
import {
  PERMISSION_STATUS_BADGE,
  canOpenPermissionSettings,
  canRequestPermission
} from '../constants/permissions'
import { SettingsRowShell } from './shared/settings-row-shell'
import type { PermissionState } from '../queries/permissions/permissions.types'

type PermissionRowProps = {
  isLast: boolean
  title: string
  description: string
  state: PermissionState
  message?: string
  isRequesting: boolean
  isOpeningSettings: boolean
  onRequest: () => void
  onOpenSettings: () => void
}

export function PermissionRow({
  isLast,
  title,
  description,
  state,
  message,
  isRequesting,
  isOpeningSettings,
  onRequest,
  onOpenSettings
}: PermissionRowProps): React.JSX.Element {
  const left = (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h4 className="text-base font-medium">{title}</h4>
        <Badge variant={PERMISSION_STATUS_BADGE[state].variant} className="h-5 px-2 text-[11px]">
          {PERMISSION_STATUS_BADGE[state].label}
        </Badge>
      </div>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  )

  const footer = message ? (
    <p className="border-destructive/35 bg-destructive/12 text-destructive inline-flex max-w-full items-start gap-1.5 rounded-md border px-2.5 py-1.5 text-xs leading-relaxed dark:border-red-300/40 dark:bg-red-500/18 dark:text-red-100">
      <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0" />
      <span>{message}</span>
    </p>
  ) : undefined

  const right = (
    <div className="flex w-full shrink-0 flex-wrap justify-start gap-2 sm:w-auto sm:justify-end">
      {canRequestPermission(state) && (
        <Button
          type="button"
          variant="secondary"
          onClick={onRequest}
          disabled={isRequesting}
          className="w-full sm:w-auto"
        >
          Request access
        </Button>
      )}
      {canOpenPermissionSettings(state) && (
        <Button
          type="button"
          variant="outline"
          onClick={onOpenSettings}
          disabled={isOpeningSettings}
          className="w-full sm:w-auto"
        >
          Open System Settings
        </Button>
      )}
    </div>
  )

  return (
    <SettingsRowShell
      isLast={isLast}
      left={left}
      right={right}
      footer={footer}
      minHeightClass="min-h-[6.5rem]"
      stackOnMobile
    />
  )
}
