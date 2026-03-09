import { ipcMain } from 'electron'
import { createIpcRegistrar } from '../helpers/ipc'
import type { DictationRuntimeStateResponse } from '../../shared/dictation'
import type { DictationPipelineOrchestrator } from './dictation-pipeline-orchestrator'

export type PipelineIpcModule = {
  registerIpcHandlers: () => void
  initialize: () => Promise<void>
  shutdown: () => Promise<void>
}

export const createPipelineIpcModule = (
  dictationPipelineOrchestrator: DictationPipelineOrchestrator
): PipelineIpcModule => {
  const registerIpcHandlers = createIpcRegistrar(() => {
    ipcMain.handle(
      'dictation:getRuntimeState',
      (): DictationRuntimeStateResponse => dictationPipelineOrchestrator.getRuntimeState()
    )
  })

  return {
    registerIpcHandlers,
    initialize: () => dictationPipelineOrchestrator.initialize(),
    shutdown: () => dictationPipelineOrchestrator.shutdown()
  }
}
