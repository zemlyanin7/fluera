// 4-табовый Tabs layout, использует кастомный TabBar (blur, floating).
import React from 'react';
import { Tabs } from 'expo-router';
import { TabBar } from '@/components/ui/TabBar';

export default function TabsLayout() {
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
