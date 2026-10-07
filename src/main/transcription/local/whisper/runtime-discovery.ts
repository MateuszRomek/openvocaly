import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { app } from 'electron'

const PORT_RANGE_START = 6030
const PORT_RANGE_END = 6059

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
      server.listen(port, '127.0.0.1')
    })

    if (isFree) {
      return port
    }
  }

  throw new Error('No available Whisper runtime port.')
}

const RUNTIME_BINARY_NAME = 'whisper-server-darwin-arm64'

export const resolveRuntimeBinaryPath = (): string | null => {
  if (process.platform !== 'darwin' || process.arch !== 'arm64') {
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
    const candidate = join(root, RUNTIME_BINARY_NAME)
    if (existsSync(candidate)) {
      return candidate
    }
  }

  return null
}
