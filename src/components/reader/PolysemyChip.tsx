import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

export function PolysemyChip() {
  const [expanded, setExpanded] = useState(false);
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  return (
    <View>
      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((v) => !v)}
        hitSlop={10}
        style={{
          paddingHorizontal: 8,
          paddingVertical: 4,
          backgroundColor: theme.paper2,
          borderRadius: 10,
          minHeight: 24,
          alignSelf: 'flex-start',
        }}
      >
        <Text style={{ color: theme.ink2, fontSize: 11 }}>
          + {t('translation.polysemy.chip', { defaultValue: 'полисемия' })}
        </Text>
      </Pressable>
      {expanded && (
        <Text style={{ color: theme.ink2, fontSize: 12, marginTop: 4 }}>
          {t('translation.polysemy.explainer', {
            defaultValue:
              'У этого слова несколько значений. Перевод выше — основное в этом контексте.',
          })}
        </Text>
      )}
    </View>
  );
}
