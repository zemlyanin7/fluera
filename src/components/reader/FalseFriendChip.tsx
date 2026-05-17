import React from 'react';
import { Pressable, Text } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

interface Props {
  looksLike: string;
  actualMeaning: string;
  expanded: boolean;
  onToggle: () => void;
}

export function FalseFriendChip({ looksLike, actualMeaning, expanded, onToggle }: Props) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('translation.a11y.falseFriendWarning', {
        word: looksLike,
        defaultValue: `False friend warning: ${looksLike}`,
      })}
      accessibilityHint={t('translation.a11y.falseFriendHint', {
        defaultValue: 'Tap to see actual meaning',
      })}
      accessibilityState={{ expanded }}
      onPress={onToggle}
      hitSlop={14}
      style={{
        backgroundColor: theme.learningSoft,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        minHeight: 44,
        justifyContent: 'center',
        marginVertical: 4,
      }}
    >
      <Text style={{ color: theme.ink, fontSize: 13 }}>🚩 ≠ {looksLike}</Text>
      {expanded && (
        <Text style={{ color: theme.ink2, fontSize: 12, marginTop: 4 }}>{actualMeaning}</Text>
      )}
    </Pressable>
  );
}
