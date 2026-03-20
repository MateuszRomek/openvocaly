import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { LocalTranscriptionProviderId } from '../../../../../../shared/local-transcription'
import {
  ONBOARDING_LOCAL_PROVIDER_IDS,
  ONBOARDING_RECOMMENDED_LOCAL_TARGET,
  type OnboardingLocalModelTarget
} from '../../constants/onboarding'
import { transcriptionKeys } from '@renderer/queries/transcription/transcription.keys'
import { useCancelLocalModelDownloadMutation } from '@renderer/queries/transcription/use-cancel-local-model-download-mutation'
import { useDownloadLocalModelMutation } from '@renderer/queries/transcription/use-download-local-model-mutation'
import { useLocalModelsQuery } from '@renderer/queries/transcription/use-local-models-query'
import { useTranscriptionPreferencesQuery } from '@renderer/queries/transcription/use-transcription-preferences-query'
import { useUpdateTranscriptionPreferencesMutation } from '@renderer/queries/transcription/use-update-transcription-preferences-mutation'
import type { OnboardingLocalDownloadProgress, OnboardingLocalModelOption } from './engine.types'

export type UseLocalEngineStepResult = {
  localReady: boolean
  localIsDownloading: boolean
  localSelectedModel: OnboardingLocalModelOption | null
  localModelOptions: OnboardingLocalModelOption[]
  localDownloadProgress: OnboardingLocalDownloadProgress
  localError: string | null
  isBusy: boolean
  activateLocalEngine: () => Promise<void>
  selectLocalModel: (target: OnboardingLocalModelTarget) => Promise<void>
  downloadLocalModelTarget: (target: OnboardingLocalModelTarget) => Promise<void>
  cancelLocalDownload: () => Promise<void>
}

