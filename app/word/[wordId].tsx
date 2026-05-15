// Word modal — transparentModal (см. presentation в app/_layout.tsx).
// Stub до sub-project #6 (Word card / deck management).
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';

const styles = StyleSheet.create((theme) => ({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.15)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: theme.paper,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    minHeight: 220,
  },
  word: { fontFamily: 'SourceSerif4-Medium', fontSize: 30, color: theme.ink },
  hint: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: theme.ink2,
    marginTop: 10,
  },
}));

export default function WordModal() {
  const router = useRouter();
  const { wordId } = useLocalSearchParams<{ wordId: string }>();
  return (
    <Pressable style={styles.overlay} onPress={() => router.back()}>
      <View style={styles.card}>
        <Text style={styles.word}>{wordId}</Text>
        <Text style={styles.hint}>Word card detail — sub-project #6.</Text>
      </View>
    </Pressable>
  );
}
