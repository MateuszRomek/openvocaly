import { useState } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { MoonIcon, SunIcon } from 'lucide-react'
import { Button } from '@renderer/ui/button'
import { readPreferredTheme, setThemePreference, type Theme } from '@renderer/lib/theme'

const routeTitles: Record<string, string> = {
  '/': 'Home',
  '/settings': 'Settings',
  '/models': 'Models',
  '/models/cloud': 'Models',
  '/models/local': 'Models'
}

function SiteHeader(): React.JSX.Element {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const [theme, setTheme] = useState<Theme>(() => readPreferredTheme())

  const title = routeTitles[pathname] ?? 'Page'
  const isDark = theme === 'dark'
  const handleThemeToggle = (): void => {
    const nextTheme: Theme = isDark ? 'light' : 'dark'
    setThemePreference(nextTheme)
    setTheme(nextTheme)
  }

  return (
    <header className="border-border/70 h-14 border-b">
      <div className="mx-auto flex h-full w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={handleThemeToggle}
          aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {isDark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
        </Button>
      </div>
    </header>
  )
}

export default SiteHeader
