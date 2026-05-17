import React from 'react';
import { View, Text } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

const FALLBACK_LABELS: Record<string, string> = {
  idiom: 'идиома',
  phrasal_verb: 'phrasal verb',
  collocation: 'коллокация',
  proverb: 'поговорка',
};

interface Props {
  type: 'idiom' | 'phrasal_verb' | 'collocation' | 'proverb' | string;
}

export function MweChip({ type }: Props) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  // i18n keys will be wired in Phase 22; defaultValue provides fallback until then.
  const label = t(`translation.mweType.${type}`, {
    defaultValue: FALLBACK_LABELS[type] ?? type,
  });
  return (
    <View
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={t('translation.a11y.mweChip', {
        type: label,
        defaultValue: `MWE type: ${label}`,
      })}
      style={{
        backgroundColor: theme.accentSoft,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: 'flex-start',
        minHeight: 22,
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: theme.ink, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}
