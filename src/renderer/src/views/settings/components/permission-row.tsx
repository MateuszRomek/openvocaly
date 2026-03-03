import { Badge } from '@renderer/ui/badge'
import { Alert, AlertDescription } from '@renderer/ui/alert'
import { Button } from '@renderer/ui/button'
import { AlertCircleIcon } from 'lucide-react'
import {
  PERMISSION_STATUS_BADGE,
  canOpenPermissionSettings,
  canRequestPermission
} from '../constants/permissions'
import { SectionRow } from '@renderer/components/section-row'
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
    <Alert variant="destructive" className="max-w-full">
      <AlertCircleIcon className="size-4" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
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
    <SectionRow
      isLast={isLast}
      left={left}
      right={right}
      footer={footer}
      minHeightClass="min-h-[6.5rem]"
      stackOnMobile
    />
  )
}
