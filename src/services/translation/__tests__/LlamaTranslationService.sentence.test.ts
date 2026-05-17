import { LlamaTranslationService } from '../LlamaTranslationService';
import { useLlmStatusStore } from '@/stores/llmStatusStore';

describe('LlamaTranslationService.translateSentence', () => {
  beforeEach(() => { useLlmStatusStore.setState({ status: 'ready' }); });

  it('returns experimental=true для sentence результата', async () => {
    const ctxStub = { completion: jest.fn().mockResolvedValue({ text: 'Привет мир.' }) };
    const cacheStub = {
      sentenceLookup: jest.fn().mockResolvedValue(null),
      writeSentence: jest.fn().mockResolvedValue(undefined),
      lookup: jest.fn().mockResolvedValue(null),
    };
    const queueStub = { run: (fn: any) => fn() };
    const svc = new LlamaTranslationService({
      contextProvider: () => ctxStub as any,
      cache: cacheStub as any,
      queue: queueStub as any,
      inferenceTracker: { current: () => 'warm' } as any,
    });
    const r = await svc.translateSentence({
      sentence: 'Hello world.',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
    });
    expect(r.status).toBe('ok');
    expect(r.experimental).toBe(true);
    expect(r.translatedSentence).toBe('Привет мир.');
  });

  it('error when model not ready', async () => {
    useLlmStatusStore.setState({ status: 'not_installed' } as any);
    const svc = new LlamaTranslationService({
      contextProvider: () => null,
      cache: { sentenceLookup: jest.fn(), writeSentence: jest.fn(), lookup: jest.fn() } as any,
      queue: { run: (fn: any) => fn() } as any,
      inferenceTracker: { current: () => 'warm' } as any,
    });
    const r = await svc.translateSentence({
      sentence: 'Hello.', bookLanguage: 'en', nativeLanguage: 'ru',
    });
    expect(r.status).toBe('error');
  });

  it('cache hit returns без inference', async () => {
    const ctxStub = { completion: jest.fn() };
    const cacheStub = {
      sentenceLookup: jest.fn().mockResolvedValue({ sentenceTranslation: 'Привет.', translatedWordOffset: null, source: 'memory' }),
      writeSentence: jest.fn(),
      lookup: jest.fn().mockResolvedValue(null),
    };
    const svc = new LlamaTranslationService({
      contextProvider: () => ctxStub as any,
      cache: cacheStub as any,
      queue: { run: (fn: any) => fn() } as any,
      inferenceTracker: { current: () => 'warm' } as any,
    });
    const r = await svc.translateSentence({
      sentence: 'Hello.', bookLanguage: 'en', nativeLanguage: 'ru',
    });
    expect(r.translatedSentence).toBe('Привет.');
    expect(ctxStub.completion).not.toHaveBeenCalled();
    expect(r.experimental).toBe(true);
  });
});
