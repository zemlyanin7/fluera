// Отслеживает контекст инференса: cold (сразу после warm-up) vs warm.
// Cold-инференс выполняется пока Metal/OpenCL pipeline ещё не прогрет —
// результаты могут быть менее стабильны, поэтому cold-записи НЕ персистируются
// в БД, только в in-memory LRU.
export type InferenceContext = 'cold' | 'warm' | 'thermal_throttled';

export interface InferenceContextOptions {
  coldWindowMs: number;
  now?: () => number;
}

export class InferenceContextTracker {
  private warmupAt: number | null = null;
  private coldWindowMs: number;
  private now: () => number;

  constructor(opts: InferenceContextOptions) {
    this.coldWindowMs = opts.coldWindowMs;
    this.now = opts.now ?? (() => Date.now());
  }

  markWarmupComplete(): void {
    this.warmupAt = this.now();
  }

  reset(): void {
    this.warmupAt = null;
  }

  current(): InferenceContext {
    if (this.warmupAt === null) return 'warm';
    return this.now() - this.warmupAt < this.coldWindowMs ? 'cold' : 'warm';
  }
}
