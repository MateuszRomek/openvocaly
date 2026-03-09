import type { RecordingArtifact } from '../../shared/recording'
import { recordingService } from '../recording/service/orchestrator'
import { RecordingArtifactStore } from '../recording/storage/artifact-store'
import { transcriptionService } from '../transcription/service'

export type TranscriptionWorkflowResult =
  | { type: 'complete'; transcriptText: string }
  | {
      type: 'failed'
      message?: string
    }

/**
 * Runs post-capture transcription workflow for a finalized artifact.
 *
 * Responsibilities:
 * - perform transcription,
 * - persist success/failure artifact outcomes,
 * - trigger error cue on transcription failure.
 */
export class DictationTranscriptionWorkflow {
  constructor(
    private readonly artifactStore: RecordingArtifactStore = new RecordingArtifactStore()
  ) {}

  async processArtifact(artifact: RecordingArtifact): Promise<TranscriptionWorkflowResult> {
    const transcriptionResult = await transcriptionService.transcribeArtifact(artifact)
    console.log('[pipeline] transcription result', {
      artifact,
      transcriptionResult
    })

    if (transcriptionResult.ok) {
      await this.artifactStore.markTranscriptionSuccess(artifact)
      return {
        type: 'complete',
        transcriptText: transcriptionResult.transcript.text
      }
    }

    try {
      await this.artifactStore.markFailure(
        artifact,
        'transcription_error',
        transcriptionResult.message
      )
    } catch (error) {
      console.error('[pipeline] failed to persist transcription failure artifact', error)
    }

    await recordingService.playCue('error').catch((error) => {
      console.error('[pipeline] failed to play transcription failure cue', error)
    })

    return {
      type: 'failed',
      message: transcriptionResult.message
    }
  }
}

export const dictationTranscriptionWorkflow = new DictationTranscriptionWorkflow()
