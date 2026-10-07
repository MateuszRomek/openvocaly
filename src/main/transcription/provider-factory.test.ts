import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TranscriptionPreferences } from '../../shared/transcription'
import type { TranscriptionArtifact } from './providers/types'

const env = vi.hoisted(() => ({ dev: false }))
vi.mock('@electron-toolkit/utils', () => ({
  is: {
    get dev() {
      return env.dev
    }
  }
}))
vi.mock('electron', () => ({ app: { getPath: () => '/tmp', isPackaged: false } }))

const { TranscriptionProviderFactory } = await import('./provider-factory')

const preferences = {
  providerId: 'unknown-provider',
  modelId: 'any'
} as unknown as TranscriptionPreferences
const artifact = {} as TranscriptionArtifact

describe('OPENVOCALY_RECORDING_FORCE_TRANSCRIPTION_FAILURE', () => {
  beforeEach(() => {
    vi.stubEnv('OPENVOCALY_RECORDING_FORCE_TRANSCRIPTION_FAILURE', '1')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('forces a failure in development', async () => {
    env.dev = true
    const result = await new TranscriptionProviderFactory().transcribe(artifact, preferences)
    expect(result).toMatchObject({ ok: false, code: 'forced_failure' })
  })

  it('is ignored in production builds', async () => {
    env.dev = false
    const result = await new TranscriptionProviderFactory().transcribe(artifact, preferences)
    expect(result).toMatchObject({ ok: false, code: 'provider_not_supported' })
  })
})
