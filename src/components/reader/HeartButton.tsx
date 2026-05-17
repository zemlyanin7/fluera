import React from 'react';
import { Pressable, Text } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

interface Props {
  saved: boolean;
  onToggle: () => void;
}

export function HeartButton({ saved, onToggle }: Props) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={t('translation.heart.label', { defaultValue: 'Сохранить в Deck' })}
      accessibilityState={{ selected: saved }}
      onPress={onToggle}
      hitSlop={10}
      style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ fontSize: 20, color: saved ? theme.accent : theme.ink2 }}>
        {saved ? '♥' : '♡'}
      </Text>
    </Pressable>
  );
}
