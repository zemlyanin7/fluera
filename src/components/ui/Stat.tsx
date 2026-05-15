// Числовая карточка статистики: большое число + подпись + опциональная дельта
import React from 'react';
import { View, Text, ViewStyle, TextStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

interface Props { num: string|number; label: string; delta?: string; deltaTone?: 'known'|'learning'|'ink2'; }

const styles = StyleSheet.create((theme) => ({
  wrap: { flexDirection: 'column', gap: 2 } satisfies ViewStyle,
  row:  { flexDirection: 'row', alignItems: 'baseline', gap: 4 } satisfies ViewStyle,
  num:  { fontFamily: 'SourceSerif4-Medium', fontSize: 32, fontWeight: '500', letterSpacing: -0.64, color: theme.ink } satisfies TextStyle,
  label:{ fontFamily: 'Inter-SemiBold', fontSize: 11, fontWeight: '600', letterSpacing: 0.88, textTransform: 'uppercase', color: theme.ink3 } satisfies TextStyle,
  delta:{ fontFamily: 'Inter-SemiBold', fontSize: 12, fontWeight: '600' } satisfies TextStyle,
  dKnown:    { color: theme.known },
  dLearning: { color: theme.learning },
  dInk2:     { color: theme.ink2 },
}));

export const Stat: React.FC<Props> = ({ num, label, delta, deltaTone = 'known' }) => {
  const tone = deltaTone === 'known' ? styles.dKnown : deltaTone === 'learning' ? styles.dLearning : styles.dInk2;
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Text style={styles.num}>{num}</Text>
        {delta && <Text style={[styles.delta, tone]}>{delta}</Text>}
      </View>
    </View>
  );
};
