// Serial executor: llama.cpp + llama.rn НЕ поддерживают concurrent
// completion на одном context (KV-cache shared state). Все translate()
// вызовы проходят через один queue.
export class InferenceQueue {
  private queue: Promise<unknown> = Promise.resolve();

  run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.catch(() => {});
    return next;
  }
}
