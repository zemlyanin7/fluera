// Корневой layout. Hydration gate: splash виден пока не готовы ВСЕ три:
//   1. i18nReady — переводы загружены (Foundation)
//   2. settingsHydrated — AsyncStorage persist прочитан (Phase 7 #2)
//   3. DatabaseProvider — WatermelonDB SQLite инициализирован (Phase 7 #2)
// Без всех трёх ничего не показываем — иначе theme/lang flash при cold-start.
import React, { useCallback, useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';

import '@/theme'; // side-effect: StyleSheet.configure
import { attachThemeBridge } from '@/theme/bridge';
import { i18nReady } from '@/i18n';
import { useSettingsStore } from '@/stores/settingsStore';
import { DatabaseProvider } from '@/db/DatabaseContext';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Не читаем onboardingCompleted здесь — разводит (onboarding|tabs)/_layout.
  const [preReady, setPreReady] = useState(false);
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    const unsubscribe = attachThemeBridge();
    const settingsHydrated = useSettingsStore.persist.hasHydrated()
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          const off = useSettingsStore.persist.onFinishHydration(() => {
            off();
            resolve();
          });
        });
    void Promise.all([i18nReady, settingsHydrated]).then(() => setPreReady(true));
    return unsubscribe;
  }, []);

  // SplashScreen.hideAsync только когда И preReady, И dbReady — оба условия.
  const onDbReady = useCallback(() => {
    setDbReady(true);
  }, []);

  useEffect(() => {
    if (preReady && dbReady) {
      void SplashScreen.hideAsync();
    }
  }, [preReady, dbReady]);

  if (!preReady) return null;

  return (
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <DatabaseProvider onReady={onDbReady} fallback={null}>
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
        </DatabaseProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
