import type { JSX } from 'react'
import { TranscriptionProviderSection } from './components/transcription-provider-section'

export function CloudModelsView(): JSX.Element {
  return (
    <section className="space-y-4">
      <TranscriptionProviderSection />
    </section>
  )
}
