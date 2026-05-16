// Production loader — вызывает llama.rn initLlama с локальной моделью.
// Параметры (n_ctx, n_gpu_layers) калиброваны под Hy-MT1.5-1.8B-1.25bit:
// - n_ctx 1024 — prompt всегда <500 chars + 32 max_tokens, запас x2.
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
    n_ctx: 1024,
    n_gpu_layers: 99,
    n_threads: 4,
  });
  return new LlamaContextAdapter(native);
}
