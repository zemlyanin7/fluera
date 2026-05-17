// Dev-only песочница: в production билдах редиректится на /(tabs).
import React from 'react';
import { Stack, Redirect } from 'expo-router';

export default function PlaygroundLayout() {
  if (!__DEV__) return <Redirect href="/(tabs)" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
