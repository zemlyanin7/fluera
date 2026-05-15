// Layout 3-шагового онбординга — без хедера, переходы по умолчанию.
import React from 'react';
import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
