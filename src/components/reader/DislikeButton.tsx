import React from 'react';
import { Pressable, Text } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

interface Props {
  isDisliked: boolean;
  onToggle: () => void;
}

export function DislikeButton({ isDisliked, onToggle }: Props) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const label = t('translation.dislikeLabel', { defaultValue: 'Плохой перевод' });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isDisliked }}
      onPress={onToggle}
      hitSlop={10}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        minHeight: 44,
        gap: 6,
        backgroundColor: isDisliked ? theme.learningSoft : 'transparent',
        borderRadius: 8,
      }}
    >
      <Text style={{ fontSize: 16 }}>👎</Text>
      <Text style={{ color: isDisliked ? theme.ink : theme.ink2, fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  );
}
