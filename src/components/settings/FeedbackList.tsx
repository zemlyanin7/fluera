// FeedbackList — список жалоб пользователя на переводы (translation feedback).
// Пустое состояние, плейсхолдер, ClearAll кнопка.
import React from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import type { TranslationFeedbackDTO } from '@/hooks/data/useTranslationFeedback';

interface Props {
  items: TranslationFeedbackDTO[];
  onClearAll: () => void;
}

export function FeedbackList({ items, onClearAll }: Props) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();

  if (items.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ color: theme.ink2, fontSize: 16, textAlign: 'center' }}>
          {t('settings.feedback.empty', { defaultValue: 'Жалоб пока нет' })}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => (
          <View
            style={{
              padding: 12,
              backgroundColor: theme.paper2,
              borderRadius: 10,
              gap: 6,
            }}
          >
            <Text style={{ color: theme.ink, fontSize: 14 }}>{item.sourceSentence}</Text>
            <Text style={{ color: theme.ink2, fontSize: 13 }}>{item.translatedSentence}</Text>
            <Text style={{ color: theme.ink3, fontSize: 11 }}>
              {item.bookLanguage} → {item.nativeLanguage} · {item.modelVersion}
            </Text>
          </View>
        )}
        ListFooterComponent={
          <Pressable
            onPress={onClearAll}
            accessibilityRole="button"
            hitSlop={10}
            style={{ minHeight: 44, marginTop: 8, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: theme.accent }}>
              {t('settings.feedback.clearAll', { defaultValue: 'Очистить все жалобы' })}
            </Text>
          </Pressable>
        }
      />
    </View>
  );
}
