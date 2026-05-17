import { LlamaTranslationService } from '../LlamaTranslationService';
import { CacheLayer } from '../CacheLayer';
import { InferenceQueue } from '../InferenceQueue';
import { useLlmStatusStore } from '@/stores/llmStatusStore';

function makeCtx(text: string) {
  return {
    completion: jest.fn().mockResolvedValue({ text }),
    release: jest.fn(),
  };
}

const mockRepo: any = {
  findByKey: jest.fn().mockResolvedValue(null),
  upsertByKey: jest.fn().mockResolvedValue({}),
  countAll: jest.fn().mockResolvedValue(0),
  clearAll: jest.fn().mockResolvedValue(0),
  purgeOlderThan: jest.fn().mockResolvedValue(0),
  purgeOldest10Percent: jest.fn().mockResolvedValue(0),
};

describe('LlamaTranslationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useLlmStatusStore.setState({ status: 'ready', progress: 0, errorMessage: null });
  });

  it('returns MODEL_NOT_INSTALLED when status not_installed', async () => {
    useLlmStatusStore.setState({ status: 'not_installed' } as any);
    const svc = new LlamaTranslationService({
      contextProvider: () => makeCtx('кошка') as any,
      cache: new CacheLayer(mockRepo, 10, () => 'mv1', () => 'kb1'),
      queue: new InferenceQueue(),
    });
    const res = await svc.translate({
      word: 'cat',
      contextWindow: 'the cat',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
    });
    expect(res.status).toBe('error');
    expect(res.errorCode).toBe('MODEL_NOT_INSTALLED');
  });

  it('returns MODEL_LOADING when status loading', async () => {
    useLlmStatusStore.setState({ status: 'loading' } as any);
    const svc = new LlamaTranslationService({
      contextProvider: () => makeCtx('кошка') as any,
      cache: new CacheLayer(mockRepo, 10, () => 'mv1', () => 'kb1'),
      queue: new InferenceQueue(),
    });
    const res = await svc.translate({
      word: 'x',
      contextWindow: 'y',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
    });
    expect(res.errorCode).toBe('MODEL_LOADING');
  });

  it('returns ok with inference on cache miss', async () => {
    const ctx = makeCtx('кошка');
    const svc = new LlamaTranslationService({
      contextProvider: () => ctx as any,
      cache: new CacheLayer(mockRepo, 10, () => 'mv1', () => 'kb1'),
      queue: new InferenceQueue(),
    });
    const res = await svc.translate({
      word: 'cat',
      contextWindow: 'the cat sat',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
    });
    expect(res.status).toBe('ok');
    expect(res.translation).toBe('кошка');
    expect(res.source).toBe('inference');
    expect(ctx.completion).toHaveBeenCalled();
  });

  it('returns cache hit without inference', async () => {
    const ctx = makeCtx('кошка');
    const cache = new CacheLayer(mockRepo, 10, () => 'mv1', () => 'kb1');
    await cache.write('cat', 'the cat sat', 'en', 'ru', 'кошка');
    const svc = new LlamaTranslationService({
      contextProvider: () => ctx as any,
      cache,
      queue: new InferenceQueue(),
    });
    const res = await svc.translate({
      word: 'cat',
      contextWindow: 'the cat sat',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
    });
    expect(res.status).toBe('ok');
    expect(res.source).toBe('memory');
    expect(ctx.completion).not.toHaveBeenCalled();
  });

  it('returns EMPTY_RESPONSE on whitespace output', async () => {
    const ctx = makeCtx('   ');
    const svc = new LlamaTranslationService({
      contextProvider: () => ctx as any,
      cache: new CacheLayer(mockRepo, 10, () => 'mv1', () => 'kb1'),
      queue: new InferenceQueue(),
    });
    const res = await svc.translate({
      word: 'x',
      contextWindow: 'y',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
    });
    expect(res.errorCode).toBe('EMPTY_RESPONSE');
  });

  it('returns INFERENCE_TIMEOUT when completion exceeds timeout', async () => {
    const ctx = {
      completion: jest.fn(
        () => new Promise((r) => setTimeout(() => r({ text: 'late' }), 200)),
      ),
      release: jest.fn(),
    };
    const svc = new LlamaTranslationService({
      contextProvider: () => ctx as any,
      cache: new CacheLayer(mockRepo, 10, () => 'mv1', () => 'kb1'),
      queue: new InferenceQueue(),
      timeoutMs: 50,
    });
    const res = await svc.translate({
      word: 'x',
      contextWindow: 'y',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
    });
    expect(res.errorCode).toBe('INFERENCE_TIMEOUT');
  });

  it('returns INFERENCE_FAILED on exception', async () => {
    const ctx = {
      completion: jest.fn().mockRejectedValue(new Error('crash')),
      release: jest.fn(),
    };
    const svc = new LlamaTranslationService({
      contextProvider: () => ctx as any,
      cache: new CacheLayer(mockRepo, 10, () => 'mv1', () => 'kb1'),
      queue: new InferenceQueue(),
    });
    const res = await svc.translate({
      word: 'x',
      contextWindow: 'y',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
    });
    expect(res.errorCode).toBe('INFERENCE_FAILED');
    expect(res.errorMessage).toContain('crash');
  });
});
