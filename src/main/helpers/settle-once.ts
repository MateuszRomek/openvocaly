export type SettleOnceController<T> = {
  settle: (value: T) => boolean
  isSettled: () => boolean
}

export const createSettleOnce = <T>(onSettle: (value: T) => void): SettleOnceController<T> => {
  let settled = false

  return {
    settle: (value: T): boolean => {
      if (settled) {
        return false
      }

      settled = true
      onSettle(value)
      return true
    },
    isSettled: (): boolean => settled
  }
}
