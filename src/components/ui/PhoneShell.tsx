// Корневая обёртка экрана с учётом SafeArea-инсета сверху.
//
// ВАЖНО: backgroundColor читается inline через useUnistyles().theme, а не
// через закэшированный StyleSheet.create((theme) => ({backgroundColor: theme.paper})).
// Причина: StyleSheet-объект создаётся один раз при загрузке модуля и кэшируется.
// При смене темы прокси-резолв backgroundColor может вернуть stale-значение
// (one-step-behind) — стандартный паттерн с react-native-unistyles 3.x + ShadowTree.
// Inline-чтение theme.paper из useUnistyles() гарантирует свежее значение
// на каждом re-render.
import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUnistyles } from 'react-native-unistyles';

const baseShell: ViewStyle = { flex: 1 };

export const PhoneShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  return (
    <View style={[baseShell, { backgroundColor: theme.paper, paddingTop: insets.top }]}>
      {children}
    </View>
  );
};
