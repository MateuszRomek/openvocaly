import { useCallback, useMemo, useState } from 'react'
import { ONBOARDING_CLOUD_PROVIDER_ID } from '../../constants/onboarding'
import { useSetProviderApiKeyMutation } from '@renderer/queries/transcription/use-set-provider-api-key-mutation'
import { useTranscriptionPreferencesQuery } from '@renderer/queries/transcription/use-transcription-preferences-query'
import { useUpdateTranscriptionPreferencesMutation } from '@renderer/queries/transcription/use-update-transcription-preferences-mutation'

export type UseCloudEngineStepResult = {
  cloudApiKey: string
  canSaveCloudApiKey: boolean
  cloudReady: boolean
  cloudError: string | null
  isBusy: boolean
  setCloudApiKey: (apiKey: string) => void
  activateCloudEngine: () => Promise<void>
  saveCloudApiKey: () => Promise<void>
}

export function useCloudEngineStep(): UseCloudEngineStepResult {
  const [cloudApiKey, setCloudApiKey] = useState('')
  const transcriptionPreferencesQuery = useTranscriptionPreferencesQuery()
  const updateTranscriptionPreferencesMutation = useUpdateTranscriptionPreferencesMutation()
  const setProviderApiKeyMutation = useSetProviderApiKeyMutation()

  const cloudProvider = useMemo(() => {
    return (
      transcriptionPreferencesQuery.data?.config.providers.find(
        (provider) => provider.id === ONBOARDING_CLOUD_PROVIDER_ID
      ) ?? null
    )
  }, [transcriptionPreferencesQuery.data?.config.providers])

  const activateCloudEngine = useCallback(async (): Promise<void> => {
    if (!transcriptionPreferencesQuery.data) {
      return
    }

    const cloudModelId =
      cloudProvider?.models[0]?.id ?? transcriptionPreferencesQuery.data.preferences.modelId

    await updateTranscriptionPreferencesMutation.mutateAsync({
      providerId: ONBOARDING_CLOUD_PROVIDER_ID,
      modelId: cloudModelId
    })
  }, [
    cloudProvider?.models,
    transcriptionPreferencesQuery.data,
    updateTranscriptionPreferencesMutation
  ])

  const saveCloudApiKey = useCallback(async (): Promise<void> => {
    const normalizedApiKey = cloudApiKey.trim()
    if (!normalizedApiKey.length) {
      return
    }

    const saveResponse = await setProviderApiKeyMutation.mutateAsync({
      providerId: ONBOARDING_CLOUD_PROVIDER_ID,
      apiKey: normalizedApiKey
    })

    if (!saveResponse.ok) {
      throw new Error(saveResponse.message ?? 'Could not save API key.')
    }

    const modelId =
      cloudProvider?.models[0]?.id ?? transcriptionPreferencesQuery.data?.preferences.modelId ?? ''

    await updateTranscriptionPreferencesMutation.mutateAsync({
      providerId: ONBOARDING_CLOUD_PROVIDER_ID,
      modelId
    })
  }, [
    cloudApiKey,
    cloudProvider?.models,
    setProviderApiKeyMutation,
    transcriptionPreferencesQuery.data?.preferences.modelId,
    updateTranscriptionPreferencesMutation
  ])

  const cloudError = useMemo(() => {
    if (setProviderApiKeyMutation.isError) {
      return setProviderApiKeyMutation.error?.message ?? 'Could not save API key.'
    }

    return null
  }, [setProviderApiKeyMutation.error?.message, setProviderApiKeyMutation.isError])

  return {
    cloudApiKey,
    canSaveCloudApiKey: cloudApiKey.trim().length > 0,
    cloudReady: Boolean(cloudProvider?.isConfigured),
    cloudError,
    isBusy:
      transcriptionPreferencesQuery.isPending ||
      updateTranscriptionPreferencesMutation.isPending ||
      setProviderApiKeyMutation.isPending,
    setCloudApiKey,
    activateCloudEngine,
    saveCloudApiKey
  }
}
