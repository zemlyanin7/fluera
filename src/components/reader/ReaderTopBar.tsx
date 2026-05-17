import React from 'react';
import { View, Text } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { IconBtn } from '@/components/ui';
import { IcChevronLeft, IcFontSize, IcLibrary } from '@/components/icons';

interface Props {
  chapterIndex: number;
  chapterTitle: string | null;
  onBack: () => void;
  onOpenSettings: () => void;
  onOpenToc: () => void;
}

export const ReaderTopBar = React.memo(function ReaderTopBar(props: Props) {
  const { theme } = useUnistyles();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 18,
        paddingVertical: 8,
        gap: 8,
      }}
    >
      <IconBtn onPress={props.onBack} accessibilityLabel="Back">
        <IcChevronLeft size={18} />
      </IconBtn>
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{
            textAlign: 'center',
            fontFamily: 'Inter-SemiBold',
            fontSize: 13,
            color: theme.ink,
          }}
        >
          Ch. {props.chapterIndex + 1}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            textAlign: 'center',
            fontFamily: 'SourceSerif4-Italic',
            fontStyle: 'italic',
            fontSize: 12,
            color: theme.ink3,
          }}
        >
          {props.chapterTitle ?? ''}
        </Text>
      </View>
      <IconBtn onPress={props.onOpenToc} accessibilityLabel="Table of contents">
        <IcLibrary size={18} />
      </IconBtn>
      <IconBtn onPress={props.onOpenSettings} accessibilityLabel="Settings">
        <IcFontSize size={18} />
      </IconBtn>
    </View>
  );
});
