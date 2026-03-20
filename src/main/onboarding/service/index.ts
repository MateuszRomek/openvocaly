import type {
  OnboardingMarkCompletedResponse,
  OnboardingState,
  OnboardingStateResponse
} from '../../../shared/onboarding'
import { InitializableComponent } from '../../helpers/initializable-component'
import { JsonSettingsManager } from '../../repositories/json-settings-manager'
import { SettingsRepository } from '../../repositories/settings-repository'

const ONBOARDING_STATE_SETTING_KEY = 'onboarding.state'

const createDefaultState = (): OnboardingState => ({
  version: 1,
  completed: false,
  completedAt: null
})

const mergeState = (base: OnboardingState, patch: Partial<OnboardingState>): OnboardingState => ({
  version: 1,
  completed: typeof patch.completed === 'boolean' ? patch.completed : base.completed,
  completedAt:
    typeof patch.completedAt === 'number' || patch.completedAt === null
      ? patch.completedAt
      : base.completedAt
})

const resolveLoadedState = (parsed: Partial<OnboardingState>): OnboardingState => {
  const defaults = createDefaultState()

  return {
    version: 1,
    completed: typeof parsed.completed === 'boolean' ? parsed.completed : defaults.completed,
    completedAt:
      typeof parsed.completedAt === 'number' || parsed.completedAt === null
        ? parsed.completedAt
        : defaults.completedAt
  }
}

export class OnboardingService extends InitializableComponent {
  private readonly settingsManager: JsonSettingsManager<OnboardingState, Partial<OnboardingState>>

  constructor(settingsRepository: SettingsRepository = new SettingsRepository()) {
    super('OnboardingService')
    this.settingsManager = new JsonSettingsManager({
      settingsRepository,
      settingKey: ONBOARDING_STATE_SETTING_KEY,
      createDefaultState,
      mergeState,
      resolveLoadedState,
      cloneState: (state) => ({
        version: state.version,
        completed: state.completed,
        completedAt: state.completedAt
      }),
      onParseError: (error) => {
        console.error('[onboarding] failed to parse state from DB, using defaults', error)
      }
    })
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    await this.settingsManager.initialize()
    this.initialized = true
  }

  getState(): OnboardingStateResponse {
    this.assertInitialized()

    return {
      state: this.settingsManager.get()
    }
  }

  async markCompleted(): Promise<OnboardingMarkCompletedResponse> {
    this.assertInitialized()

    const nextState = await this.settingsManager.update({
      completed: true,
      completedAt: Date.now()
    })

    return {
      ok: true,
      state: nextState
    }
  }
}
