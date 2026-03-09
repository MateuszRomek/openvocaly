export const createIpcRegistrar = (registerHandlers: () => void): (() => void) => {
  let registered = false

  return (): void => {
    if (registered) {
      return
    }

    registerHandlers()
    registered = true
  }
}
