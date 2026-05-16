// Корневая обёртка экрана с учётом SafeArea-инсета сверху.
// useUnistyles() — явная React-подписка на смену темы, чтобы PhoneShell
// перерисовывался при UnistylesRuntime.setTheme() (auto-update через
// babel-плагин ShadowTree-биндинга для app/* файлов работает нестабильно).
import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

const styles = StyleSheet.create((theme) => ({
  shell: { flex: 1, backgroundColor: theme.paper } satisfies ViewStyle,
}));

export const PhoneShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useUnistyles();
  const insets = useSafeAreaInsets();
  return <View style={[styles.shell, { paddingTop: insets.top }]}>{children}</View>;
};
