// Квадратная иконка-кнопка 36x36 с вариантами solid / accent.
// theme.* читается inline через useUnistyles() — иначе закэшированный
// StyleSheet.create не подхватывает смену темы (см. PhoneShell.tsx).
import React from 'react';
import { Pressable, ViewStyle, StyleSheet as RN } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { HIT_SLOP_DEFAULT } from '@/utils/constants';

interface Props {
  onPress: () => void;
  solid?: boolean;
  accent?: boolean;
  children: React.ReactNode;
  accessibilityLabel?: string;
}

const staticStyles = RN.create({
  base: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' } satisfies ViewStyle,
  pressed: { opacity: 0.6 } satisfies ViewStyle,
});

export const IconBtn: React.FC<Props> = ({ onPress, solid = false, accent = false, children, accessibilityLabel }) => {
  const { theme } = useUnistyles();
  const bg: ViewStyle = accent
    ? { backgroundColor: theme.accent }
    : solid
    ? { backgroundColor: theme.ink }
    : { backgroundColor: `${theme.ink}0F` };
  return (
    <Pressable
      onPress={onPress}
      hitSlop={HIT_SLOP_DEFAULT}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        staticStyles.base,
        bg,
        pressed && staticStyles.pressed,
      ]}
    >
      {children}
    </Pressable>
  );
};
