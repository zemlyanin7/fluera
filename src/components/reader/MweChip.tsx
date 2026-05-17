import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

interface Props {
  type: 'idiom' | 'phrasal_verb' | 'collocation' | 'proverb' | string;
}

const FALLBACK_LABELS: Record<string, string> = {
  idiom: 'идиома',
  phrasal_verb: 'phrasal verb',
  collocation: 'коллокация',
  proverb: 'поговорка',
};

const FALLBACK_EXPLAINERS: Record<string, string> = {
  idiom: 'Идиома — значение не складывается из отдельных слов. Запоминайте целиком.',
  phrasal_verb: 'Предлог меняет смысл глагола. Учите как одну единицу.',
  collocation: 'Слова часто употребляются вместе.',
  proverb: 'Пословица — фиксированное выражение народной мудрости.',
};

export function MweChip({ type }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const label = t(`translation.mweType.${type}`, { defaultValue: FALLBACK_LABELS[type] ?? type });
  const explainer = t(`translation.mweExplainer.${type}.fallback`, {
    defaultValue: FALLBACK_EXPLAINERS[type] ?? '',
  });
  return (
    <View>
      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityLabel={t('translation.a11y.mweChip', { type: label, defaultValue: `MWE type: ${label}` })}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((v) => !v)}
        hitSlop={10}
        style={{
          backgroundColor: theme.accentSoft,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 12,
          alignSelf: 'flex-start',
          minHeight: 24,
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: theme.ink, fontSize: 11, fontWeight: '600' }}>{label}</Text>
      </Pressable>
      {expanded && explainer ? (
        <Text style={{ color: theme.ink2, fontSize: 12, marginTop: 4 }}>{explainer}</Text>
      ) : null}
    </View>
  );
}
