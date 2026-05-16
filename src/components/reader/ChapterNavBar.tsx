import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

interface Props {
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}

export const ChapterNavBar = React.memo(function ChapterNavBar(props: Props) {
  const { theme } = useUnistyles();
  const prevDisabled = props.index <= 0;
  const nextDisabled = props.index >= props.total - 1;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: theme.accentLine,
      }}
    >
      <Pressable
        accessibilityLabel="Previous chapter"
        onPress={prevDisabled ? undefined : props.onPrev}
        style={{ opacity: prevDisabled ? 0.3 : 1, padding: 10 }}
      >
        <Text style={{ color: theme.ink }}>‹ Prev</Text>
      </Pressable>
      <Text style={{ color: theme.ink2 }}>
        {props.index + 1} / {props.total}
      </Text>
      <Pressable
        accessibilityLabel="Next chapter"
        onPress={nextDisabled ? undefined : props.onNext}
        style={{ opacity: nextDisabled ? 0.3 : 1, padding: 10 }}
      >
        <Text style={{ color: theme.ink }}>Next ›</Text>
      </Pressable>
    </View>
  );
});
