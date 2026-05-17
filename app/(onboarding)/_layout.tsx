// Layout 3-шагового онбординга — без хедера, переходы по умолчанию.
// Гард (C4): если онбординг уже пройден, отправляем декларативным
// <Redirect/> в (tabs) ДО рендера Stack (чтобы не было визуальной вспышки).
import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useSettingsStore } from '@/stores/settingsStore';

export default function OnboardingLayout() {
  const onboardingCompleted = useSettingsStore((s) => s.onboardingCompleted);
  if (onboardingCompleted) return <Redirect href="/(tabs)" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
