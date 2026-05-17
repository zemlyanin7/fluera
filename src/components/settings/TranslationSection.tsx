// Translation Model section в Settings (placeholder для #8 polish).
// Показывает status, download/re-download CTA, clear cache.
import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useLlmStatusStore } from '@/stores/llmStatusStore';
import { useModelLifecycle } from '@/services/translation/useModelLifecycle';
import { useTranslationService } from '@/services/translation/TranslationServiceContext';
import { SectionLabel } from '@/components/ui';

export function TranslationSection() {
  const { theme } = useUnistyles();
  const status = useLlmStatusStore((s) => s.status);
  const progress = useLlmStatusStore((s) => s.progress);
  const errorMessage = useLlmStatusStore((s) => s.errorMessage);
  const { startDownload, wipeAndRedownload, cancelDownload, resetError } = useModelLifecycle();
  const translation = useTranslationService();
  const [cacheCleared, setCacheCleared] = React.useState(false);

  const clearCache = async () => {
    // Через service: DB wipe + in-memory LRU reset. Иначе старые entries
    // продолжали возвращаться из memory cache.
    await translation.clearCache();
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 2000);
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
        {status === 'error' && (
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Pressable
              onPress={resetError}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                backgroundColor: `${theme.ink}10`,
                borderRadius: 999,
              }}
            >
              <Text style={{ color: theme.ink }}>Сбросить ошибку</Text>
            </Pressable>
            <Pressable
              onPress={wipeAndRedownload}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                backgroundColor: theme.accent,
                borderRadius: 999,
              }}
            >
              <Text style={{ color: theme.paper, fontFamily: 'Inter-SemiBold' }}>
                Удалить и скачать заново
              </Text>
            </Pressable>
          </View>
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
          <Text style={{ color: theme.ink }}>
            {cacheCleared ? 'Кэш очищен ✓' : 'Очистить кэш переводов'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
