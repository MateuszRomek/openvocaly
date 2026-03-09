export const createUnrefDelay = (delayMs: number): Promise<void> =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, delayMs)
    timer.unref()
  })
