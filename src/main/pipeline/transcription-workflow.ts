import type { RecordingArtifact } from '../../shared/recording'
import { RecordingArtifactManager } from '../recording/storage/artifact-manager'
import type { RecordingServiceOrchestrator } from '../recording/service/orchestrator'
import type { TranscriptionService } from '../transcription/service'

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
    private readonly dependencies: {
      recordingService: RecordingServiceOrchestrator
      transcriptionService: TranscriptionService
    },
    private readonly artifactManager: RecordingArtifactManager = new RecordingArtifactManager()
  ) {}

  async processArtifact(artifact: RecordingArtifact): Promise<TranscriptionWorkflowResult> {
    const transcriptionResult =
      await this.dependencies.transcriptionService.transcribeArtifact(artifact)
    console.log('[pipeline] transcription result', {
      artifact,
      transcriptionResult
    })

    if (transcriptionResult.ok) {
      await this.artifactManager.markTranscriptionSuccess(artifact)
      return {
        type: 'complete',
        transcriptText: transcriptionResult.transcript.text
      }
    }

    try {
      await this.artifactManager.markFailure(
        artifact,
        'transcription_error',
        transcriptionResult.message
      )
    } catch (error) {
      console.error('[pipeline] failed to persist transcription failure artifact', error)
    }

    await this.dependencies.recordingService.playCue('error').catch((error) => {
      console.error('[pipeline] failed to play transcription failure cue', error)
    })

    return {
      type: 'failed',
      message: transcriptionResult.message
    }
  }
}
