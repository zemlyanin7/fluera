import React from 'react';
import { Text, Pressable } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

interface Props {
  shown: boolean;
  onDismiss: () => void;
}

export function HeartFirstTimeHint({ shown, onDismiss }: Props) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  if (!shown) return null;
  return (
    <Pressable
      onPress={onDismiss}
      style={{
        marginTop: 8,
        padding: 10,
        backgroundColor: theme.accentSoft,
        borderRadius: 8,
      }}
    >
      <Text style={{ color: theme.ink, fontSize: 12 }}>
        💡 {t('translation.heart.firstTimeHint', { defaultValue: 'Тап ♡ чтобы сохранить слово в Deck' })}
      </Text>
    </Pressable>
  );
}
