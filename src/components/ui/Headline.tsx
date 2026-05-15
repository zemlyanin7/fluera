// Заголовок уровней H1/H2/H3 с фиксированной типографикой по дизайн-системе
import React from 'react';
import { Text, TextStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

const styles = StyleSheet.create((theme) => ({
  h1: { fontFamily: 'SourceSerif4-Medium', fontSize: 30, lineHeight: 33, letterSpacing: -0.6, color: theme.ink, fontWeight: '500' } satisfies TextStyle,
  h2: { fontFamily: 'SourceSerif4-Medium', fontSize: 22, lineHeight: 26, letterSpacing: -0.22, color: theme.ink, fontWeight: '500' } satisfies TextStyle,
  h3: { fontFamily: 'Inter-SemiBold', fontSize: 16, letterSpacing: -0.16, color: theme.ink, fontWeight: '600' } satisfies TextStyle,
}));

export const Headline: React.FC<{ level: 1|2|3; children: React.ReactNode }> = ({ level, children }) => {
  const style = level === 1 ? styles.h1 : level === 2 ? styles.h2 : styles.h3;
  return <Text style={style}>{children}</Text>;
};
