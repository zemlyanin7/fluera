// Import — modal с document picker + ImportPipeline.
// EPUB/FB2 → books/{id}/ + DB records → reader-screen.
import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';
import * as DocumentPicker from 'expo-document-picker';
import { PhoneShell, IconBtn, Headline } from '@/components/ui';
import { IcChevronLeft } from '@/components/icons';
import { useDatabase } from '@/db/DatabaseContext';
import { ImportPipeline } from '@/services/import/ImportPipeline';
import { createDefaultParserRegistry } from '@/services/parser';

export default function ImportModal() {
  const router = useRouter();
  const { theme } = useUnistyles();
  const db = useDatabase();
  const [busy, setBusy] = useState(false);

  const onPick = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/epub+zip', 'application/x-fictionbook+xml', '*/*'],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    setBusy(true);
    try {
      const pipeline = new ImportPipeline(db, createDefaultParserRegistry());
      const result = await pipeline.import({
        uri: asset.uri,
        name: asset.name,
        size: asset.size ?? 0,
        mimeType: asset.mimeType,
      });
      router.dismiss();
      router.push(`/reader/${result.bookId}`);
    } catch (err) {
      Alert.alert('Ошибка импорта', (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PhoneShell>
      <View
        style={{ flexDirection: 'row', alignItems: 'center', padding: 22, gap: 12 }}
      >
        <IconBtn onPress={() => router.back()} accessibilityLabel="Back">
          <IcChevronLeft size={18} />
        </IconBtn>
        <Headline level={3}>Add a book</Headline>
      </View>
      <View
        style={{
          flex: 1,
          padding: 28,
          justifyContent: 'center',
          alignItems: 'center',
          gap: 18,
        }}
      >
        <Text style={{ color: theme.ink2, textAlign: 'center' }}>
          EPUB or FB2 from device
        </Text>
        <Pressable
          onPress={onPick}
          accessibilityLabel="Pick a file"
          disabled={busy}
          style={{
            paddingHorizontal: 24,
            paddingVertical: 14,
            borderRadius: 14,
            backgroundColor: theme.accent,
            opacity: busy ? 0.5 : 1,
          }}
        >
          {busy ? (
            <ActivityIndicator color={theme.paper} />
          ) : (
            <Text
              style={{
                color: theme.paper,
                fontFamily: 'Inter-SemiBold',
                fontSize: 16,
              }}
            >
              Choose file
            </Text>
          )}
        </Pressable>
      </View>
    </PhoneShell>
  );
}
