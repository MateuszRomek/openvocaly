import type { JSX } from 'react'
import { CheckCircle2Icon, DatabaseIcon, DownloadIcon, LanguagesIcon } from 'lucide-react'
import { Badge } from '@renderer/ui/badge'
import { useLocalProviderSectionContext } from '../contexts/local-provider-section-context'
import { getLocalModelDownloadProgressLabel } from '../helpers/local-model-progress'
import { LocalModelCardActions } from './local-model-card-actions'
import type { LocalModelCardItem } from '../types/local-models'

type LocalModelCardProps = {
  model: LocalModelCardItem
  isLast: boolean
}

export function LocalModelCard({ model, isLast }: LocalModelCardProps): JSX.Element {
  const section = useLocalProviderSectionContext()
  const isSelected = section.isSelectedModel(model.id)
  const isDownloading = section.isModelDownloading(model.id)
  const downloadProgress = section.downloadProgress
  const progressLabel = isDownloading ? getLocalModelDownloadProgressLabel(downloadProgress) : ''

  return (
    <article className={`space-y-4 px-5 py-5 ${isLast ? '' : 'border-border border-b'}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-base font-semibold">{model.label}</h4>
            {isSelected ? (
              <Badge variant="success" className="h-5 px-2 text-[11px] font-semibold">
                <CheckCircle2Icon className="size-3.5" />
                Active
              </Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground text-sm">{model.description}</p>
          {isDownloading && progressLabel ? (
            <p className="text-muted-foreground text-xs">{progressLabel}</p>
          ) : null}
        </div>

        <LocalModelCardActions
          modelId={model.id}
          isDownloaded={model.downloaded}
          isSelected={isSelected}
          isDownloading={isDownloading}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {model.downloaded ? (
          <Badge
            variant="secondary"
            className="h-auto rounded-md px-2 py-1 text-xs font-normal"
            title="Model files are downloaded and ready on this device."
          >
            <DownloadIcon className="size-3.5" />
            Downloaded
          </Badge>
        ) : null}
        <Badge
          variant="outline"
          className="h-auto rounded-md px-2 py-1 text-xs font-normal"
          title="Estimated model size on disk."
        >
          <DatabaseIcon className="size-3.5" />
          {model.sizeMb} MB
        </Badge>
        <Badge
          variant="outline"
          className="h-auto rounded-md px-2 py-1 text-xs font-normal"
          title="Primary language coverage for this model."
        >
          <LanguagesIcon className="size-3.5" />
          {model.language}
        </Badge>
      </div>
    </article>
  )
}
