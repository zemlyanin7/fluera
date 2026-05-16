// Числовая карточка статистики: большое число + подпись + опциональная дельта.
// theme.* читается inline через useUnistyles() — иначе закэшированный
// StyleSheet.create не подхватывает смену темы (см. PhoneShell.tsx).
import React from 'react';
import { View, Text, ViewStyle, TextStyle, StyleSheet as RN } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

interface Props { num: string|number; label: string; delta?: string; deltaTone?: 'known'|'learning'|'ink2'; }

const staticStyles = RN.create({
  wrap: { flexDirection: 'column', gap: 2 } satisfies ViewStyle,
  row:  { flexDirection: 'row', alignItems: 'baseline', gap: 4 } satisfies ViewStyle,
  num:  { fontFamily: 'SourceSerif4-Medium', fontSize: 32, fontWeight: '500', letterSpacing: -0.64 } satisfies TextStyle,
  label:{ fontFamily: 'Inter-SemiBold', fontSize: 11, fontWeight: '600', letterSpacing: 0.88, textTransform: 'uppercase' } satisfies TextStyle,
  delta:{ fontFamily: 'Inter-SemiBold', fontSize: 12, fontWeight: '600' } satisfies TextStyle,
});

export const Stat: React.FC<Props> = ({ num, label, delta, deltaTone = 'known' }) => {
  const { theme } = useUnistyles();
  const toneColor =
    deltaTone === 'known' ? theme.known
    : deltaTone === 'learning' ? theme.learning
    : theme.ink2;
  return (
    <View style={staticStyles.wrap}>
      <Text style={[staticStyles.label, { color: theme.ink3 }]}>{label}</Text>
      <View style={staticStyles.row}>
        <Text style={[staticStyles.num, { color: theme.ink }]}>{num}</Text>
        {delta && <Text style={[staticStyles.delta, { color: toneColor }]}>{delta}</Text>}
      </View>
    </View>
  );
};
