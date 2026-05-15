// Корневая обёртка экрана с учётом SafeArea-инсета сверху
import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

const styles = StyleSheet.create((theme) => ({
  shell: { flex: 1, backgroundColor: theme.paper } satisfies ViewStyle,
}));

export const PhoneShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const insets = useSafeAreaInsets();
  return <View style={[styles.shell, { paddingTop: insets.top }]}>{children}</View>;
};