export function useLocalEngineStep(): UseLocalEngineStepResult {
  const queryClient = useQueryClient()
  const [selectedLocalTarget, setSelectedLocalTarget] = useState<OnboardingLocalModelTarget>(
    ONBOARDING_RECOMMENDED_LOCAL_TARGET
  )
  const [downloadProgress, setDownloadProgress] = useState<OnboardingLocalDownloadProgress>(null)

  const transcriptionPreferencesQuery = useTranscriptionPreferencesQuery()
  const parakeetLocalModelsQuery = useLocalModelsQuery('local-parakeet')
  const whisperLocalModelsQuery = useLocalModelsQuery('local-whisper')
  const updateTranscriptionPreferencesMutation = useUpdateTranscriptionPreferencesMutation()
  const downloadLocalModelMutation = useDownloadLocalModelMutation()
  const cancelLocalDownloadMutation = useCancelLocalModelDownloadMutation()

  const localProviderLabels = useMemo(() => {
    const providers = transcriptionPreferencesQuery.data?.config.providers ?? []
    return {
      'local-parakeet':
        providers.find((provider) => provider.id === 'local-parakeet')?.label ?? 'NVIDIA Parakeet',
      'local-whisper':
        providers.find((provider) => provider.id === 'local-whisper')?.label ?? 'Whisper.cpp'
    } as const
  }, [transcriptionPreferencesQuery.data?.config.providers])

  const localModelOptions = useMemo<OnboardingLocalModelOption[]>(() => {
    const providerEntries = ONBOARDING_LOCAL_PROVIDER_IDS.map((providerId) => ({
      providerId,
      providerLabel: localProviderLabels[providerId],
      models:
        providerId === 'local-parakeet'
          ? (parakeetLocalModelsQuery.data?.models ?? [])
          : (whisperLocalModelsQuery.data?.models ?? [])
    }))

    return providerEntries.flatMap(({ providerId, providerLabel, models }) =>
      models.map((model) => ({
        providerId,
        modelId: model.id,
        providerLabel,
        modelLabel: model.label,
        modelDescription: model.description ?? '',
        sizeMb: model.sizeMb ?? 0,
        downloaded: Boolean(model.downloaded),
        recommended:
          providerId === ONBOARDING_RECOMMENDED_LOCAL_TARGET.providerId &&
          model.id === ONBOARDING_RECOMMENDED_LOCAL_TARGET.modelId
      }))
    )
  }, [
    localProviderLabels,
    parakeetLocalModelsQuery.data?.models,
    whisperLocalModelsQuery.data?.models
  ])

  const selectedLocalModel = useMemo(() => {
    return (
      localModelOptions.find(
        (option) =>
          option.providerId === selectedLocalTarget.providerId &&
          option.modelId === selectedLocalTarget.modelId
      ) ?? null
    )
  }, [localModelOptions, selectedLocalTarget.modelId, selectedLocalTarget.providerId])

  const effectiveLocalModel = useMemo(() => {
    if (selectedLocalModel) {
      return selectedLocalModel
    }

    return localModelOptions.find((option) => option.recommended) ?? localModelOptions[0] ?? null
  }, [localModelOptions, selectedLocalModel])

  const effectiveLocalTarget = useMemo<OnboardingLocalModelTarget>(() => {
    if (effectiveLocalModel) {
      return {
        providerId: effectiveLocalModel.providerId,
        modelId: effectiveLocalModel.modelId
      }
    }

    return selectedLocalTarget
  }, [effectiveLocalModel, selectedLocalTarget])

  const activateLocalEngine = useCallback(async (): Promise<void> => {
    await updateTranscriptionPreferencesMutation.mutateAsync({
      providerId: effectiveLocalTarget.providerId,
      modelId: effectiveLocalTarget.modelId
    })
  }, [
    effectiveLocalTarget.modelId,
    effectiveLocalTarget.providerId,
    updateTranscriptionPreferencesMutation
  ])

  const selectLocalModel = useCallback(
    async (target: OnboardingLocalModelTarget): Promise<void> => {
      setSelectedLocalTarget(target)
      setDownloadProgress(null)

      await updateTranscriptionPreferencesMutation.mutateAsync({
        providerId: target.providerId,
        modelId: target.modelId
      })
    },
    [updateTranscriptionPreferencesMutation]
  )

  const downloadLocalModelTarget = useCallback(
    async (target: OnboardingLocalModelTarget): Promise<void> => {
      setSelectedLocalTarget(target)
      setDownloadProgress(null)

      await updateTranscriptionPreferencesMutation.mutateAsync({
        providerId: target.providerId,
        modelId: target.modelId
      })

      const response = await downloadLocalModelMutation.mutateAsync({
        providerId: target.providerId,
        modelId: target.modelId
      })

      if (!response.ok) {
        throw new Error(response.message ?? 'Could not start local model download.')
      }
    },
    [downloadLocalModelMutation, updateTranscriptionPreferencesMutation]
  )

  const cancelLocalDownload = useCallback(async (): Promise<void> => {
    await cancelLocalDownloadMutation.mutateAsync({
      providerId: effectiveLocalTarget.providerId
    })
  }, [cancelLocalDownloadMutation, effectiveLocalTarget.providerId])

  useEffect(() => {
    const unsubscribe = window.api.transcription.local.onDownloadProgress((payload) => {
      if (!ONBOARDING_LOCAL_PROVIDER_IDS.includes(payload.providerId)) {
        return
      }

      setDownloadProgress(payload)

      if (payload.state === 'complete') {
        void queryClient.invalidateQueries({
          queryKey: transcriptionKeys.localModels(
            payload.providerId as LocalTranscriptionProviderId
          )
        })
      }
    })

    return () => {
      unsubscribe()
    }
  }, [queryClient])

  const localReady = Boolean(effectiveLocalModel?.downloaded)

  const localError = useMemo(() => {
    if (parakeetLocalModelsQuery.isError || whisperLocalModelsQuery.isError) {
      return 'Could not load local model state.'
    }

    if (downloadLocalModelMutation.isError) {
      return downloadLocalModelMutation.error?.message ?? 'Local model download failed.'
    }

    return null
  }, [
    downloadLocalModelMutation.error?.message,
    downloadLocalModelMutation.isError,
    parakeetLocalModelsQuery.isError,
    whisperLocalModelsQuery.isError
  ])

  const isBusy =
    transcriptionPreferencesQuery.isPending ||
    parakeetLocalModelsQuery.isPending ||
    whisperLocalModelsQuery.isPending ||
    updateTranscriptionPreferencesMutation.isPending ||
    downloadLocalModelMutation.isPending ||
    cancelLocalDownloadMutation.isPending ||
    downloadProgress?.state === 'downloading' ||
    downloadProgress?.state === 'installing'

  return {
    localReady,
    localIsDownloading:
      downloadLocalModelMutation.isPending ||
      cancelLocalDownloadMutation.isPending ||
      downloadProgress?.state === 'downloading' ||
      downloadProgress?.state === 'installing',
    localSelectedModel: effectiveLocalModel,
    localModelOptions,
    localDownloadProgress: downloadProgress,
    localError,
    isBusy,
    activateLocalEngine,
    selectLocalModel,
    downloadLocalModelTarget,
    cancelLocalDownload
  }
}
