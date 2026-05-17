// Линейный индикатор прогресса с вариантами заливки ink / accent.
// theme.* читается inline через useUnistyles() — иначе закэшированный
// StyleSheet.create не подхватывает смену темы (см. PhoneShell.tsx).
import React from 'react';
import { View, ViewStyle, StyleSheet as RN } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

export type ProgressTone = 'ink' | 'accent';
interface Props { value: number; height?: number; tone?: ProgressTone; }

const staticStyles = RN.create({
  track: { width: '100%', borderRadius: 999, overflow: 'hidden' } satisfies ViewStyle,
  fillBase: { height: '100%', borderRadius: 999 } satisfies ViewStyle,
});

export const ProgressBar: React.FC<Props> = ({ value, height = 3, tone = 'accent' }) => {
  const { theme } = useUnistyles();
  const clamped = Math.max(0, Math.min(1, value));
  const fillBg = tone === 'accent' ? theme.accent : theme.ink;
  return (
    <View style={[staticStyles.track, { height, backgroundColor: `${theme.ink}1A` }]}>
      <View style={[staticStyles.fillBase, { width: `${clamped * 100}%`, backgroundColor: fillBg }]} />
    </View>
  );
};
