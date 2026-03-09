type Nullable<T> = T | null | undefined

export const isSameNullableObjectByKeys = <
  TObject extends Record<string, unknown>,
  TKey extends keyof TObject
>(
  left: Nullable<TObject>,
  right: Nullable<TObject>,
  keys: readonly TKey[]
): boolean => {
  if (left === right) {
    return true
  }

  if (!left || !right) {
    return !left && !right
  }

  for (const key of keys) {
    if (left[key] !== right[key]) {
      return false
    }
  }

  return true
}
