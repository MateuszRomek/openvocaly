import { useCallback, useMemo } from 'react'
import { CheckCircle2Icon, Loader2Icon } from 'lucide-react'
import { Badge } from '@renderer/ui/badge'
import { Button } from '@renderer/ui/button'
import { Progress } from '@renderer/ui/progress'
import type {
  OnboardingLocalDownloadProgress,
  OnboardingLocalModelOption
} from '../../../hooks/steps/engine.types'

type OnboardingLocalModelTarget = Pick<OnboardingLocalModelOption, 'providerId' | 'modelId'>

type LocalModelCardProps = {
  option: OnboardingLocalModelOption
  selectedModel: OnboardingLocalModelOption | null
  localDownloadProgress: OnboardingLocalDownloadProgress
  localIsDownloading: boolean
  variant: 'recommended' | 'other'
  onSelectModel: (target: OnboardingLocalModelTarget) => void
  onDownloadAndUseModel: (target: OnboardingLocalModelTarget) => void
}

export function LocalModelCard({
  option,
  selectedModel,
  localDownloadProgress,
  localIsDownloading,
  variant,
  onSelectModel,
  onDownloadAndUseModel
}: LocalModelCardProps): React.JSX.Element {
  const isSelected =
    selectedModel?.providerId === option.providerId && selectedModel?.modelId === option.modelId

  const progressForModel = useMemo(() => {
    if (
      localDownloadProgress?.providerId === option.providerId &&
      localDownloadProgress.modelId === option.modelId
    ) {
      return localDownloadProgress
    }

    return null
  }, [localDownloadProgress, option.modelId, option.providerId])

  const isDownloadingThisModel =
    progressForModel?.state === 'downloading' || progressForModel?.state === 'installing'
  const isAnotherModelDownloading = localIsDownloading && !isDownloadingThisModel

  const handleDownloadAndUse = useCallback(() => {
    onDownloadAndUseModel({
      providerId: option.providerId,
      modelId: option.modelId
    })
  }, [onDownloadAndUseModel, option.modelId, option.providerId])

  const handleUseModel = useCallback(() => {
    onSelectModel({
      providerId: option.providerId,
      modelId: option.modelId
    })
  }, [onSelectModel, option.modelId, option.providerId])

  return (
    <div
      className={`rounded-xl border p-4 ${
        variant === 'recommended'
          ? 'border-primary/60 bg-primary/8'
          : 'border-border/70 bg-background/70'
      }`}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">{option.modelLabel}</p>
              {option.recommended ? <Badge variant="secondary">Recommended</Badge> : null}
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {option.modelDescription || `${option.providerLabel} local model`}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {isSelected ? (
              <Badge
                variant="success"
                className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              >
                <CheckCircle2Icon className="size-3.5" />
                Selected
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground text-[11px]">
            {option.providerLabel} · {Math.round(option.sizeMb)} MB
          </p>

          <div>
            {!option.downloaded ? (
              <Button
                size="sm"
                variant="secondary"
                className="h-8 px-3.5 text-xs font-medium"
                onClick={handleDownloadAndUse}
                disabled={isAnotherModelDownloading}
              >
                {isDownloadingThisModel ? (
                  <>
                    <Loader2Icon className="mr-1 size-3.5 animate-spin" />
                    {progressForModel?.state === 'installing' ? 'Installing' : 'Downloading'}
                  </>
                ) : (
                  'Download & use'
                )}
              </Button>
            ) : !isSelected ? (
              <Button
                size="sm"
                variant="secondary"
                className="h-8 px-3.5 text-xs"
                onClick={handleUseModel}
                disabled={localIsDownloading}
              >
                Use this model
              </Button>
            ) : null}
          </div>
        </div>

        {progressForModel && !option.downloaded ? (
          <div className="space-y-1.5">
            <Progress
              value={progressForModel.percentage}
              className={`
                gap-0
                [&_[data-slot=progress-track]]:h-1.5
                [&_[data-slot=progress-track]]:bg-foreground/12
                [&_[data-slot=progress-indicator]]:bg-foreground/80
                [&_[data-slot=progress-indicator]]:duration-300
                [&_[data-slot=progress-indicator]]:ease-out
              `}
            />
            <p className="text-muted-foreground text-[11px]">
              {progressForModel.state} · {Math.round(progressForModel.percentage)}%
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
