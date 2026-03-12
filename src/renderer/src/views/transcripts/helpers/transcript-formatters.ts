import { format } from 'date-fns'
import { TRANSCRIPT_PREVIEW_LENGTH } from '../constants/transcripts'
import { TRANSCRIPTS_COPY } from '../constants/copy'

const transcriptCountFormatter = new Intl.NumberFormat('en-US')

export function formatTranscriptTimestamp(createdAt: number): string {
  const createdDate = new Date(createdAt)
  return `${format(createdDate, 'MMM d')} · ${format(createdDate, 'HH:mm')}`
}

export function formatTranscriptDuration(durationMs: number | null): string {
  if (durationMs === null || durationMs <= 0) {
    return TRANSCRIPTS_COPY.labels.noDuration
  }

  const totalSeconds = Math.max(0, Math.round(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
}

export function resolveTranscriptAppLabel(
  targetAppName: string | null,
  targetAppIdentifier: string | null
): string {
  const name = targetAppName?.trim()
  if (name) {
    return name
  }

  const identifier = targetAppIdentifier?.trim()
  if (identifier) {
    return identifier
  }

  return TRANSCRIPTS_COPY.labels.unknownApp
}

export function formatTranscriptLanguage(language: string | null): string {
  const normalized = language?.trim()
  if (!normalized) {
    return TRANSCRIPTS_COPY.labels.noLanguage
  }

  return normalized.toUpperCase()
}

export function formatTranscriptConfidence(confidence: number | null): string {
  if (confidence === null) {
    return TRANSCRIPTS_COPY.labels.noConfidence
  }

  return `${Math.round(confidence * 100)}%`
}

export function formatTranscriptPreview(
  text: string,
  maxLength: number = TRANSCRIPT_PREVIEW_LENGTH
): string {
  const normalized = text.replace(/\s+/g, ' ').trim()

  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}

export function formatTranscriptCount(totalItems: number): string {
  const count = transcriptCountFormatter.format(totalItems)
  return totalItems === 1 ? `${count} transcript` : `${count} transcripts`
}
