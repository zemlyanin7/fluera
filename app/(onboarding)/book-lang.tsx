// Шаг 2 онбординга — выбор языка читаемой книги. Stub до sub-project #8.
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

export default function OnboardingStep2() {
  const { t } = useTranslation();
  return (
    <PhoneShell>
      <View style={styles.content}>
        <View style={styles.inner}>
          <SectionLabel>Step 2 / 3</SectionLabel>
          <Headline level={1}>{t('onboarding.step2.title')}</Headline>
          <Text style={styles.hint}>Stub — book-lang picker реализуется в #8.</Text>
        </View>
        <Link href="/(onboarding)/native-lang" asChild>
          <Button block onPress={() => {}}>
            {t('common.continue')}
          </Button>
        </Link>
      </View>
    </PhoneShell>
  );
}
