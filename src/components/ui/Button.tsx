// Кнопка: варианты primary / accent / ghost, опциональный block-режим и иконка
import React from 'react';
import { Pressable, Text, ViewStyle, TextStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export type ButtonVariant = 'primary' | 'accent' | 'ghost';

interface Props {
  variant?: ButtonVariant;
  block?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  onPress: () => void;
  children: React.ReactNode;
}

const styles = StyleSheet.create((theme) => ({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 18 } satisfies ViewStyle,
  block: { width: '100%', paddingVertical: 16 } satisfies ViewStyle,
  text: { fontFamily: 'Inter-SemiBold', fontSize: 15, fontWeight: '600', letterSpacing: -0.15 } satisfies TextStyle,
  blockText: { fontSize: 16 } satisfies TextStyle,
  primaryBg:   { backgroundColor: theme.ink },
  primaryText: { color: theme.paper },
  accentBg:    { backgroundColor: theme.accent },
  accentText:  { color: '#FFFFFF' },
  ghostBg:     { backgroundColor: 'transparent', borderWidth: 1, borderColor: `${theme.ink}26` } satisfies ViewStyle,
  ghostText:   { color: theme.ink },
  pressed:  { opacity: 0.7 },
  disabled: { opacity: 0.4 },
}));

export const Button: React.FC<Props> = ({
  variant = 'primary', block = false, disabled = false, icon, onPress, children,
}) => {
  // C5: явный switch, чтобы НЕ терять Unistyles-типизацию через `(styles as any)`.
  const bg =
    variant === 'primary' ? styles.primaryBg
    : variant === 'accent' ? styles.accentBg
    : styles.ghostBg;
  const fg =
    variant === 'primary' ? styles.primaryText
    : variant === 'accent' ? styles.accentText
    : styles.ghostText;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base, bg,
        block && styles.block,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {icon}
      <Text style={[styles.text, fg, block && styles.blockText]}>{children}</Text>
    </Pressable>
  );
};
