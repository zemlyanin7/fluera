// Плавающий 4-табовый таб-бар с blur-фоном — кастомный tabBar для @react-navigation/bottom-tabs
import React from 'react';
import { Pressable, Text, View, ViewStyle, TextStyle, Platform, StyleSheet as RN } from 'react-native';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native-unistyles';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { IcBook, IcCards, IcGraph, IcSettings } from '@/components/icons';

const TAB_META: Record<string, { label: string; Ic: React.FC<{ size?: number; color?: string }> }> = {
  index:    { label: 'READ',  Ic: IcBook },
  deck:     { label: 'DECK',  Ic: IcCards },
  stats:    { label: 'STATS', Ic: IcGraph },
  settings: { label: 'YOU',   Ic: IcSettings },
};

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    position: 'absolute',
    left: 14, right: 14,
    bottom: 18 + rt.insets.bottom,
    height: 60,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  } satisfies ViewStyle,
  blurBg: {
    ...RN.absoluteFillObject,
    backgroundColor: `${theme.paper}E0`,
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

export const TabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => (
  <View style={styles.container}>
    <BlurView
      intensity={80}
      tint="default"
      experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'}
      style={RN.absoluteFillObject}
    />
    <View style={styles.blurBg} />
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
            <Text style={[styles.label, isActive && styles.labelActive]}>{meta.label}</Text>
            <View style={[styles.dot, isActive && styles.dotActive]} />
          </Pressable>
        );
      })}
    </View>
  </View>
);
