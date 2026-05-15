// Подпись секции: маленький жирный uppercase текст для группировки контента
import React from 'react';
import { Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

const styles = StyleSheet.create((theme) => ({
  label: {
    fontFamily: 'Inter-SemiBold', fontSize: 11, fontWeight: '600',
    letterSpacing: 0.88, textTransform: 'uppercase', color: theme.ink3,
  },
}));

export const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  <Text style={styles.label}>{children}</Text>;
