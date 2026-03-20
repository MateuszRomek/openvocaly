import { useEffect, useMemo, useState } from 'react'
import type { DictationPhase } from '../../../../../../shared/dictation'
import { useOnboardingDictationRuntimeStateQuery } from '../../queries/dictation/use-onboarding-dictation-runtime-state-query'
import { useShortcutDisplay } from '../shared/use-shortcut-display'

export type DictationTestStatus = 'idle' | 'listening' | 'processing' | 'success'

export type UseTestStepResult = {
  status: DictationTestStatus
  insertedText: string
  shortcutDisplay: string
  shortcutTokens: string[]
  isIdle: boolean
  isListening: boolean
  isProcessing: boolean
  isSuccessful: boolean
  canClear: boolean
  isReady: boolean
  resetDictationTest: () => void
}

export function useTestStep(): UseTestStepResult {
  const [insertedText, setInsertedText] = useState('')
  const shortcutDisplay = useShortcutDisplay()

  const dictationRuntimeStateQuery = useOnboardingDictationRuntimeStateQuery({
    enabled: true,
    refetchInterval: 250,
    refetchIntervalInBackground: true
  })

  useEffect(() => {
    const unsubscribe = window.api.storage.onTranscriptAdded((payload) => {
      void (async () => {
        const response = await window.api.storage.listTranscripts({ page: 1 })
        const transcript = response.items.find((item) => item.transcriptId === payload.transcriptId)
        if (!transcript) {
          return
        }

        setInsertedText(transcript.text)
      })()
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const dictationPhase = dictationRuntimeStateQuery.data?.state.phase ?? 'idle'

  const runtimeStatus = useMemo<Exclude<DictationTestStatus, 'success'>>(() => {
    const listeningPhases: DictationPhase[] = ['starting', 'recording']
    const processingPhases: DictationPhase[] = [
      'stopping',
      'transcribing',
      'awaiting_manual_paste',
      'complete'
    ]

    if (listeningPhases.includes(dictationPhase)) {
      return 'listening'
    }

    if (processingPhases.includes(dictationPhase)) {
      return 'processing'
    }

    return 'idle'
  }, [dictationPhase])

  const status: DictationTestStatus = useMemo(() => {
    if (insertedText.trim().length > 0) {
      return 'success'
    }

    return runtimeStatus
  }, [insertedText, runtimeStatus])

  return {
    status,
    insertedText,
    shortcutDisplay: shortcutDisplay.display,
    shortcutTokens: shortcutDisplay.tokens,
    isIdle: status === 'idle',
    isListening: status === 'listening',
    isProcessing: status === 'processing',
    isSuccessful: status === 'success',
    canClear: insertedText.trim().length > 0,
    isReady: insertedText.trim().length > 0,
    resetDictationTest: () => {
      setInsertedText('')
    }
  }
}
