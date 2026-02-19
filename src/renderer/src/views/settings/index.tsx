import { AlertTriangleIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@renderer/ui/alert'
import { ShortcutRow } from './components/shortcut-row'
import { SettingsShortcutsSkeleton } from './components/settings-shortcuts-skeleton'
import { useShortcutSettings } from './hooks/use-shortcut-settings'

export function SettingsView(): React.JSX.Element {
  const platform = window.api.system.platform
  const { config, isLoading, requestError, rowController } = useShortcutSettings({ platform })

  return (
    <section className="w-full max-w-4xl space-y-5 py-1 sm:py-2">
      <header className="space-y-1.5">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">General</h2>
        <p className="text-muted-foreground text-sm">
          Configure global recording shortcuts with inline editing.
        </p>
      </header>

      {config?.hasStartupFailure && (
        <Alert className="border-destructive/35 bg-destructive/8">
          <AlertTriangleIcon className="text-destructive mt-0.5 size-4 shrink-0" />
          <AlertTitle>Startup registration warning</AlertTitle>
          <AlertDescription>
            At least one shortcut failed to register on startup. Review the rows below and adjust
            any conflicted bindings.
          </AlertDescription>
        </Alert>
      )}

      {requestError && (
        <Alert variant="destructive" className="border-destructive/35 bg-destructive/8">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <AlertTitle>Request failed</AlertTitle>
          <AlertDescription>{requestError}</AlertDescription>
        </Alert>
      )}

      {isLoading && <SettingsShortcutsSkeleton />}

      {!isLoading && config && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Recording</h3>
          <div className="border-border/45 bg-card/28 overflow-hidden rounded-2xl border backdrop-blur-sm">
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
          </div>
        </div>
      )}

      {!isLoading && !config && !requestError && (
        <p className="text-muted-foreground text-sm">No shortcut settings available.</p>
      )}
    </section>
  )
}
