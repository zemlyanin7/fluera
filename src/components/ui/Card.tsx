// Контейнер-карточка с закруглением и полупрозрачным фоном.
// theme.ink читается inline через useUnistyles() — иначе закэшированный
// StyleSheet.create не подхватывает смену темы (см. PhoneShell.tsx).
import React from 'react';
import { View, StyleProp, ViewStyle, StyleSheet as RN } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

const staticStyles = RN.create({
  card: { borderRadius: 18 } satisfies ViewStyle,
});

interface Props { children: React.ReactNode; padding?: number; style?: StyleProp<ViewStyle>; }
export const Card: React.FC<Props> = ({ children, padding = 16, style }) => {
  const { theme } = useUnistyles();
  return (
    <View style={[staticStyles.card, { backgroundColor: `${theme.ink}0A`, padding }, style]}>
      {children}
    </View>
  );
};
