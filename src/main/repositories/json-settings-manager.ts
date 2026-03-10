import { SettingsRepository } from './settings-repository'
import { AsyncSerialScheduler } from '../helpers/async-serial-scheduler'
import { InitializableComponent } from '../helpers/initializable-component'

type JsonSettingsManagerConfig<TState, TUpdate> = {
  settingsRepository: SettingsRepository
  settingKey: string
  createDefaultState: () => TState
  mergeState: (base: TState, patch: TUpdate) => TState
  resolveLoadedState: (parsed: Partial<TState>) => TState
  cloneState: (state: TState) => TState
  onParseError?: (error: unknown) => void
}

/**
 * Generic stateful manager for JSON settings persisted in app_settings.
 * It owns initialization, parse fallback, merge updates, and persistence.
 */
export class JsonSettingsManager<TState, TUpdate> extends InitializableComponent {
  private state: TState
  private readonly mutationScheduler = new AsyncSerialScheduler()

  constructor(private readonly config: JsonSettingsManagerConfig<TState, TUpdate>) {
    super(`JsonSettingsManager for "${config.settingKey}"`)
    this.state = config.createDefaultState()
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    await this.loadFromRepository()
    this.initialized = true
  }

  get(): TState {
    this.assertInitialized()
    return this.config.cloneState(this.state)
  }

  async update(patch: TUpdate): Promise<TState> {
    this.assertInitialized()
    return await this.mutationScheduler.run(async () => {
      this.state = this.config.mergeState(this.state, patch)
      await this.persist()
      return this.get()
    })
  }

  private async loadFromRepository(): Promise<void> {
    const valueJson = await this.config.settingsRepository.getValueJson(this.config.settingKey)

    if (!valueJson) {
      this.state = this.config.createDefaultState()
      await this.persist()
      return
    }

    try {
      const parsed = JSON.parse(valueJson) as Partial<TState>
      this.state = this.config.resolveLoadedState(parsed)
    } catch (error) {
      this.config.onParseError?.(error)
      this.state = this.config.createDefaultState()
      await this.persist()
    }
  }

  private async persist(): Promise<void> {
    await this.config.settingsRepository.upsertValueJson(
      this.config.settingKey,
      JSON.stringify(this.state)
    )
  }
}
