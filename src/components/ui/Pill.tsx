// Пилюля-чип с вариантами: neutral / accent / known / learning.
// theme.* читается inline через useUnistyles() — иначе закэшированный
// StyleSheet.create не подхватывает смену темы (см. PhoneShell.tsx).
import React from 'react';
import { View, Text, ViewStyle, TextStyle, StyleSheet as RN } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

export type PillTone = 'neutral' | 'accent' | 'known' | 'learning';

const staticStyles = RN.create({
  base: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, alignSelf: 'flex-start' } satisfies ViewStyle,
  text: { fontFamily: 'Inter-Medium', fontSize: 12, fontWeight: '500', letterSpacing: 0.12 } satisfies TextStyle,
});

export const Pill: React.FC<{ tone?: PillTone; icon?: React.ReactNode; children: React.ReactNode }> = ({ tone = 'neutral', icon, children }) => {
  const { theme } = useUnistyles();
  // C5: явный switch вместо `(styles as any)[...]` — сохраняем типизацию.
  const bg: ViewStyle =
    tone === 'accent' ? { backgroundColor: theme.accentSoft }
    : tone === 'known' ? { backgroundColor: theme.knownSoft }
    : tone === 'learning' ? { backgroundColor: theme.learningSoft }
    : { backgroundColor: `${theme.ink}0F` };
  const fg: TextStyle =
    tone === 'accent' ? { color: theme.accent }
    : tone === 'known' ? { color: theme.known }
    : tone === 'learning' ? { color: theme.learning }
    : { color: theme.ink2 };
  return (
    <View style={[staticStyles.base, bg]}>
      {icon}
      <Text style={[staticStyles.text, fg]}>{children}</Text>
    </View>
  );
};
