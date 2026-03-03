import { AppearanceSection } from './components/appearance-section'
import { RecordingAudioSection } from './components/recording-audio-section'
import { PermissionsSection } from './components/permissions-section'
import { RecordingShortcutsSection } from './components/recording-shortcuts-section'

export function SettingsView(): React.JSX.Element {
  const platform = window.api.system.platform

  return (
    <section className="w-full max-w-4xl space-y-5 py-1 sm:py-2">
      <header className="space-y-1.5">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">General</h2>
        <p className="text-muted-foreground text-sm">
          Configure appearance, recording shortcuts, sound cues, and required permissions.
        </p>
      </header>

      <AppearanceSection />
      <RecordingShortcutsSection platform={platform} />
      <RecordingAudioSection />
      <PermissionsSection />
    </section>
  )
}
