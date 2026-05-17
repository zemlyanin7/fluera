// Тонкая разделительная линия 1px поверх ink с opacity 0.1.
// theme.ink читается inline через useUnistyles() — иначе закэшированный
// StyleSheet.create не подхватывает смену темы (см. PhoneShell.tsx).
import React from 'react';
import { View, StyleSheet as RN } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

const staticStyles = RN.create({
  hairline: { height: 1, opacity: 0.1 },
});

export const Hairline: React.FC = () => {
  const { theme } = useUnistyles();
  return <View style={[staticStyles.hairline, { backgroundColor: theme.ink }]} />;
};
