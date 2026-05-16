import React from 'react';
import { View, Image } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { sanitizeImageId } from '@/services/parser/shared/sanitizeImageId';

interface Props {
  bookId: string;
  src: string;
  alt?: string;
  aspectRatio?: number;
}

export const ImageRender = React.memo(function ImageRender({ bookId, src, alt, aspectRatio }: Props) {
  const safeBook = sanitizeImageId(bookId);
  const safeSrc = sanitizeImageId(src);
  const uri = `${FileSystem.documentDirectory}books/${safeBook}/images/${safeSrc}`;
  return (
    <View style={{ marginVertical: 16 }}>
      <Image
        source={{ uri }}
        accessibilityLabel={alt}
        style={{ width: '100%', aspectRatio: aspectRatio ?? 1.5 }}
        resizeMode="contain"
      />
    </View>
  );
});
