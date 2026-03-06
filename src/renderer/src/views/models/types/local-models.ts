export type LocalRuntimeStatus = Awaited<
  ReturnType<Window['api']['transcription']['local']['getRuntimeStatus']>
>['status']

export type LocalModelInfo = Awaited<
  ReturnType<Window['api']['transcription']['local']['listModels']>
>['models'][number]

export type LocalModelId = string

export type LocalModelCardItem = {
  id: string
  label: string
  description: string
  language: string
  sizeMb: number
  downloaded: boolean
}

export type LocalModelDownloadProgress = Parameters<
  Parameters<Window['api']['transcription']['local']['onDownloadProgress']>[0]
>[0]
