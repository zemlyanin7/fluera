// Тонкая разделительная линия 1px поверх ink с opacity 0.1
import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

const styles = StyleSheet.create((theme) => ({
  hairline: { height: 1, backgroundColor: theme.ink, opacity: 0.1 },
}));

export const Hairline: React.FC = () => <View style={styles.hairline} />;
