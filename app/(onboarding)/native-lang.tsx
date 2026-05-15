// Шаг 3 онбординга — выбор родного языка. Завершение: ставим
// onboardingCompleted и уводим в /(tabs). Stub до sub-project #8.
import React from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native-unistyles';
import { PhoneShell, Headline, SectionLabel, Button } from '@/components/ui';
import { useSettingsStore } from '@/stores/settingsStore';

const styles = StyleSheet.create((theme) => ({
  content: { flex: 1, padding: 22, justifyContent: 'space-between' },
  inner: { gap: 12 },
  hint: {
    color: theme.ink2,
    fontFamily: 'SourceSerif4-Regular',
    fontSize: 16,
    marginTop: 6,
  },
}));

export default function OnboardingStep3() {
  const { t } = useTranslation();
  const router = useRouter();
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);

  const onFinish = () => {
    completeOnboarding();
    router.replace('/(tabs)');
  };

  return (
    <PhoneShell>
      <View style={styles.content}>
        <View style={styles.inner}>
          <SectionLabel>Step 3 / 3</SectionLabel>
          <Headline level={1}>{t('onboarding.step3.title')}</Headline>
          <Text style={styles.hint}>
            Stub — native-lang picker в #8. Press Finish to enter app.
          </Text>
        </View>
        <Button block onPress={onFinish}>
          Finish
        </Button>
      </View>
    </PhoneShell>
  );
}
