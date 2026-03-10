import type { ResolveAppIconInput, ResolveAppIconResult } from '../../shared/storage'
import {
  createDefaultAppIconResolverAdapter,
  type AppIconResolverAdapter
} from './app-icon-resolver-adapter'
import {
  createRequestCacheKey,
  createResolveError,
  createResolvedPathCacheKey,
  MAX_ICON_CACHE_ENTRIES,
  normalizeSizePx,
  normalizeString,
  resolveRequestedIconSize
} from './app-icon-resolver-helpers'

export class AppIconResolver {
  private readonly cache = new Map<string, ResolveAppIconResult>()
  private readonly pendingRequestCache = new Map<string, Promise<ResolveAppIconResult>>()
  private readonly pendingResolvedPathCache = new Map<string, Promise<ResolveAppIconResult>>()

  constructor(
    private readonly adapter: AppIconResolverAdapter = createDefaultAppIconResolverAdapter()
  ) {}

  async resolve(input: ResolveAppIconInput): Promise<ResolveAppIconResult> {
    const appPath = normalizeString(input.appPath)
    const appIdentifier = normalizeString(input.appIdentifier)
    const sizePx = normalizeSizePx(input.sizePx)
    const directPathCacheKey = appPath
      ? createResolvedPathCacheKey({
          platform: process.platform,
          resolvedPath: appPath,
          sizePx
        })
      : null

    if (directPathCacheKey) {
      const cached = this.getCached(directPathCacheKey)
      if (cached) {
        return cached
      }

      const pendingResolvedPath = this.pendingResolvedPathCache.get(directPathCacheKey)
      if (pendingResolvedPath) {
        return pendingResolvedPath
      }
    }

    const requestCacheKey = createRequestCacheKey({
      platform: process.platform,
      appPath,
      appIdentifier,
      sizePx
    })
    const pendingRequest = this.pendingRequestCache.get(requestCacheKey)
    if (pendingRequest) {
      return pendingRequest
    }

    const pendingResolution = this.resolveUncached({
      appPath,
      appIdentifier,
      sizePx
    }).finally(() => {
      this.pendingRequestCache.delete(requestCacheKey)
    })

    this.pendingRequestCache.set(requestCacheKey, pendingResolution)
    return pendingResolution
  }

  private async resolveUncached(params: {
    appPath: string | null
    appIdentifier: string | null
    sizePx: number
  }): Promise<ResolveAppIconResult> {
    const resolvedPath = await this.resolveIconPath({
      appPath: params.appPath,
      appIdentifier: params.appIdentifier
    })
    if (!resolvedPath) {
      return createResolveError('App icon path could not be resolved.')
    }

    const resolvedPathCacheKey = createResolvedPathCacheKey({
      platform: process.platform,
      resolvedPath,
      sizePx: params.sizePx
    })
    const cached = this.getCached(resolvedPathCacheKey)
    if (cached) {
      return cached
    }

    const pendingResolvedPath = this.pendingResolvedPathCache.get(resolvedPathCacheKey)
    if (pendingResolvedPath) {
      return pendingResolvedPath
    }

    const pendingIconLoad = this.loadIconForResolvedPath({
      resolvedPath,
      sizePx: params.sizePx,
      resolvedPathCacheKey
    }).finally(() => {
      this.pendingResolvedPathCache.delete(resolvedPathCacheKey)
    })

    this.pendingResolvedPathCache.set(resolvedPathCacheKey, pendingIconLoad)
    return pendingIconLoad
  }

  private async loadIconForResolvedPath(params: {
    resolvedPath: string
    sizePx: number
    resolvedPathCacheKey: string
  }): Promise<ResolveAppIconResult> {
    if (!this.adapter.pathExists(params.resolvedPath)) {
      return createResolveError(`Resolved app path does not exist: ${params.resolvedPath}`)
    }

    try {
      const requestedSize = resolveRequestedIconSize(params.sizePx)
      let icon = await this.adapter.getFileIcon(params.resolvedPath, { size: requestedSize })
      if (icon.isEmpty()) {
        icon = this.adapter.createImageFromPath(params.resolvedPath)
      }

      if (icon.isEmpty()) {
        return createResolveError('Resolved app icon is empty.')
      }

      const resized = icon.resize({
        width: params.sizePx,
        height: params.sizePx,
        quality: 'best'
      })
      const dataUrl = `data:image/png;base64,${resized.toPNG().toString('base64')}`
      const result: ResolveAppIconResult = {
        ok: true,
        dataUrl
      }

      return this.setCached(params.resolvedPathCacheKey, result)
    } catch (error) {
      return createResolveError(
        error instanceof Error ? error.message : 'Failed to resolve app icon.'
      )
    }
  }

  private async resolveIconPath(params: {
    appPath: string | null
    appIdentifier: string | null
  }): Promise<string | null> {
    return await this.adapter.resolveIconPath(params)
  }

  private getCached(cacheKey: string): ResolveAppIconResult | null {
    const cached = this.cache.get(cacheKey)
    if (!cached) {
      return null
    }

    // Refresh insertion order so recently used entries stay in-memory longer.
    this.cache.delete(cacheKey)
    this.cache.set(cacheKey, cached)
    return cached
  }

  private setCached(cacheKey: string, value: ResolveAppIconResult): ResolveAppIconResult {
    if (this.cache.has(cacheKey)) {
      this.cache.delete(cacheKey)
    }
    this.cache.set(cacheKey, value)

    if (this.cache.size > MAX_ICON_CACHE_ENTRIES) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey)
      }
    }

    return value
  }
}
