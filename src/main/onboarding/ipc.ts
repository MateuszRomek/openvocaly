import { ipcMain } from 'electron'
import type {
  OnboardingMarkCompletedResponse,
  OnboardingStateResponse
} from '../../shared/onboarding'
import { createIpcRegistrar } from '../helpers/ipc'
import type { OnboardingService } from './service'

export type OnboardingIpcModule = {
  registerIpcHandlers: () => void
  initialize: () => Promise<void>
}

export const createOnboardingIpcModule = (
  onboardingService: OnboardingService
): OnboardingIpcModule => {
  const registerIpcHandlers = createIpcRegistrar(() => {
    ipcMain.handle(
      'onboarding:getState',
      (): OnboardingStateResponse => onboardingService.getState()
    )

    ipcMain.handle(
      'onboarding:markCompleted',
      (): Promise<OnboardingMarkCompletedResponse> => onboardingService.markCompleted()
    )
  })

  return {
    registerIpcHandlers,
    initialize: () => onboardingService.initialize()
  }
}
