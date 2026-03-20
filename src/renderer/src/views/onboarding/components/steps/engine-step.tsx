import { useCallback, useMemo, useState } from 'react'
import { CheckCircle2Icon } from 'lucide-react'
import { Badge } from '@renderer/ui/badge'
import { useOnboardingStepNavigation } from '../../hooks/use-onboarding-step-navigation'
import type { OnboardingEngineChoice } from '../../types/onboarding'
import type { OnboardingLocalModelOption } from '../../hooks/steps/engine.types'
import { useCloudEngineStep } from '../../hooks/steps/use-cloud-engine-step'
import { useLocalEngineStep } from '../../hooks/steps/use-local-engine-step'
import { CloudEngineContent } from './engine/cloud-engine-content'
import { LocalEngineContent } from './engine/local-engine-content'

const SWALLOW_PROMISE_ERROR = (): void => undefined
type OnboardingLocalModelTarget = Pick<OnboardingLocalModelOption, 'providerId' | 'modelId'>

export function EngineStep(): React.JSX.Element {
  const [engineChoice, setEngineChoice] = useState<OnboardingEngineChoice>('local')

  const {
    localReady,
    localIsDownloading,
    localSelectedModel,
    localModelOptions,
    localDownloadProgress,
    localError,
    isBusy: isLocalBusy,
    activateLocalEngine,
    selectLocalModel,
    downloadLocalModelTarget,
    cancelLocalDownload
  } = useLocalEngineStep()

  const {
    canSaveCloudApiKey,
    cloudApiKey,
    cloudError,
    cloudReady,
    isBusy: isCloudBusy,
    activateCloudEngine,
    saveCloudApiKey,
    setCloudApiKey
  } = useCloudEngineStep()

  const isLocalSelected = engineChoice === 'local'
  const isCloudSelected = engineChoice === 'cloud'
  const isReady = isLocalSelected ? localReady : cloudReady
  const isBusy = isLocalSelected ? isLocalBusy : isCloudBusy

  const navigationState = useMemo(
    () => ({
      canContinue: isReady,
      isBusy
    }),
    [isBusy, isReady]
  )

  useOnboardingStepNavigation(navigationState)

  const handleSelectLocalEngine = useCallback(() => {
    setEngineChoice('local')
    void activateLocalEngine().catch(SWALLOW_PROMISE_ERROR)
  }, [activateLocalEngine])

  const handleSelectCloudEngine = useCallback(() => {
    setEngineChoice('cloud')
    void activateCloudEngine().catch(SWALLOW_PROMISE_ERROR)
  }, [activateCloudEngine])

  const handleSelectLocalModel = useCallback(
    (target: OnboardingLocalModelTarget) => {
      void selectLocalModel(target).catch(SWALLOW_PROMISE_ERROR)
    },
    [selectLocalModel]
  )

  const handleDownloadAndUseLocalModel = useCallback(
    (target: OnboardingLocalModelTarget) => {
      void downloadLocalModelTarget(target).catch(SWALLOW_PROMISE_ERROR)
    },
    [downloadLocalModelTarget]
  )

  const handleCancelLocalDownload = useCallback(() => {
    void cancelLocalDownload().catch(SWALLOW_PROMISE_ERROR)
  }, [cancelLocalDownload])

  const handleSaveCloudApiKey = useCallback(() => {
    void saveCloudApiKey().catch(SWALLOW_PROMISE_ERROR)
  }, [saveCloudApiKey])

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          className={`cursor-pointer rounded-xl border p-4 text-left transition-colors ${
            isLocalSelected
              ? 'border-primary/70 bg-primary/6'
              : 'border-border/70 bg-background/70 hover:border-border'
          }`}
          onClick={handleSelectLocalEngine}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <p className="font-medium">Local</p>
              <Badge variant="secondary">Recommended</Badge>
            </div>
            {isLocalSelected ? <CheckCircle2Icon className="size-4 text-foreground/85" /> : null}
          </div>
          <p className="text-muted-foreground text-sm">
            Private and on-device. No API key required.
          </p>
        </button>

        <button
          type="button"
          className={`cursor-pointer rounded-xl border p-4 text-left transition-colors ${
            isCloudSelected
              ? 'border-primary bg-primary/5'
              : 'border-border/70 bg-background/70 hover:border-border'
          }`}
          onClick={handleSelectCloudEngine}
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="font-medium">Cloud</p>
            {isCloudSelected ? <CheckCircle2Icon className="size-4 text-foreground/85" /> : null}
          </div>
          <p className="text-muted-foreground text-sm">Faster setup with provider API key.</p>
        </button>
      </div>

      <p className="text-muted-foreground text-sm">
        Recommended for most users: Local stays private on your device and does not require an API
        key.
      </p>

      {isLocalSelected ? (
        <LocalEngineContent
          localModelOptions={localModelOptions}
          localSelectedModel={localSelectedModel}
          localDownloadProgress={localDownloadProgress}
          localError={localError}
          localIsDownloading={localIsDownloading}
          onSelectModel={handleSelectLocalModel}
          onDownloadAndUseModel={handleDownloadAndUseLocalModel}
          onCancelDownload={handleCancelLocalDownload}
        />
      ) : (
        <CloudEngineContent
          cloudApiKey={cloudApiKey}
          canSaveCloudApiKey={canSaveCloudApiKey}
          cloudReady={cloudReady}
          cloudError={cloudError}
          onCloudApiKeyChange={setCloudApiKey}
          onSaveCloudApiKey={handleSaveCloudApiKey}
        />
      )}
    </div>
  )
}
