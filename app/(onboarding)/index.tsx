// Шаг 1 онбординга — stub. Финальный UI-lang picker появится в sub-project #8.
import React from 'react';
import { View, Text } from 'react-native';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native-unistyles';
import { PhoneShell, Headline, SectionLabel, Button } from '@/components/ui';

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

export default function OnboardingStep1() {
  const { t } = useTranslation();
  return (
    <PhoneShell>
      <View style={styles.content}>
        <View style={styles.inner}>
          <SectionLabel>Step 1 / 3</SectionLabel>
          <Headline level={1}>{t('onboarding.step1.title')}</Headline>
          <Text style={styles.hint}>Stub — финальный UI-lang picker в #8.</Text>
        </View>
        <Link href="/(onboarding)/book-lang" asChild>
          <Button block onPress={() => {}}>
            {t('common.continue')}
          </Button>
        </Link>
      </View>
    </PhoneShell>
  );
}
