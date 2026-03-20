import type { LocalModelDownloadProgress } from '../../../../../../shared/local-transcription'
import type { OnboardingLocalModelTarget } from '../../constants/onboarding'

export type OnboardingLocalModelOption = OnboardingLocalModelTarget & {
  providerLabel: string
  modelLabel: string
  modelDescription: string
  sizeMb: number
  downloaded: boolean
  recommended: boolean
}

export type OnboardingLocalDownloadProgress = LocalModelDownloadProgress | null
