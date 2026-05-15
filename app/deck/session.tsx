// Flashcards session — fullScreenModal (см. presentation в app/_layout.tsx).
// Stub до sub-project #6 (SRS).
import React from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { PhoneShell, IconBtn, Headline } from '@/components/ui';
import { IcClose } from '@/components/icons';

const styles = StyleSheet.create(() => ({
  top: { flexDirection: 'row', justifyContent: 'space-between', padding: 22 },
  content: { padding: 22, alignItems: 'center', gap: 8 },
}));

export default function DeckSession() {
  const router = useRouter();
  return (
    <PhoneShell>
      <View style={styles.top}>
        <IconBtn onPress={() => router.back()} accessibilityLabel="Close">
          <IcClose size={18} />
        </IconBtn>
      </View>
      <View style={styles.content}>
        <Headline level={2}>Flashcards session</Headline>
        <Text>Sub-project #6 — SRS implementation.</Text>
      </View>
    </PhoneShell>
  );
}
