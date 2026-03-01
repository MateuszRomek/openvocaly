export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'wispr-theme'

const isTheme = (value: string | null): value is Theme => value === 'light' || value === 'dark'

const getSystemTheme = (): Theme =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

export const readPreferredTheme = (): Theme => {
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  return isTheme(storedTheme) ? storedTheme : getSystemTheme()
}

export const applyTheme = (theme: Theme): void => {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export const setThemePreference = (theme: Theme): void => {
  window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  applyTheme(theme)
}

/**
 * Keeps the current window in sync with stored/system theme changes.
 * Returns cleanup to detach listeners.
 */
export const startThemeSync = (): (() => void) => {
  applyTheme(readPreferredTheme())

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

  const handleStorage = (event: StorageEvent): void => {
    if (event.key !== THEME_STORAGE_KEY) {
      return
    }

    if (isTheme(event.newValue)) {
      applyTheme(event.newValue)
      return
    }

    applyTheme(getSystemTheme())
  }

  const handleMediaChange = (): void => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (isTheme(storedTheme)) {
      return
    }

    applyTheme(getSystemTheme())
  }

  window.addEventListener('storage', handleStorage)
  mediaQuery.addEventListener('change', handleMediaChange)

  return () => {
    window.removeEventListener('storage', handleStorage)
    mediaQuery.removeEventListener('change', handleMediaChange)
  }
}
