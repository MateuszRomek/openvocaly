import { app } from 'electron'
import { join } from 'node:path'
import type { LocalTranscriptionModelId } from '../../../shared/local-transcription'

const PARAKEET_MODELS_DIR_NAME = 'parakeet-models'
type ElectronPathName = Parameters<typeof app.getPath>[0] | 'cache'
const getElectronPath = (name: ElectronPathName): string =>
  app.getPath(name as Parameters<typeof app.getPath>[0])

/**
 * Resolve an OS-native cache directory for model storage.
 */
const resolveCacheDir = (): string => getElectronPath('cache')

/**
 * Returns `${app.getPath('cache')}/parakeet-models`.
 */
export const getParakeetModelsRootDir = (): string =>
  join(resolveCacheDir(), PARAKEET_MODELS_DIR_NAME)

/**
 * Returns model-specific storage directory under the local Parakeet cache root.
 */
export const getParakeetModelDir = (modelId: LocalTranscriptionModelId): string =>
  join(getParakeetModelsRootDir(), modelId)
