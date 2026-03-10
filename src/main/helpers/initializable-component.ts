export abstract class InitializableComponent {
  constructor(private readonly componentName: string) {}

  protected initialized = false

  protected assertInitialized(): void {
    if (this.initialized) {
      return
    }

    throw new Error(`${this.componentName} must be initialized before use.`)
  }
}
