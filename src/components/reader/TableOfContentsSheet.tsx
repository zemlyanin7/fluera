import React, { forwardRef } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { Sheet, type SheetRef, Headline } from '@/components/ui';

interface ChapterEntry {
  index: number;
  title: string | null;
}

interface Props {
  chapters: ChapterEntry[];
  currentChapterIndex: number;
  onPickChapter: (index: number) => void;
}

const SNAP: (string | number)[] = ['80%'];

export const TableOfContentsSheet = forwardRef<SheetRef, Props>(function TableOfContentsSheet(
  { chapters, currentChapterIndex, onPickChapter },
  ref,
) {
  const { theme } = useUnistyles();
  return (
    <Sheet ref={ref} snapPoints={SNAP}>
      <View style={{ padding: 18 }}>
        <Headline level={2}>Contents</Headline>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }}>
        {chapters.map((ch) => {
          const active = ch.index === currentChapterIndex;
          return (
            <Pressable
              key={ch.index}
              onPress={() => onPickChapter(ch.index)}
              accessibilityLabel={`Jump to chapter ${ch.index + 1}`}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 10,
                marginBottom: 6,
                backgroundColor: active ? theme.accentSoft : 'transparent',
              }}
            >
              <Text
                style={{
                  color: active ? theme.accent : theme.ink,
                  fontFamily: active ? 'Inter-SemiBold' : 'Inter-Regular',
                  fontSize: 15,
                }}
              >
                {ch.index + 1}. {ch.title ?? `Chapter ${ch.index + 1}`}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </Sheet>
  );
});
