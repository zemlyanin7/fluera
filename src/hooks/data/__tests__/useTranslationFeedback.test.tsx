import { renderHook, act } from '@testing-library/react-native';
import React from 'react';
import { DatabaseProvider } from '@/db/DatabaseContext';
import { createTestDatabase } from '@/db/testDatabase';
import { useTranslationFeedback } from '@/hooks/data/useTranslationFeedback';

describe('useTranslationFeedback', () => {
  it('record + listRecent работают через repository', async () => {
    const db = createTestDatabase();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DatabaseProvider initialDatabase={db}>{children}</DatabaseProvider>
    );
    const { result } = renderHook(() => useTranslationFeedback(), { wrapper });
    await act(async () => {
      await result.current.record({
        sourceSentence: 'Hello',
        translatedSentence: 'Привет',
        bookLanguage: 'en',
        nativeLanguage: 'ru',
        modelVersion: 'mv1',
        kernelBuildId: 'kb1',
        bookId: null,
      });
    });
    const list = await result.current.listRecent(10);
    expect(list).toHaveLength(1);
    expect(list[0]!.sourceSentence).toBe('Hello');
    expect(list[0]!.translatedSentence).toBe('Привет');
  });

  it('clearAll удаляет все записи', async () => {
    const db = createTestDatabase();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DatabaseProvider initialDatabase={db}>{children}</DatabaseProvider>
    );
    const { result } = renderHook(() => useTranslationFeedback(), { wrapper });
    await act(async () => {
      await result.current.record({
        sourceSentence: 'Test',
        translatedSentence: 'Тест',
        bookLanguage: 'en',
        nativeLanguage: 'ru',
        modelVersion: 'mv1',
        kernelBuildId: null,
        bookId: null,
      });
    });
    await act(async () => {
      await result.current.clearAll();
    });
    const list = await result.current.listRecent(10);
    expect(list).toHaveLength(0);
  });
});
