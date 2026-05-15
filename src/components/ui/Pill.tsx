// Пилюля-чип с вариантами: neutral / accent / known / learning
import React from 'react';
import { View, Text, ViewStyle, TextStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export type PillTone = 'neutral' | 'accent' | 'known' | 'learning';

const styles = StyleSheet.create((theme) => ({
  base: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, alignSelf: 'flex-start' } satisfies ViewStyle,
  text: { fontFamily: 'Inter-Medium', fontSize: 12, fontWeight: '500', letterSpacing: 0.12 } satisfies TextStyle,
  neutralBg:  { backgroundColor: `${theme.ink}0F` },
  neutralFg:  { color: theme.ink2 },
  accentBg:   { backgroundColor: theme.accentSoft },
  accentFg:   { color: theme.accent },
  knownBg:    { backgroundColor: theme.knownSoft },
  knownFg:    { color: theme.known },
  learningBg: { backgroundColor: theme.learningSoft },
  learningFg: { color: theme.learning },
}));

export const Pill: React.FC<{ tone?: PillTone; icon?: React.ReactNode; children: React.ReactNode }> = ({ tone = 'neutral', icon, children }) => {
  const bg = (styles as any)[`${tone}Bg`];
  const fg = (styles as any)[`${tone}Fg`];
  return (
    <View style={[styles.base, bg]}>
      {icon}
      <Text style={[styles.text, fg]}>{children}</Text>
    </View>
  );
};
