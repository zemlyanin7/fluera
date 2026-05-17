// Корневой роут "/" — точка разводки навигации. Декларативный <Redirect/>
// (C4): рендерится до Stack-перехода, поэтому НЕТ flash вкладок перед
// онбордингом. Когда completeOnboarding() выставит флаг, Zustand-подписка
// обновит компонент и Redirect уведёт нас в /(tabs).
import React from 'react';
import { Redirect } from 'expo-router';
import { useSettingsStore } from '@/stores/settingsStore';

export default function Index() {
  const onboardingCompleted = useSettingsStore((s) => s.onboardingCompleted);
  return <Redirect href={onboardingCompleted ? '/(tabs)' : '/(onboarding)'} />;
}
