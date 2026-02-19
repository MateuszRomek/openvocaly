import { useEffect, useMemo, useState } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { MoonIcon, SunIcon } from 'lucide-react'
import { Button } from '@renderer/ui/button'

type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'wispr-theme'

const routeTitles: Record<string, string> = {
  '/': 'Home',
  '/settings': 'Settings'
}

function SiteHeader(): React.JSX.Element {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const [theme, setTheme] = useState<Theme>(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)

    if (storedTheme === 'light' || storedTheme === 'dark') {
      return storedTheme
    }

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    return prefersDark ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  const title = useMemo(() => routeTitles[pathname] ?? 'Page', [pathname])
  const isDark = theme === 'dark'

  return (
    <header className="border-border/70 flex h-14 items-center justify-between border-b px-4">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      <Button
        type="button"
        variant="secondary"
        size="icon-sm"
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
        aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      >
        {isDark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
      </Button>
    </header>
  )
}

export default SiteHeader
