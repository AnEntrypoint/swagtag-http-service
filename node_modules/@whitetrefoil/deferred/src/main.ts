export interface Deferred<T> {
  promise: Promise<T>
  resolve: (result: T|PromiseLike<T>) => void
  reject: (reason?: unknown) => void
}

export function defer<T>(): Deferred<T> {
  let resolve!: (result: T|PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise: Promise<T> = new Promise<T>((_resolve, _reject) => {
    resolve = _resolve
    reject = _reject
  })

  return {
    promise,
    resolve,
    reject,
  }
}
