import { createReadStream } from 'node:fs'
import Groq from 'groq-sdk'
import type { TranscriptionProviderDefinition } from './types'

const GROQ_MODELS: Array<{ id: string; label: string }> = [
  { id: 'whisper-large-v3-turbo', label: 'Whisper Large V3 Turbo' },
  { id: 'whisper-large-v3', label: 'Whisper Large V3' }
]

export const groqProvider: TranscriptionProviderDefinition = {
  id: 'groq',
  label: 'Groq',
  availability: 'available',
  models: GROQ_MODELS,
  transcribe: async (artifact, context) => {
    const client = new Groq({ apiKey: context.apiKey })
    const transcription = await client.audio.transcriptions.create({
      file: createReadStream(artifact.filePath),
      model: context.modelId,
      response_format: 'json',
      temperature: 0
    })

    const text = typeof transcription.text === 'string' ? transcription.text.trim() : ''

    if (text.length === 0) {
      return {
        ok: false,
        code: 'empty_transcription',
        message: 'Groq returned an empty transcription response.'
      }
    }

    const transcriptionWithLanguage = transcription as unknown as { language?: unknown }
    const language =
      typeof transcriptionWithLanguage.language === 'string'
        ? transcriptionWithLanguage.language
        : undefined

    return {
      ok: true,
      transcript: {
        text,
        language
      }
    }
  }
}
