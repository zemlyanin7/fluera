// Контейнер-карточка с закруглением и полупрозрачным фоном
import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

const styles = StyleSheet.create((theme) => ({
  card: { backgroundColor: `${theme.ink}0A`, borderRadius: 18 } satisfies ViewStyle,
}));

interface Props { children: React.ReactNode; padding?: number; style?: StyleProp<ViewStyle>; }
export const Card: React.FC<Props> = ({ children, padding = 16, style }) =>
  <View style={[styles.card, { padding }, style]}>{children}</View>;
