// Docked 4-табовый таб-бар — кастомный tabBar для @react-navigation/bottom-tabs.
// Прижат к низу, paper bg, hairline-разделитель сверху, padding под home-indicator.
import React from 'react';
import { Pressable, Text, View, ViewStyle, TextStyle, StyleSheet as RN } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { IcBook, IcCards, IcGraph, IcSettings } from '@/components/icons';

// Маршрут → ключ перевода + иконка. Лейблы берутся через t() (I8).
const TAB_META: Record<string, { i18nKey: string; Ic: React.FC<{ size?: number; color?: string }> }> = {
  index:    { i18nKey: 'tabs.read',  Ic: IcBook },
  deck:     { i18nKey: 'tabs.deck',  Ic: IcCards },
  stats:    { i18nKey: 'tabs.stats', Ic: IcGraph },
  settings: { i18nKey: 'tabs.you',   Ic: IcSettings },
};

const styles = StyleSheet.create((theme) => ({
  // Docked variant: TabBar прижат к низу. Safe-area под home-indicator управляется
  // навигационным контейнером Tabs (react-navigation сам прибавляет insets.bottom).
  container: {
    height: 60,
    overflow: 'hidden',
    borderTopWidth: RN.hairlineWidth,
    borderTopColor: theme.ink3,
    backgroundColor: theme.paper,
  } satisfies ViewStyle,
  row: { flex: 1, flexDirection: 'row', paddingHorizontal: 6 } satisfies ViewStyle,
  tab: {
    flex: 1, flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: 2, paddingVertical: 6, borderRadius: 14,
  } satisfies ViewStyle,
  label: {
    fontFamily: 'Inter-SemiBold', fontSize: 10, fontWeight: '600',
    letterSpacing: 0.2, color: theme.ink3,
  } satisfies TextStyle,
  labelActive: { color: theme.ink },
  dot: { width: 4, height: 4, borderRadius: 99, backgroundColor: 'transparent', marginTop: 2 } satisfies ViewStyle,
  dotActive: { backgroundColor: theme.accent },
}));

export const TabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const meta = TAB_META[route.name];
          if (!meta) return null;
          const isActive = state.index === index;
          const onPress = () => {
            const ev = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isActive && !ev.defaultPrevented) navigation.navigate(route.name);
          };
          return (
            <Pressable key={route.key} onPress={onPress} style={styles.tab}>
              <meta.Ic size={20} />
              <Text style={[styles.label, isActive && styles.labelActive]}>
                {t(meta.i18nKey)}
              </Text>
              <View style={[styles.dot, isActive && styles.dotActive]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};
