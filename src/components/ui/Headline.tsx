// Заголовок уровней H1/H2/H3 с фиксированной типографикой по дизайн-системе.
// theme.ink читается inline через useUnistyles() — иначе закэшированный
// StyleSheet.create не подхватывает смену темы (см. PhoneShell.tsx).
import React from 'react';
import { Text, TextStyle, StyleSheet as RN } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

const staticStyles = RN.create({
  h1: { fontFamily: 'SourceSerif4-Medium', fontSize: 30, lineHeight: 33, letterSpacing: -0.6, fontWeight: '500' } satisfies TextStyle,
  h2: { fontFamily: 'SourceSerif4-Medium', fontSize: 22, lineHeight: 26, letterSpacing: -0.22, fontWeight: '500' } satisfies TextStyle,
  h3: { fontFamily: 'Inter-SemiBold', fontSize: 16, lineHeight: 22, letterSpacing: -0.16, fontWeight: '600' } satisfies TextStyle,
});

export const Headline: React.FC<{ level: 1|2|3; children: React.ReactNode }> = ({ level, children }) => {
  const { theme } = useUnistyles();
  const base = level === 1 ? staticStyles.h1 : level === 2 ? staticStyles.h2 : staticStyles.h3;
  return <Text style={[base, { color: theme.ink }]}>{children}</Text>;
};
