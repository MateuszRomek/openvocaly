import { useCallback, useSyncExternalStore } from 'react'

const getMatch = (query: string): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }

  return window.matchMedia(query).matches
}

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void): (() => void) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return () => {}
      }

      const mediaQueryList = window.matchMedia(query)
      const handleChange = (): void => {
        onStoreChange()
      }

      mediaQueryList.addEventListener('change', handleChange)

      return () => {
        mediaQueryList.removeEventListener('change', handleChange)
      }
    },
    [query]
  )

  const getSnapshot = useCallback((): boolean => getMatch(query), [query])

  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
