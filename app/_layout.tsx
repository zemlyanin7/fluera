// Корневой layout: монтирует bridge Settings → Unistyles, инициализирует i18n
// (через side-effect import + i18nReady promise) и разводит навигацию по флагу
// onboardingCompleted декларативным <Redirect/>, чтобы не было flash (tabs)
// перед onboarding.
import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';

import '@/theme'; // side-effect: StyleSheet.configure
import { attachThemeBridge } from '@/theme/bridge';
import { i18nReady } from '@/i18n'; // I4: ждём готовности i18n до hideAsync

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // ВАЖНО: НЕ читаем onboardingCompleted на корневом layout, чтобы Stack не
  // ремонтировался при completeOnboarding(). Разводку делает <_layout> внутри
  // отдельных групп через Redirect (см. (onboarding)/_layout, (tabs)/_layout).
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsubscribe = attachThemeBridge();
    // I4: дождёмся i18n, потом снимаем splash. До этого момента Stack не
    // монтируется (см. ниже `if (!ready) return null`).
    void i18nReady.then(() => {
      setReady(true);
      void SplashScreen.hideAsync();
    });
    return unsubscribe;
  }, []);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
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
