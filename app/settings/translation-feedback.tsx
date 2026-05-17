// Translation feedback viewer — список жалоб пользователя на переводы.
// Маршрут: /settings/translation-feedback
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { FeedbackList } from '@/components/settings/FeedbackList';
import { useTranslationFeedback } from '@/hooks/data/useTranslationFeedback';
import type { TranslationFeedbackDTO } from '@/hooks/data/useTranslationFeedback';

export default function TranslationFeedbackScreen() {
  const { listRecent, clearAll } = useTranslationFeedback();
  const [items, setItems] = useState<TranslationFeedbackDTO[]>([]);

  const reload = async () => setItems(await listRecent(500));

  useEffect(() => {
    void reload();
  }, []);

  const handleClear = async () => {
    await clearAll();
    setItems([]);
  };

  return (
    <View style={{ flex: 1 }}>
      <FeedbackList items={items} onClearAll={handleClear} />
    </View>
  );
}
