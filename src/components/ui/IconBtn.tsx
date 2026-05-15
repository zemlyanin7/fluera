// Квадратная иконка-кнопка 36x36 с вариантами solid / accent
import React from 'react';
import { Pressable, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { HIT_SLOP_DEFAULT } from '@/utils/constants';

interface Props {
  onPress: () => void;
  solid?: boolean;
  accent?: boolean;
  children: React.ReactNode;
  accessibilityLabel?: string;
}

const styles = StyleSheet.create((theme) => ({
  base: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: `${theme.ink}0F` } satisfies ViewStyle,
  solid:  { backgroundColor: theme.ink },
  accent: { backgroundColor: theme.accent },
  pressed: { opacity: 0.6 },
}));

export const IconBtn: React.FC<Props> = ({ onPress, solid = false, accent = false, children, accessibilityLabel }) => (
  <Pressable
    onPress={onPress}
    hitSlop={HIT_SLOP_DEFAULT}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    style={({ pressed }) => [
      styles.base,
      solid && styles.solid,
      accent && styles.accent,
      pressed && styles.pressed,
    ]}
  >
    {children}
  </Pressable>
);
