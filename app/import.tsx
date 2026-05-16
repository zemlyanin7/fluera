// Import — modal с document picker + ImportPipeline.
// EPUB/FB2 → books/{id}/ + DB records → reader-screen.
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { PhoneShell, IconBtn, Headline } from '@/components/ui';
import { IcChevronLeft } from '@/components/icons';
import { useDatabase } from '@/db/DatabaseContext';
import { ImportPipeline } from '@/services/import/ImportPipeline';
import { createDefaultParserRegistry } from '@/services/parser';

interface DevSeed {
  name: string;
  uri: string;
}

export default function ImportModal() {
  const router = useRouter();
  const { theme } = useUnistyles();
  const db = useDatabase();
  const [busy, setBusy] = useState(false);
  const [devSeeds, setDevSeeds] = useState<DevSeed[]>([]);

  // __DEV__: показать список файлов из Documents/_seed/ для быстрого smoke
  // без document picker. Файлы кладёт dev через `xcrun simctl` или drag-drop.
  useEffect(() => {
    if (!__DEV__) return;
    (async () => {
      try {
        const seedDir = `${FileSystem.documentDirectory}_seed/`;
        const info = await FileSystem.getInfoAsync(seedDir);
        if (!info.exists) return;
        const files = await FileSystem.readDirectoryAsync(seedDir);
        setDevSeeds(
          files
            .filter((f) => /\.(epub|fb2)$/i.test(f))
            .map((f) => ({ name: f, uri: `${seedDir}${f}` })),
        );
      } catch {
        // dev-only — silent
      }
    })();
  }, []);

  const importFromUri = async (uri: string, name: string, size: number): Promise<void> => {
    setBusy(true);
    try {
      const pipeline = new ImportPipeline(db, createDefaultParserRegistry());
      const result = await pipeline.import({ uri, name, size });
      router.dismiss();
      router.push(`/reader/${result.bookId}`);
    } catch (err) {
      Alert.alert('Ошибка импорта', (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onSeed = async (seed: DevSeed) => {
    try {
      const info = await FileSystem.getInfoAsync(seed.uri);
      const size = info.exists && 'size' in info ? (info.size as number) : 0;
      await importFromUri(seed.uri, seed.name, size);
    } catch (err) {
      Alert.alert('Ошибка импорта', (err as Error).message);
    }
  };

  const onPick = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/epub+zip', 'application/x-fictionbook+xml', '*/*'],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    await importFromUri(asset.uri, asset.name, asset.size ?? 0);
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

        {__DEV__ && devSeeds.length > 0 && (
          <View style={{ marginTop: 24, gap: 8, alignSelf: 'stretch' }}>
            <Text style={{ color: theme.ink3, textAlign: 'center', fontSize: 12 }}>
              Dev seed (Documents/_seed/)
            </Text>
            {devSeeds.map((s) => (
              <Pressable
                key={s.uri}
                accessibilityLabel={`Import dev seed ${s.name}`}
                onPress={() => onSeed(s)}
                disabled={busy}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 10,
                  backgroundColor: theme.paper2,
                  opacity: busy ? 0.5 : 1,
                }}
              >
                <Text style={{ color: theme.ink, textAlign: 'center' }}>{s.name}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </PhoneShell>
  );
}
