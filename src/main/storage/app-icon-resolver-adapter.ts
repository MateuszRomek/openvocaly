import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { promisify } from 'node:util'
import { app, nativeImage } from 'electron'
import { isMacOS } from '../helpers/platform'
import type { ResolvedIconSize } from './app-icon-resolver-helpers'

const execFileAsync = promisify(execFile)

export type ResolvableNativeImage = {
  isEmpty(): boolean
  resize(options: { width: number; height: number; quality: 'best' }): ResolvableNativeImage
  toPNG(): Buffer
}

export type ResolveIconPathInput = {
  appPath: string | null
  appIdentifier: string | null
}

export interface AppIconResolverAdapter {
  getFileIcon(filePath: string, options: { size: ResolvedIconSize }): Promise<ResolvableNativeImage>
  createImageFromPath(filePath: string): ResolvableNativeImage
  pathExists(filePath: string): boolean
  resolveIconPath(input: ResolveIconPathInput): Promise<string | null>
}

export const createDefaultAppIconResolverAdapter = (): AppIconResolverAdapter => ({
  getFileIcon: (filePath, options) => app.getFileIcon(filePath, options),
  createImageFromPath: (filePath) => nativeImage.createFromPath(filePath),
  pathExists: (filePath) => existsSync(filePath),
  resolveIconPath: async ({ appPath, appIdentifier }) => {
    if (appPath) {
      return appPath
    }

    if (!appIdentifier) {
      return null
    }

    if (isMacOS()) {
      return await resolveMacAppPathByBundleId(appIdentifier)
    }

    return null
  }
})

const resolveMacAppPathByBundleId = async (bundleId: string): Promise<string | null> => {
  const escapedBundleId = bundleId.replaceAll('"', '\\"')
  const query = `kMDItemCFBundleIdentifier == "${escapedBundleId}"`

  try {
    const { stdout } = await execFileAsync('mdfind', [query])
    const candidates = stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    if (candidates.length === 0) {
      return null
    }

    const appBundleCandidate = candidates.find((candidate) => candidate.endsWith('.app'))
    return appBundleCandidate ?? candidates[0] ?? null
  } catch {
    return null
  }
}
