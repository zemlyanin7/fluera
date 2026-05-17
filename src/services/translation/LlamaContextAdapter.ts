// Adapter оборачивает llama.rn LlamaContext (или совместимый mock) под
// наш domain LlamaContext interface. Все llama.rn-specific параметры
// (n_predict, penalty_repeat) изолированы здесь — если API меняется,
// меняется только этот файл.
import type { LlamaContext as NativeLlamaContext } from 'llama.rn';
import type { LlamaContext, InferenceConfig, InferenceResult } from './llamaTypes';

/**
 * Минимальное подмножество llama.rn API которое мы используем.
 * Любой объект с такой формой работает (mock в тестах, real native ctx
 * в production).
 */
export interface MinimalNativeCtx {
  completion(params: Record<string, unknown>): Promise<{ text: string }>;
  release(): Promise<void>;
}

export interface ChatMsg { role: 'system' | 'user' | 'assistant'; content: string }

export class LlamaContextAdapter implements LlamaContext {
  constructor(private native: MinimalNativeCtx | NativeLlamaContext) {}

  /**
   * Принимает либо одиночный prompt-string (word translate) либо messages
   * array (sentence translate с system+user). Adapter wraps в `messages: [...]`
   * + `jinja: true` так что llama.rn применит chat template модели.
   */
  async completion(
    promptOrMessages: string | ChatMsg[],
    config: InferenceConfig,
  ): Promise<InferenceResult> {
    const messages: ChatMsg[] = Array.isArray(promptOrMessages)
      ? promptOrMessages
      : [{ role: 'user', content: promptOrMessages }];
    const params: Record<string, unknown> = {
      messages,
      jinja: true,
      temperature: config.temperature ?? 0.2,
      top_p: config.top_p ?? 0.9,
      top_k: config.top_k ?? 40,
      penalty_repeat: config.repeat_penalty ?? 1.1,
      n_predict: config.max_tokens ?? 32,
      stop: config.stop ?? ['\n'],
      n_threads: config.n_threads ?? 4,
    };
    const res = await (this.native as MinimalNativeCtx).completion(params);
    return { text: res.text };
  }

  async release(): Promise<void> {
    await this.native.release();
  }
}
