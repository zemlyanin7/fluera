// Production loader — вызывает llama.rn initLlama с локальной моделью.
// Параметры (n_ctx, n_gpu_layers) калиброваны под Hy-MT1.5-1.8B-1.25bit:
// - n_ctx 2048 — увеличено с 1024 для поддержки sentence-level перевода (#4.5).
//   Sentence prompt (system + user) занимает ~300-500 tokens,
//   max_tokens 200 для ответа — итого ~700 tokens в hot path. 2048 даёт
//   запас x3 для длинных предложений без KV-cache eviction.
// - n_gpu_layers 99 — на iOS Metal максимальный offload (Android ignored).
// - n_threads 4 — sweet spot для big.LITTLE CPU мобильных SoC.
//
// НЕ unit-тестируем — native call. Покрытие через device smoke test.
import { initLlama } from 'llama.rn';
import { getModelLocalPath } from './modelManifest';
import { LlamaContextAdapter } from './LlamaContextAdapter';
import type { LlamaContext } from './llamaTypes';

export async function createLlamaLoader(): Promise<LlamaContext> {
  const native = await initLlama({
    model: getModelLocalPath(),
    n_ctx: 2048,
    n_gpu_layers: 99,
    n_threads: 4,
  });
  return new LlamaContextAdapter(native);
}
