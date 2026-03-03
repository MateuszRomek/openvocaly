import { ipcMain } from 'electron'
import type { DictationRuntimeStateResponse } from '../../shared/dictation'
import { dictationPipelineOrchestrator } from './dictation-pipeline-orchestrator'

let pipelineIpcRegistered = false

export const registerPipelineIpc = (): void => {
  if (pipelineIpcRegistered) {
    return
  }

  ipcMain.handle(
    'dictation:getRuntimeState',
    (): DictationRuntimeStateResponse => dictationPipelineOrchestrator.getRuntimeState()
  )

  pipelineIpcRegistered = true
}

export const initializePipeline = (): Promise<void> => dictationPipelineOrchestrator.initialize()

export const shutdownPipeline = (): Promise<void> => dictationPipelineOrchestrator.shutdown()
