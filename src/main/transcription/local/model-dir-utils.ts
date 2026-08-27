import { app } from 'electron'
import { join } from 'node:path'

const LOCAL_MODELS_DIR_NAME = 'local-models'
const PARAKEET_MODELS_DIR_NAME = 'parakeet'
const WHISPER_MODELS_DIR_NAME = 'whisper'

/**
 * Resolve durable app-owned storage. Models must survive cache eviction and
 * remain controllable through the Models screen.
 */
const resolveLocalModelsDir = (): string => join(app.getPath('userData'), LOCAL_MODELS_DIR_NAME)

/**
 * Returns the durable root for Parakeet CoreML installations.
 */
export const getParakeetModelsRootDir = (): string =>
  join(resolveLocalModelsDir(), PARAKEET_MODELS_DIR_NAME)

/**
 * Returns model-specific storage directory under the local Parakeet cache root.
 */
export const getParakeetModelDir = (modelId: string): string =>
  join(getParakeetModelsRootDir(), modelId)

/**
 * Returns the durable root for Whisper model files.
 */
export const getWhisperModelsRootDir = (): string =>
  join(resolveLocalModelsDir(), WHISPER_MODELS_DIR_NAME)

/**
 * Returns model file path under the Whisper models root directory.
 */
export const getWhisperModelFilePath = (modelId: string): string =>
  join(getWhisperModelsRootDir(), `ggml-${modelId}.bin`)
