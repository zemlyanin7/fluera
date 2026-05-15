// Корневой layout: монтирует bridge Settings → Unistyles, инициализирует i18n
// (через side-effect import), скрывает splash после первого useEffect и
// разводит навигацию по флагу onboardingCompleted.
import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';

import '@/theme'; // side-effect: StyleSheet.configure
import { attachThemeBridge } from '@/theme/bridge';
import { useSettingsStore } from '@/stores/settingsStore';
import '@/i18n'; // side-effect: i18next init

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const onboardingCompleted = useSettingsStore((s) => s.onboardingCompleted);

  useEffect(() => {
    const unsubscribe = attachThemeBridge();
    void SplashScreen.hideAsync();
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (onboardingCompleted) router.replace('/(tabs)');
    else router.replace('/(onboarding)');
  }, [onboardingCompleted, router]);

  return (
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(playground)" />
          <Stack.Screen name="reader/[bookId]" />
          <Stack.Screen
            name="word/[wordId]"
            options={{ presentation: 'transparentModal', animation: 'fade' }}
          />
          <Stack.Screen
            name="deck/session"
            options={{ presentation: 'fullScreenModal' }}
          />
          <Stack.Screen name="import" options={{ presentation: 'modal' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
