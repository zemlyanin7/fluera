// 4-табовый Tabs layout, использует кастомный TabBar (blur, floating).
// Гард (C4): если онбординг ещё НЕ пройден, отправляем декларативным
// <Redirect/> на (onboarding) ДО рендера Tabs.
import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { TabBar } from '@/components/ui/TabBar';
import { useSettingsStore } from '@/stores/settingsStore';

export default function TabsLayout() {
  const onboardingCompleted = useSettingsStore((s) => s.onboardingCompleted);
  if (!onboardingCompleted) return <Redirect href="/(onboarding)" />;
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(p) => <TabBar {...p} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="deck" />
      <Tabs.Screen name="stats" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
