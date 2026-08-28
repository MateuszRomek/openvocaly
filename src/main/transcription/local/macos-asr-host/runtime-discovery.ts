import { existsSync } from 'node:fs'
import { release } from 'node:os'
import { join } from 'node:path'
import { app } from 'electron'

const BINARY_NAME = 'macos-asr-host'

const supportsMacOS14 = (): boolean => {
  const darwinMajorVersion = Number.parseInt(release().split('.')[0] ?? '', 10)
  return Number.isFinite(darwinMajorVersion) && darwinMajorVersion >= 23
}

export const isMacOSParakeetSupported = (): boolean =>
  process.platform === 'darwin' && process.arch === 'arm64' && supportsMacOS14()

/** Resolve the packaged or development location of the native CoreML host. */
export const resolveMacOSAsrHostPath = (): string | null => {
  if (!isMacOSParakeetSupported()) {
    return null
  }

  const candidateRoots = [
    process.resourcesPath ? join(process.resourcesPath, 'bin') : null,
    process.resourcesPath ? join(process.resourcesPath, 'resources', 'bin') : null,
    process.resourcesPath
      ? join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'bin')
      : null,
    join(app.getAppPath(), 'resources', 'bin'),
    join(process.cwd(), 'resources', 'bin')
  ].filter((entry): entry is string => Boolean(entry))

  return (
    candidateRoots
      .map((root) => join(root, BINARY_NAME))
      .find((candidate) => existsSync(candidate)) ?? null
  )
}
