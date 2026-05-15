// Линейный индикатор прогресса с вариантами заливки ink / accent
import React from 'react';
import { View, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export type ProgressTone = 'ink' | 'accent';
interface Props { value: number; height?: number; tone?: ProgressTone; }

const styles = StyleSheet.create((theme) => ({
  track: { width: '100%', backgroundColor: `${theme.ink}1A`, borderRadius: 999, overflow: 'hidden' } satisfies ViewStyle,
  fillInk:    { backgroundColor: theme.ink, height: '100%', borderRadius: 999 } satisfies ViewStyle,
  fillAccent: { backgroundColor: theme.accent, height: '100%', borderRadius: 999 } satisfies ViewStyle,
}));

export const ProgressBar: React.FC<Props> = ({ value, height = 3, tone = 'accent' }) => {
  const clamped = Math.max(0, Math.min(1, value));
  const fill = tone === 'accent' ? styles.fillAccent : styles.fillInk;
  return (
    <View style={[styles.track, { height }]}>
      <View style={[fill, { width: `${clamped * 100}%` }]} />
    </View>
  );
};
