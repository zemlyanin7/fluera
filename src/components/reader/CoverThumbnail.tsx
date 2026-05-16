import React from 'react';
import { View, Image, Text } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

interface Props {
  coverPath: string | null;
  title: string;
  width?: number;
  height?: number;
}

export const CoverThumbnail = React.memo(function CoverThumbnail({
  coverPath,
  title,
  width = 60,
  height = 90,
}: Props) {
  const { theme } = useUnistyles();
  if (coverPath) {
    return (
      <Image
        source={{ uri: coverPath }}
        style={{ width, height, borderRadius: 6 }}
        resizeMode="cover"
        accessibilityLabel={`Cover for ${title}`}
      />
    );
  }
  const letter = title[0]?.toUpperCase() ?? '?';
  return (
    <View
      style={{
        width,
        height,
        borderRadius: 6,
        backgroundColor: theme.paper2,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text style={{ color: theme.ink, fontFamily: 'Inter-SemiBold', fontSize: 24 }}>
        {letter}
      </Text>
    </View>
  );
});
