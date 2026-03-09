import { spawn, spawnSync } from 'node:child_process'

export interface ArchiveExtractor {
  extractTarBz2(archivePath: string, destinationDir: string): Promise<void>
}

class TarCommandArchiveExtractor implements ArchiveExtractor {
  constructor(private readonly tarCommand: string) {}

  async extractTarBz2(archivePath: string, destinationDir: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const processRef = spawn(this.tarCommand, ['-xjf', archivePath, '-C', destinationDir], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      })

      let stderr = ''
      processRef.stderr.on('data', (chunk) => {
        stderr += String(chunk)
      })

      processRef.on('error', (error) => {
        reject(new Error(`Failed to start archive extractor: ${error.message}`))
      })

      processRef.on('close', (code) => {
        if (code === 0) {
          resolve()
          return
        }

        reject(new Error(`Archive extraction failed (code ${code}): ${stderr.slice(-300)}`))
      })
    })
  }
}

const isCommandAvailable = (command: string): boolean => {
  const probe = spawnSync(command, ['--version'], {
    stdio: 'ignore',
    windowsHide: true
  })

  return probe.error === undefined && probe.status === 0
}

const resolveTarCommand = (): string => {
  const candidates =
    process.platform === 'win32' ? ['tar.exe', 'tar', 'bsdtar.exe', 'bsdtar'] : ['tar']

  for (const command of candidates) {
    if (isCommandAvailable(command)) {
      return command
    }
  }

  throw new Error(
    'Archive extraction requires a tar-compatible command, but none was found on PATH.'
  )
}

export const createArchiveExtractor = (): ArchiveExtractor => {
  return new TarCommandArchiveExtractor(resolveTarCommand())
}
