import { useNavigate } from '@tanstack/react-router'
import { ShieldAlertIcon } from 'lucide-react'
import { usePermissionsStatusQuery } from '@renderer/queries/permissions/use-permissions-status-query'
import { requiresPermissionsSetup } from '@renderer/queries/permissions/permissions.types'
import { Alert, AlertDescription, AlertTitle } from '@renderer/ui/alert'
import { Badge } from '@renderer/ui/badge'
import { Button } from '@renderer/ui/button'

export function HomePermissionsNotice(): React.JSX.Element | null {
  const navigate = useNavigate()
  const permissionsStatusQuery = usePermissionsStatusQuery()
  const permissionsStatus = permissionsStatusQuery.data

  if (!permissionsStatus || !requiresPermissionsSetup(permissionsStatus)) {
    return null
  }

  return (
    <Alert className="border-amber-500/35 bg-amber-500/8">
      <ShieldAlertIcon className="text-amber-700 dark:text-amber-300" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <AlertTitle className="flex items-center gap-2">
            Finish setting up OpenVocaly
            <Badge variant="warning">Action needed</Badge>
          </AlertTitle>
          <AlertDescription>
            Allow microphone and accessibility permissions to use dictation, global shortcuts, and
            auto-paste.
          </AlertDescription>
        </div>
        <Button type="button" variant="outline" onClick={() => void navigate({ to: '/settings' })}>
          Open Settings
        </Button>
      </div>
    </Alert>
  )
}
