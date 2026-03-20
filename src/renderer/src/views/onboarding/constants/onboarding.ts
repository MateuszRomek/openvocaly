import { DEFAULT_SHORTCUT_BINDINGS } from '../../../../../shared/shortcuts'
import {
  LOCAL_PARAKEET_MODEL_ID,
  type LocalTranscriptionModelId,
  type LocalTranscriptionProviderId
} from '../../../../../shared/local-transcription'
import type { TranscriptionProviderId } from '../../../../../shared/transcription'

export type OnboardingLocalModelTarget = {
  providerId: LocalTranscriptionProviderId
  modelId: LocalTranscriptionModelId
}

export const ONBOARDING_LOCAL_PROVIDER_IDS: readonly LocalTranscriptionProviderId[] = [
  'local-parakeet',
  'local-whisper'
]

export const ONBOARDING_RECOMMENDED_LOCAL_TARGET: OnboardingLocalModelTarget = {
  providerId: 'local-parakeet',
  modelId: LOCAL_PARAKEET_MODEL_ID
}

export const ONBOARDING_CLOUD_PROVIDER_ID: TranscriptionProviderId = 'groq'

export const ONBOARDING_RECOMMENDED_SHORTCUT = DEFAULT_SHORTCUT_BINDINGS['recording.toggle']
