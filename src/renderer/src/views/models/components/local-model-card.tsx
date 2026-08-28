import type { JSX } from 'react'
import { AlertCircleIcon } from 'lucide-react'
import { Progress } from '@renderer/ui/progress'
import { useLocalProviderSectionContext } from '../contexts/local-provider-section-context'
import { getLocalModelDownloadProgressLabel } from '../helpers/local-model-progress'
import { LocalModelCardActions } from './local-model-card-actions'
import type { LocalModelCardItem } from '../types/local-models'

type LocalModelCardProps = {
  model: LocalModelCardItem
  isLast: boolean
}

const formatModelSize = (sizeMb: number): string => {
  const formatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })

  if (sizeMb >= 1024) {
    return `${formatter.format(sizeMb / 1024)}\u00a0GB`
  }

  return `${formatter.format(sizeMb)}\u00a0MB`
}

export function LocalModelCard({ model, isLast }: LocalModelCardProps): JSX.Element {
  const section = useLocalProviderSectionContext()
  const isSelected = section.isSelectedModel(model.id)
  const isDownloading = section.isModelDownloading(model.id)
  const hasDownloadError = section.hasModelDownloadError(model.id)
  const downloadProgress = section.downloadProgress
  const progressLabel =
    isDownloading || hasDownloadError ? getLocalModelDownloadProgressLabel(downloadProgress) : ''
  const progressPercentage = Math.max(0, Math.min(100, downloadProgress?.percentage ?? 0))
  const metadata = [
    model.sizeMb > 0 ? formatModelSize(model.sizeMb) : null,
    model.language,
    model.downloaded ? 'Installed' : null
  ].filter((value): value is string => Boolean(value))

  return (
    <article
      className={[
        'border-border/70 flex flex-col gap-3 border-l-2 px-5 py-4 md:flex-row md:items-center md:justify-between',
        isSelected
          ? 'border-l-primary bg-primary/5 dark:bg-primary/10'
          : 'border-l-transparent hover:bg-muted/20',
        isLast ? '' : 'border-b'
      ].join(' ')}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h5 className="truncate text-sm font-semibold" translate="no">
            {model.label}
          </h5>
        </div>

        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">{model.description}</p>

        <p className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-2 text-xs">
          {metadata.map((item, index) => (
            <span key={item} className={item === 'Installed' ? 'text-foreground' : undefined}>
              {index > 0 ? <span aria-hidden="true">·</span> : null} {item}
            </span>
          ))}
        </p>

        {isDownloading && progressLabel ? (
          <div role="status" aria-live="polite" className="mt-3 max-w-xl space-y-1.5">
            <div className="text-muted-foreground flex items-center justify-between gap-3 text-xs">
              <span>{progressLabel}</span>
              <span className="tabular-nums">{progressPercentage}%</span>
            </div>
            <Progress
              value={progressPercentage}
              aria-label={`Downloading ${model.label}`}
              className="h-1.5"
            />
          </div>
        ) : null}

        {hasDownloadError && progressLabel ? (
          <p role="alert" className="text-destructive mt-2 flex items-center gap-1.5 text-xs">
            <AlertCircleIcon className="size-3.5 shrink-0" aria-hidden="true" />
            {progressLabel}
          </p>
        ) : null}
      </div>

      <LocalModelCardActions
        modelId={model.id}
        isDownloaded={model.downloaded}
        isSelected={isSelected}
        isDownloading={isDownloading}
      />
    </article>
  )
}
