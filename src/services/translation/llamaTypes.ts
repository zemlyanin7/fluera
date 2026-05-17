// Domain-level interfaces, изолирующие наш код от llama.rn API surface.
// LlamaContextAdapter оборачивает реальный llama.rn LlamaContext;
// MockLlamaContext в тестах реализует тот же interface.
export interface InferenceConfig {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  repeat_penalty?: number;
  max_tokens?: number;
  stop?: string[];
  n_threads?: number;
}

export interface InferenceResult {
  text: string;
}

export interface LlamaContext {
  completion(prompt: string, config: InferenceConfig): Promise<InferenceResult>;
  release(): Promise<void>;
}
