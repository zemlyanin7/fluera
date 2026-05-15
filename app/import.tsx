// Import — modal (см. presentation в app/_layout.tsx).
// Stub до sub-project #3 (EPUB/FB2 import).
import React from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { PhoneShell, IconBtn, Headline } from '@/components/ui';
import { IcChevronLeft } from '@/components/icons';

const styles = StyleSheet.create(() => ({
  top: { flexDirection: 'row', alignItems: 'center', padding: 22, gap: 12 },
  content: { padding: 22, gap: 8 },
}));

export default function ImportModal() {
  const router = useRouter();
  return (
    <PhoneShell>
      <View style={styles.top}>
        <IconBtn onPress={() => router.back()} accessibilityLabel="Back">
          <IcChevronLeft size={18} />
        </IconBtn>
        <Headline level={3}>Add a book</Headline>
      </View>
      <View style={styles.content}>
        <Text>EPUB/FB2 import — sub-project #3.</Text>
      </View>
    </PhoneShell>
  );
}
