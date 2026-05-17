import React, { useState } from 'react';
import { Pressable, Text, View, AccessibilityInfo } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

export interface Sense {
  sense: string;
  translation: string;
}

interface Props {
  senses: Sense[];
}

export function PolysemyDisclosure({ senses }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { theme } = useUnistyles();
  const { t } = useTranslation();

  if (!senses.length) return null;

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) {
      AccessibilityInfo.announceForAccessibility(
        t('translation.a11y.altSensesRevealed', {
          count: senses.length,
          defaultValue: `${senses.length} senses revealed`,
        }),
      );
    }
  };

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('translation.a11y.altSenses', {
          count: senses.length,
          defaultValue: `Alt senses: ${senses.length}`,
        })}
        accessibilityHint={t('translation.a11y.altSensesHint', {
          defaultValue: 'Tap to expand',
        })}
        accessibilityState={{ expanded }}
        onPress={toggle}
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <Text style={{ color: theme.ink2, fontSize: 13 }}>
          {expanded ? '▴' : '▾'}{' '}
          {t('translation.alternativeSenses', {
            count: senses.length,
            defaultValue: `Other senses (${senses.length})`,
          })}
        </Text>
      </Pressable>
      {expanded && (
        <View style={{ marginTop: 6 }}>
          {senses.map((s, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <Text style={{ color: theme.ink2, fontSize: 13 }}>{'• '}</Text>
              <Text style={{ color: theme.ink2, fontSize: 13 }}>{s.sense}</Text>
              <Text style={{ color: theme.ink2, fontSize: 13 }}>{': '}</Text>
              <Text style={{ color: theme.ink2, fontSize: 13 }}>{s.translation}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
