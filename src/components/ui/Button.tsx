// Кнопка: варианты primary / accent / ghost, опциональный block-режим и иконка.
// theme.* читается inline через useUnistyles() — иначе закэшированный
// StyleSheet.create не подхватывает смену темы (см. PhoneShell.tsx).
import React from 'react';
import { Pressable, Text, ViewStyle, TextStyle, StyleSheet as RN } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

export type ButtonVariant = 'primary' | 'accent' | 'ghost';

interface Props {
  variant?: ButtonVariant;
  block?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  onPress: () => void;
  children: React.ReactNode;
}

const staticStyles = RN.create({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 18 } satisfies ViewStyle,
  block: { width: '100%', paddingVertical: 16 } satisfies ViewStyle,
  text: { fontFamily: 'Inter-SemiBold', fontSize: 15, fontWeight: '600', letterSpacing: -0.15 } satisfies TextStyle,
  blockText: { fontSize: 16 } satisfies TextStyle,
  ghostBase: { borderWidth: 1 } satisfies ViewStyle,
  pressed:  { opacity: 0.7 } satisfies ViewStyle,
  disabled: { opacity: 0.4 } satisfies ViewStyle,
});

export const Button: React.FC<Props> = ({
  variant = 'primary', block = false, disabled = false, icon, onPress, children,
}) => {
  const { theme } = useUnistyles();
  // C5: явный switch, чтобы НЕ терять типизацию через `(styles as any)`.
  const bg: ViewStyle =
    variant === 'primary' ? { backgroundColor: theme.ink }
    : variant === 'accent' ? { backgroundColor: theme.accent }
    : { ...staticStyles.ghostBase, backgroundColor: 'transparent', borderColor: `${theme.ink}26` };
  const fg: TextStyle =
    variant === 'primary' ? { color: theme.paper }
    : variant === 'accent' ? { color: '#FFFFFF' }
    : { color: theme.ink };
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        staticStyles.base, bg,
        block && staticStyles.block,
        pressed && staticStyles.pressed,
        disabled && staticStyles.disabled,
      ]}
    >
      {icon}
      <Text style={[staticStyles.text, fg, block && staticStyles.blockText]}>{children}</Text>
    </Pressable>
  );
};
