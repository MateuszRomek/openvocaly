import { AlertTriangleIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@renderer/ui/alert'
import { PERMISSION_ITEMS } from '../constants/permissions'
import { usePermissions } from '../hooks/use-permissions'
import { PermissionRow } from './permission-row'
import { SettingsPermissionsSkeleton } from './settings-permissions-skeleton'
import { SectionCard } from '@renderer/components/section-card'

export function PermissionsSection(): React.JSX.Element {
  const { requestError, permissionConfig, isLoading } = usePermissions()

  if (isLoading) {
    return <SettingsPermissionsSkeleton />
  }

  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold">Permissions</h3>

      {requestError && (
        <Alert variant="destructive">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <AlertTitle>Permissions request failed</AlertTitle>
          <AlertDescription>{requestError}</AlertDescription>
        </Alert>
      )}

      <SectionCard>
        {PERMISSION_ITEMS.map((item, index) => {
          const config = permissionConfig[item.key]

          return (
            <PermissionRow
              key={item.key}
              isLast={index === PERMISSION_ITEMS.length - 1}
              title={item.title}
              description={item.description}
              state={config.state}
              message={config.message}
              isRequesting={config.isRequesting}
              isOpeningSettings={config.isOpeningSettings}
              onRequest={config.onRequest}
              onOpenSettings={config.onOpenSettings}
            />
          )
        })}
      </SectionCard>
    </section>
  )
}
