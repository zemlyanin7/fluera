// Deck stub. SRS flashcards — sub-project #6.
import React from 'react';
import { View, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { PhoneShell, Headline, SectionLabel } from '@/components/ui';

const styles = StyleSheet.create((theme) => ({
  content: { padding: 22, gap: 8 },
  hint: {
    color: theme.ink2,
    fontFamily: 'SourceSerif4-Regular',
    fontSize: 16,
    marginTop: 6,
  },
}));

export default function DeckScreen() {
  return (
    <PhoneShell>
      <View style={styles.content}>
        <SectionLabel>Foundation stub</SectionLabel>
        <Headline level={1}>Deck</Headline>
        <Text style={styles.hint}>SRS flashcards — sub-project #6.</Text>
      </View>
    </PhoneShell>
  );
}
