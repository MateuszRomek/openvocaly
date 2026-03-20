import { useMemo } from 'react'
import { AlertCircleIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@renderer/ui/alert'
import { Button } from '@renderer/ui/button'
import type {
  OnboardingLocalDownloadProgress,
  OnboardingLocalModelOption
} from '../../../hooks/steps/engine.types'
import { LocalModelCard } from './local-model-card'

type OnboardingLocalModelTarget = Pick<OnboardingLocalModelOption, 'providerId' | 'modelId'>

type LocalEngineContentProps = {
  localModelOptions: OnboardingLocalModelOption[]
  localSelectedModel: OnboardingLocalModelOption | null
  localDownloadProgress: OnboardingLocalDownloadProgress
  localError: string | null
  localIsDownloading: boolean
  onSelectModel: (target: OnboardingLocalModelTarget) => void
  onDownloadAndUseModel: (target: OnboardingLocalModelTarget) => void
  onCancelDownload: () => void
}

export function LocalEngineContent({
  localModelOptions,
  localSelectedModel,
  localDownloadProgress,
  localError,
  localIsDownloading,
  onSelectModel,
  onDownloadAndUseModel,
  onCancelDownload
}: LocalEngineContentProps): React.JSX.Element {
  const recommendedOption = useMemo(() => {
    return localModelOptions.find((option) => option.recommended) ?? localModelOptions[0] ?? null
  }, [localModelOptions])

  const otherOptions = useMemo(() => {
    return localModelOptions.filter((option) => {
      if (!recommendedOption) {
        return true
      }

      return !(
        option.providerId === recommendedOption.providerId &&
        option.modelId === recommendedOption.modelId
      )
    })
  }, [localModelOptions, recommendedOption])

  return (
    <div className="space-y-4 rounded-xl border border-border/70 bg-background/70 p-5">
      <div className="space-y-1">
        <p className="text-sm font-medium">Recommended model</p>
        <p className="text-muted-foreground text-sm">
          Choose one model to continue. You can switch or add more later in Settings.
        </p>
        {localSelectedModel && !localSelectedModel.recommended ? (
          <p className="text-muted-foreground text-xs">
            Current selection: {localSelectedModel.modelLabel}
          </p>
        ) : null}
      </div>

      {recommendedOption ? (
        <LocalModelCard
          option={recommendedOption}
          selectedModel={localSelectedModel}
          localDownloadProgress={localDownloadProgress}
          localIsDownloading={localIsDownloading}
          variant="recommended"
          onSelectModel={onSelectModel}
          onDownloadAndUseModel={onDownloadAndUseModel}
        />
      ) : null}

      {otherOptions.length ? (
        <div className="space-y-2.5">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.08em]">
            Other models
          </p>
          <div className="space-y-2">
            {otherOptions.map((option) => (
              <LocalModelCard
                key={`${option.providerId}:${option.modelId}`}
                option={option}
                selectedModel={localSelectedModel}
                localDownloadProgress={localDownloadProgress}
                localIsDownloading={localIsDownloading}
                variant="other"
                onSelectModel={onSelectModel}
                onDownloadAndUseModel={onDownloadAndUseModel}
              />
            ))}
          </div>
        </div>
      ) : null}

      {localError ? (
        <Alert variant="destructive">
          <AlertCircleIcon className="size-4" />
          <AlertTitle>Local setup failed</AlertTitle>
          <AlertDescription>{localError}</AlertDescription>
        </Alert>
      ) : null}

      {localIsDownloading ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onCancelDownload}>
            Cancel download
          </Button>
        </div>
      ) : null}
    </div>
  )
}
