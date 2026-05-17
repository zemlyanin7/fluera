// Singleton, владеющий ОДНИМ загруженным LlamaContext. llama.cpp KV-cache
// тяжёлый (~150MB RAM) — не держим больше одного. load() идемпотентен
// и deduplicates concurrent calls.
//
// Manager также wraps context.completion() через единый serial queue:
// llama.rn native bridge ОДИН context = ОДНА inference в полёте. Concurrent
// calls дают "Exception in HostFunction: Context is busy". Wrap гарантирует
// что warmup + user translate + любой будущий caller автоматически
// сериализуются.
import type { LlamaContext, InferenceConfig, InferenceResult } from './llamaTypes';

export type ContextLoader = () => Promise<LlamaContext>;

export class LlamaContextManager {
  private static singleton: LlamaContextManager | null = null;
  private context: LlamaContext | null = null;
  private loading: Promise<LlamaContext> | null = null;
  private serial: Promise<unknown> = Promise.resolve();

  private constructor() {}

  static instance(): LlamaContextManager {
    if (!this.singleton) this.singleton = new LlamaContextManager();
    return this.singleton;
  }

  /** Test-only — сбрасывает singleton state между describe блоками. */
  static resetForTests(): void {
    this.singleton = null;
  }

  async load(loader: ContextLoader): Promise<LlamaContext> {
    if (this.context) return this.context;
    if (this.loading) return this.loading;
    this.loading = loader().then((raw) => {
      this.context = this.wrap(raw);
      this.loading = null;
      return this.context;
    });
    return this.loading;
  }

  getContext(): LlamaContext | null {
    return this.context;
  }

  async unload(): Promise<void> {
    const ctx = this.context;
    this.context = null;
    this.loading = null;
    if (ctx) await ctx.release();
  }

  /** Wrap raw LlamaContext so completion() goes через serial queue. */
  private wrap(raw: LlamaContext): LlamaContext {
    return {
      completion: (prompt: string, config: InferenceConfig): Promise<InferenceResult> => {
        const next = this.serial.then(
          () => raw.completion(prompt, config),
          () => raw.completion(prompt, config),
        );
        this.serial = next.catch(() => {});
        return next;
      },
      release: () => raw.release(),
    };
  }
}
