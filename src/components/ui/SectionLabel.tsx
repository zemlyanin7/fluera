// Подпись секции: маленький жирный uppercase текст для группировки контента.
// theme.ink3 читается inline через useUnistyles() — иначе закэшированный
// StyleSheet.create не подхватывает смену темы (см. PhoneShell.tsx).
import React from 'react';
import { Text, StyleSheet as RN } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

const staticStyles = RN.create({
  label: {
    fontFamily: 'Inter-SemiBold', fontSize: 11, fontWeight: '600',
    letterSpacing: 0.88, textTransform: 'uppercase',
  },
});

export const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme } = useUnistyles();
  return <Text style={[staticStyles.label, { color: theme.ink3 }]}>{children}</Text>;
};
