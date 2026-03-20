import { useCallback } from 'react'
import { AlertCircleIcon, CheckCircle2Icon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@renderer/ui/alert'
import { Badge } from '@renderer/ui/badge'
import { Button } from '@renderer/ui/button'
import { Input } from '@renderer/ui/input'

type CloudEngineContentProps = {
  cloudApiKey: string
  canSaveCloudApiKey: boolean
  cloudReady: boolean
  cloudError: string | null
  onCloudApiKeyChange: (value: string) => void
  onSaveCloudApiKey: () => void
}

export function CloudEngineContent({
  cloudApiKey,
  canSaveCloudApiKey,
  cloudReady,
  cloudError,
  onCloudApiKeyChange,
  onSaveCloudApiKey
}: CloudEngineContentProps): React.JSX.Element {
  const handleCloudApiKeyInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onCloudApiKeyChange(event.target.value)
    },
    [onCloudApiKeyChange]
  )

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-background/70 p-5">
      <p className="font-medium">Set up cloud transcription</p>
      <p className="text-muted-foreground text-sm">
        Get your API key from your provider (for example, Groq) and paste it below.
      </p>
      <Input
        value={cloudApiKey}
        type="password"
        placeholder="Enter API key"
        onChange={handleCloudApiKeyInputChange}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={onSaveCloudApiKey} disabled={!canSaveCloudApiKey}>
          Save API key
        </Button>
        {cloudReady ? (
          <Badge variant="success" className="gap-1.5">
            <CheckCircle2Icon className="size-3.5" />
            API key saved
          </Badge>
        ) : null}
      </div>
      {cloudError ? (
        <Alert variant="destructive">
          <AlertCircleIcon className="size-4" />
          <AlertTitle>Cloud setup failed</AlertTitle>
          <AlertDescription>{cloudError}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
