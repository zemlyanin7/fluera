import React from 'react';
import { View, Text } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';

export function ExperimentalBadge() {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const label = t('translation.experimentalBadge', { defaultValue: 'Экспериментальный' });
  return (
    <View
      accessible={true}
      accessibilityRole="alert"
      accessibilityLabel={label}
      style={{
        backgroundColor: theme.paper2,
        borderLeftWidth: 3,
        borderLeftColor: theme.accent,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <Text style={{ color: theme.ink, fontSize: 13 }}>{label}</Text>
    </View>
  );
}
