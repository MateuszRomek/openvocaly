import { AlertTriangleIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@renderer/ui/alert'
import { ShortcutRow } from './shortcut-row'
import { SectionCard } from '@renderer/components/section-card'
import { SettingsShortcutsSkeleton } from './settings-shortcuts-skeleton'
import { useShortcuts } from '../hooks/use-shortcuts'
import type { ShortcutPlatform } from '../queries/shortcuts/shortcuts.types'

type RecordingShortcutsSectionProps = {
  platform: ShortcutPlatform
}

export function RecordingShortcutsSection({
  platform
}: RecordingShortcutsSectionProps): React.JSX.Element {
  const { config, isLoading, requestError, ...rowController } = useShortcuts({
    platform
  })

  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold">Recording</h3>

      {config?.hasStartupFailure && (
        <Alert>
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <AlertTitle>Startup registration warning</AlertTitle>
          <AlertDescription>
            At least one shortcut failed to register on startup. Review the rows below and adjust
            any conflicted bindings.
          </AlertDescription>
        </Alert>
      )}

      {requestError && (
        <Alert variant="destructive">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <AlertTitle>Shortcuts request failed</AlertTitle>
          <AlertDescription>{requestError}</AlertDescription>
        </Alert>
      )}

      {isLoading && <SettingsShortcutsSkeleton />}

      {!isLoading && config && (
        <SectionCard>
          {config.actions.map((item, index) => (
            <ShortcutRow
              key={item.action}
              item={item}
              index={index}
              total={config.actions.length}
              platform={platform}
              rowController={rowController}
            />
          ))}
        </SectionCard>
      )}

      {!isLoading && !config && !requestError && (
        <p className="text-muted-foreground text-sm">No shortcut settings available.</p>
      )}
    </section>
  )
}
