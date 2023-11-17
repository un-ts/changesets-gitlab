type OnceResult<T> =
  | {
      called: false
    }
  | {
      data: T
      called: true
    }

export const once = <T>(fn: () => T) => {
  let result: OnceResult<T> = { called: false }
  return () => {
    if (!result.called) {
      result = {
        data: fn(),
        called: true,
      }
    }
    return result.data
  }
}
