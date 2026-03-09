import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { app } from 'electron'

const PORT_RANGE_START = 6006
const PORT_RANGE_END = 6029

type FindRuntimePortOptions = {
  exclude?: Set<number>
}

export const findRuntimePort = async (options?: FindRuntimePortOptions): Promise<number> => {
  const exclude = options?.exclude ?? new Set<number>()

  for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port += 1) {
    if (exclude.has(port)) {
      continue
    }

    const isFree = await new Promise<boolean>((resolve) => {
      const server = createServer()
      server.once('error', () => resolve(false))
      server.once('listening', () => {
        server.close(() => resolve(true))
      })
      // Let OS pick the best local interface family for the probe to avoid false positives.
      server.listen(port)
    })
    if (isFree) {
      return port
    }
  }

  throw new Error('No available local runtime port.')
}

const resolveBinaryNames = (): string[] => {
  const arch = process.arch
  const platform = process.platform
  if (platform === 'darwin') {
    // sherpa-onnx mac archive is universal; allow either file name to avoid arch mismatch issues.
    return ['sherpa-onnx-ws-darwin-arm64', 'sherpa-onnx-ws-darwin-x64']
  }

  if (platform === 'win32' && arch === 'x64') {
    return ['sherpa-onnx-ws-win32-x64.exe']
  }
  if (platform === 'linux' && arch === 'x64') {
    return ['sherpa-onnx-ws-linux-x64']
  }

  return []
}

export const resolveRuntimeBinaryPath = (): string | null => {
  const binaryNames = resolveBinaryNames()
  if (binaryNames.length === 0) {
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

  for (const root of candidateRoots) {
    for (const binaryName of binaryNames) {
      const candidate = join(root, binaryName)
      if (existsSync(candidate)) {
        return candidate
      }
    }
  }

  return null
}
