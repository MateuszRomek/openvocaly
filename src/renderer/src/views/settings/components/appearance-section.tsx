import { useState } from 'react'
import { MoonIcon, SunIcon } from 'lucide-react'
import { Button } from '@renderer/ui/button'
import { readPreferredTheme, setThemePreference, type Theme } from '@renderer/lib/theme'
import { SectionRow } from '@renderer/components/section-row'
import { SectionCard } from '@renderer/components/section-card'

export function AppearanceSection(): React.JSX.Element {
  const [theme, setTheme] = useState<Theme>(() => readPreferredTheme())

  const isDark = theme === 'dark'
  const nextTheme: Theme = isDark ? 'light' : 'dark'

  const handleThemeToggle = (): void => {
    setThemePreference(nextTheme)
    setTheme(nextTheme)
  }

  const left = (
    <div className="space-y-1.5">
      <h4 className="text-base font-medium">Appearance</h4>
      <p className="text-muted-foreground text-sm">
        Choose a theme. Changes apply right away.
      </p>
    </div>
  )

  const right = (
    <div className="flex w-full justify-start sm:w-auto sm:justify-end">
      <Button
        type="button"
        variant="outline"
        onClick={handleThemeToggle}
        className="w-full sm:w-auto"
        aria-label={isDark ? 'Use light theme' : 'Use dark theme'}
      >
        {isDark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
        {isDark ? 'Use light theme' : 'Use dark theme'}
      </Button>
    </div>
  )

  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold">Appearance</h3>
      <SectionCard>
        <SectionRow isLast left={left} right={right} minHeightClass="min-h-[6.25rem]" />
      </SectionCard>
    </section>
  )
}
