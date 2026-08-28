import { existsSync } from 'node:fs'
import { release } from 'node:os'
import { join } from 'node:path'
import { app } from 'electron'

const BINARY_NAME = 'qwen-mlx-host'

const supportsMacOS13 = (): boolean => {
  const darwinMajorVersion = Number.parseInt(release().split('.')[0] ?? '', 10)
  return Number.isFinite(darwinMajorVersion) && darwinMajorVersion >= 22
}

export const isQwenMlxSupported = (): boolean =>
  process.platform === 'darwin' && process.arch === 'arm64' && supportsMacOS13()

/** Resolves the unpacked, self-contained MLX host in development or a macOS app bundle. */
export const resolveQwenMlxHostPath = (): string | null => {
  if (!isQwenMlxSupported()) {
    return null
  }

  const candidateRoots = [
    process.resourcesPath ? join(process.resourcesPath, 'qwen-mlx-host') : null,
    process.resourcesPath
      ? join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'qwen-mlx-host')
      : null,
    join(app.getAppPath(), 'resources', 'qwen-mlx-host'),
    join(process.cwd(), 'resources', 'qwen-mlx-host')
  ].filter((entry): entry is string => Boolean(entry))

  return (
    candidateRoots
      .map((root) => join(root, BINARY_NAME))
      .find((candidate) => existsSync(candidate)) ?? null
  )
}
