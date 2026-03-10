import type { ResolveAppIconResult } from '../../shared/storage'

export const DEFAULT_ICON_SIZE_PX = 32
export const MIN_ICON_SIZE_PX = 16
export const MAX_ICON_SIZE_PX = 256
export const MAX_ICON_CACHE_ENTRIES = 300

export type ResolvedIconSize = 'small' | 'normal'

export const normalizeString = (value?: string): string | null => {
  const normalized = value?.trim()
  if (!normalized) {
    return null
  }

  return normalized
}

export const normalizeSizePx = (value?: number): number => {
  if (!value || !Number.isFinite(value)) {
    return DEFAULT_ICON_SIZE_PX
  }

  const rounded = Math.round(value)
  if (rounded < MIN_ICON_SIZE_PX) {
    return MIN_ICON_SIZE_PX
  }

  if (rounded > MAX_ICON_SIZE_PX) {
    return MAX_ICON_SIZE_PX
  }

  return rounded
}

export const resolveRequestedIconSize = (sizePx: number): ResolvedIconSize =>
  sizePx <= 32 ? 'small' : 'normal'

export const createResolveError = (message: string): ResolveAppIconResult => ({
  ok: false,
  message
})

export const createRequestCacheKey = (params: {
  platform: string
  appPath: string | null
  appIdentifier: string | null
  sizePx: number
}): string =>
  `${params.platform}|${params.appPath ?? ''}|${params.appIdentifier ?? ''}|${params.sizePx}`

export const createResolvedPathCacheKey = (params: {
  platform: string
  resolvedPath: string
  sizePx: number
}): string => `${params.platform}|${params.resolvedPath}|${params.sizePx}`
