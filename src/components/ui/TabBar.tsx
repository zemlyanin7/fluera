// Docked 4-табовый таб-бар — кастомный tabBar для @react-navigation/bottom-tabs.
// Прижат к низу, paper bg, hairline-разделитель сверху, padding под home-indicator.
//
// ВАЖНО: theme.* читается inline через useUnistyles().theme, а не через
// закэшированный StyleSheet.create((theme) => ...). Причина: native ShadowTree
// react-native-unistyles 3.x не обновляет закэшированные style-объекты при
// смене темы (issue #1179) — TabBar bg оставался cream на dark.
// Inline-чтение гарантирует свежее значение на каждом re-render.
import React from 'react';
import { Pressable, Text, View, ViewStyle, TextStyle, StyleSheet as RN } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
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

// Не-theme-зависимые стили оставляем в обычном RN.StyleSheet — менять надо
// ТОЛЬКО theme-зависимые свойства (color/backgroundColor/borderColor).
const staticStyles = RN.create({
  container: {
    height: 60,
    overflow: 'hidden',
    borderTopWidth: RN.hairlineWidth,
  } satisfies ViewStyle,
  row: { flex: 1, flexDirection: 'row', paddingHorizontal: 6 } satisfies ViewStyle,
  tab: {
    flex: 1, flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: 2, paddingVertical: 6, borderRadius: 14,
  } satisfies ViewStyle,
  label: {
    fontFamily: 'Inter-SemiBold', fontSize: 10, fontWeight: '600',
    letterSpacing: 0.2,
  } satisfies TextStyle,
  dot: { width: 4, height: 4, borderRadius: 99, backgroundColor: 'transparent', marginTop: 2 } satisfies ViewStyle,
});

export const TabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  return (
    <View style={[staticStyles.container, { borderTopColor: theme.ink3, backgroundColor: theme.paper }]}>
      <View style={staticStyles.row}>
        {state.routes.map((route, index) => {
          const meta = TAB_META[route.name];
          if (!meta) return null;
          const isActive = state.index === index;
          const onPress = () => {
            const ev = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isActive && !ev.defaultPrevented) navigation.navigate(route.name);
          };
          return (
            <Pressable key={route.key} onPress={onPress} style={staticStyles.tab}>
              <meta.Ic size={20} color={isActive ? theme.ink : theme.ink3} />
              <Text style={[staticStyles.label, { color: isActive ? theme.ink : theme.ink3 }]}>
                {t(meta.i18nKey)}
              </Text>
              <View style={[staticStyles.dot, isActive && { backgroundColor: theme.accent }]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};
