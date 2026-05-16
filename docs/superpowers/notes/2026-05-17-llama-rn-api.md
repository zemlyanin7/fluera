# llama.rn 0.12.0 API notes

Извлечено из `node_modules/llama.rn/lib/typescript/index.d.ts` + `types.d.ts`
на момент установки (2026-05-17).

## Init

```typescript
import { initLlama, LlamaContext } from 'llama.rn';

const ctx: LlamaContext = await initLlama({
  model: string,                  // путь к GGUF файлу
  is_model_asset?: boolean,       // false для file path; true для bundle asset
  n_ctx?: number,                 // context window (default ~2048)
  n_batch?: number,
  n_ubatch?: number,
  n_parallel?: number,            // default 8
  n_threads?: number,             // CPU threads
  n_gpu_layers?: number,          // iOS Metal offload (Android ignored)
  devices?: string[],             // backend devices choice
  flash_attn_type?: 'auto' | 'on' | 'off',
  cache_type_k?: 'f16' | 'f32' | 'q8_0' | 'q4_0' | 'q4_1' | 'iq4_nl' | 'q5_0' | 'q5_1',
  cache_type_v?: 'f16' | 'f32' | 'q8_0' | 'q4_0' | 'q4_1' | 'iq4_nl' | 'q5_0' | 'q5_1',
  pooling_type?: 'none' | 'mean' | 'cls' | 'last' | 'rank',
  use_progress_callback?: boolean,
  cpu_mask?: string,
  cpu_strict?: boolean,
  no_gpu_devices?: boolean,        // iOS only, deprecated — use devices
  // ... more
}, onProgress?: (progress: number) => void): Promise<LlamaContext>;
```

## Completion

```typescript
const result: NativeCompletionResult = await ctx.completion({
  prompt: string,                  // полный prompt
  n_predict?: number,              // max tokens (наш max_tokens → n_predict)
  temperature?: number,
  top_p?: number,
  top_k?: number,
  repeat_penalty?: number,
  stop?: string[],                 // массив stop strings
  // ... много других
}, callback?: (data: TokenData) => void);

// result.text — оригинальный текст inference
// result.content — filtered text (без reasoning / tool calls)
// result.tokens_predicted, stopped_eos, stopped_word, interrupted, timings
```

Callback optional — даёт streaming tokens. Не используем в #4 (одно слово,
finishes быстро).

## Release

```typescript
await ctx.release(); // освобождает model memory
```

## Mapping в наш Adapter (Task 14)

```typescript
// LlamaContextAdapter.completion(prompt, config: InferenceConfig):
//   native.completion({
//     prompt,
//     temperature: config.temperature ?? 0.2,
//     top_p: config.top_p ?? 0.9,
//     top_k: config.top_k ?? 40,
//     penalty_repeat: config.repeat_penalty ?? 1.1,
//     n_predict: config.max_tokens ?? 32,
//     stop: config.stop ?? ['\n'],
//     n_threads: config.n_threads ?? 4,
//   })
//   → return { text: result.text }
```

⚠️ Поле для repeat penalty в llama.rn: проверить точное имя
(`penalty_repeat` vs `repeat_penalty`). См. line 220+ types.d.ts.

## Parallel mode

`ctx.parallel.completion()` — non-blocking queue для concurrent requests.
**Не используем** в #4 — наш InferenceQueue serializeа через JS-side mutex.
Parallel можно подключить в v2 для batch translation.

## TokenData (streaming)

```typescript
{
  token: string,
  content?: string,
  accumulated_text?: string,
  requestId?: number,
  tool_calls?: ToolCall[],
  reasoning_content?: string,
  completion_probabilities?: NativeCompletionTokenProb[],
}
```

## Что важно для Plan

- Plan'е (Task 14, 21) `max_tokens` → переименовать в `n_predict` при call'е.
- `release()` существует — корректно для unload.
- `n_gpu_layers: 99` для iOS Metal offload — OK.
- Plan не использует chat/jinja/tools — мы делаем raw prompt mode.

## Build implications

- iOS pod ожидает llama.cpp Metal compilation. Pod install ~5-10 минут.
- Android: NDK gradle build llama.cpp CPU. Тоже несколько минут.
- Dev-client rebuild обязателен после `npm install llama.rn`.
