// Singleton, владеющий ОДНИМ загруженным LlamaContext. llama.cpp KV-cache
// тяжёлый (~150MB RAM) — не держим больше одного. load() идемпотентен
// и deduplicates concurrent calls.
import type { LlamaContext } from './llamaTypes';

export type ContextLoader = () => Promise<LlamaContext>;

export class LlamaContextManager {
  private static singleton: LlamaContextManager | null = null;
  private context: LlamaContext | null = null;
  private loading: Promise<LlamaContext> | null = null;

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
    this.loading = loader().then((ctx) => {
      this.context = ctx;
      this.loading = null;
      return ctx;
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
}
