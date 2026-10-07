import { lstat, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  getParakeetModelsRootDir,
  getQwenModelsRootDir,
  getWhisperModelsRootDir
} from './model-dir-utils'

const STALE_ARTIFACT_AGE_MS = 60 * 60 * 1000

type SweepTarget = {
  directory: string
  matches: (entryName: string) => boolean
}

const isHiddenDownloadDirectory = (entryName: string): boolean =>
  entryName.startsWith('.') && entryName.endsWith('.download')

const getSweepTargets = (): SweepTarget[] => [
  { directory: getWhisperModelsRootDir(), matches: (name) => name.endsWith('.download') },
  { directory: getQwenModelsRootDir(), matches: isHiddenDownloadDirectory },
  { directory: getParakeetModelsRootDir(), matches: isHiddenDownloadDirectory },
  {
    directory: tmpdir(),
    matches: (name) => /^openvocaly-(whisper|qwen|parakeet)-/.test(name)
  }
]

export const sweepStaleLocalModelArtifacts = async (now = Date.now()): Promise<void> => {
  for (const target of getSweepTargets()) {
    const entryNames = await readdir(target.directory).catch(() => [] as string[])

    for (const entryName of entryNames.filter(target.matches)) {
      const entryPath = join(target.directory, entryName)
      const stats = await lstat(entryPath).catch(() => null)
      if (stats && now - stats.mtimeMs >= STALE_ARTIFACT_AGE_MS) {
        await rm(entryPath, { recursive: true, force: true }).catch(() => undefined)
      }
    }
  }
}
