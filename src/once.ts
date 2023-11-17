export const once = <T>(fn: () => T) => {
  let result: T | undefined
  return () => {
    if (result === undefined) {
      result = fn()
    }
    return result
  }
}
