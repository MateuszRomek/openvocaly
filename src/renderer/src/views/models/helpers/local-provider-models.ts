import type { TranscriptionProviderSettingsProvider } from '../hooks/use-transcription-provider-catalog'
import type { LocalModelCardItem, LocalModelInfo } from '../types/local-models'
import { LOCAL_PARAKEET_PROVIDER_ID } from '../constants/local-provider-capabilities'

const toLocalModelCardItem = (
  model:
    | Pick<LocalModelInfo, 'id' | 'label' | 'description' | 'language' | 'sizeMb' | 'downloaded'>
    | TranscriptionProviderSettingsProvider['models'][number]
): LocalModelCardItem => {
  return {
    id: model.id,
    label: model.label,
    description: model.description ?? 'Local transcription model',
    language: model.language ?? 'multilingual',
    sizeMb: model.sizeMb ?? 0,
    downloaded: model.downloaded ?? false
  }
}

export const getLocalProviderModels = (
  provider: TranscriptionProviderSettingsProvider,
  managedModels?: LocalModelInfo[]
): LocalModelCardItem[] => {
  if (provider.id === LOCAL_PARAKEET_PROVIDER_ID && managedModels) {
    return managedModels.map(toLocalModelCardItem)
  }

  return provider.models.map(toLocalModelCardItem)
}
