import React from 'react';
import { Text, View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

interface Props {
  count: number;
}

export function EncounterBadge({ count }: Props) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  if (count >= 10) return null;

  let label: string;
  let color = theme.ink3;

  if (count === 0) {
    label = t('translation.encounter.firstTime', { defaultValue: 'впервые встречаете' });
    color = theme.accent;
  } else if (count <= 3) {
    label = t('translation.encounter.nthTime', {
      ordinal: count + 1,
      defaultValue: `${count + 1}-й раз`,
    });
    color = theme.ink2;
  } else {
    label = t('translation.encounter.familiar', { defaultValue: 'знакомое' });
  }

  return (
    <View accessible={true} accessibilityRole="text">
      <Text style={{ color, fontSize: 12 }}>✦ {label}</Text>
    </View>
  );
}
