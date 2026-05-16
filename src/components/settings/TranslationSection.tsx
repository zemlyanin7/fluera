// Translation Model section в Settings (placeholder для #8 polish).
// Показывает status, download/re-download CTA, clear cache.
import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useLlmStatusStore } from '@/stores/llmStatusStore';
import { useModelLifecycle } from '@/services/translation/useModelLifecycle';
import { useDatabase } from '@/db/DatabaseContext';
import { TranslationCacheRepository } from '@/db/repositories/TranslationCacheRepository';
import { SectionLabel } from '@/components/ui';

export function TranslationSection() {
  const { theme } = useUnistyles();
  const status = useLlmStatusStore((s) => s.status);
  const progress = useLlmStatusStore((s) => s.progress);
  const errorMessage = useLlmStatusStore((s) => s.errorMessage);
  const { startDownload, wipeAndRedownload, cancelDownload } = useModelLifecycle();
  const db = useDatabase();

  const clearCache = async () => {
    await new TranslationCacheRepository(db).clearAll();
  };

  const labelByStatus: Record<string, string> = {
    not_installed: 'Модель не установлена',
    downloading: `Скачивание ${Math.floor(progress * 100)}%`,
    paused: 'Пауза',
    verifying: 'Проверка целостности…',
    installed: 'Установлена (не загружена)',
    loading: 'Загружается в память…',
    warming_up: 'Прогрев…',
    ready: 'Готово',
    error: 'Ошибка',
  };

  return (
    <View>
      <SectionLabel>Translation Model</SectionLabel>
      <View style={{ marginTop: 8, gap: 10 }}>
        <Text style={{ color: theme.ink }}>Статус: {labelByStatus[status] ?? status}</Text>
        {status === 'downloading' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator color={theme.accent} />
            <Pressable
              onPress={cancelDownload}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                backgroundColor: `${theme.ink}10`,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: theme.ink }}>Отмена</Text>
            </Pressable>
          </View>
        )}
        {errorMessage && (
          <Text style={{ color: theme.accent, fontSize: 12 }}>{errorMessage}</Text>
        )}
        {status === 'not_installed' && (
          <Pressable
            onPress={startDownload}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 10,
              backgroundColor: theme.accent,
              borderRadius: 999,
              alignSelf: 'flex-start',
            }}
          >
            <Text style={{ color: theme.paper, fontFamily: 'Inter-SemiBold' }}>
              Скачать модель (~440MB)
            </Text>
          </Pressable>
        )}
        {(status === 'installed' || status === 'ready') && (
          <Pressable
            onPress={wipeAndRedownload}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 10,
              backgroundColor: `${theme.ink}10`,
              borderRadius: 999,
              alignSelf: 'flex-start',
            }}
          >
            <Text style={{ color: theme.ink }}>Переcкачать модель</Text>
          </Pressable>
        )}
        <Pressable
          onPress={clearCache}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 10,
            backgroundColor: `${theme.ink}10`,
            borderRadius: 999,
            alignSelf: 'flex-start',
          }}
        >
          <Text style={{ color: theme.ink }}>Очистить кэш переводов</Text>
        </Pressable>
      </View>
    </View>
  );
}
