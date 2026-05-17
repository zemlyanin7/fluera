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
  if (count >= 15) return null;

  let label: string;
  let color = theme.ink3;
  if (count === 0) {
    label = t('translation.encounter.firstTime', { defaultValue: 'впервые встречаете' });
    color = theme.accent;
  } else if (count <= 2) {
    label = t('translation.encounter.nthTime', { ordinal: count + 1, defaultValue: `${count + 1}-й раз` });
    color = theme.ink2;
  } else if (count <= 5) {
    label = t('translation.encounter.forming', {
      ordinal: count + 1,
      defaultValue: `${count + 1}-й раз, формируется узнавание`,
    });
    color = theme.ink2;
  } else if (count <= 9) {
    label = t('translation.encounter.consolidating', {
      ordinal: count + 1,
      defaultValue: `${count + 1}-й раз — закрепляется`,
    });
    color = theme.ink; // milestone — prominent
  } else {
    label = t('translation.encounter.wellKnown', { defaultValue: 'хорошо знакомо' });
    color = theme.ink3;
  }

  return (
    <View accessibilityRole="text">
      <Text style={{ color, fontSize: 12 }}>✦ {label}</Text>
    </View>
  );
}
