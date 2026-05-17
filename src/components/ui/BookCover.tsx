// Обложка книги: градиентный фон + корешок + название/автор поверх
import React from 'react';
import { View, Text, ViewStyle, TextStyle, StyleSheet as RN } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export interface BookCoverData {
  title: string;
  author: string;
  gradient: readonly [string, string, ...string[]];
  angle?: number;
}

interface Props { book: BookCoverData; w?: number; h?: number; }

const local = RN.create({
  wrap: { overflow: 'hidden', borderRadius: 6 } satisfies ViewStyle,
  gradient: { ...RN.absoluteFillObject } satisfies ViewStyle,
  spine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '6%', backgroundColor: 'rgba(0,0,0,0.15)' } satisfies ViewStyle,
  title: { position: 'absolute', left: 8, right: 8, top: 10, fontSize: 10, color: 'rgba(255,255,255,0.9)', fontFamily: 'SourceSerif4-Medium', lineHeight: 12 } satisfies TextStyle,
  author:{ position: 'absolute', left: 8, right: 8, bottom: 10, fontSize: 7, color: 'rgba(255,255,255,0.7)', fontFamily: 'Inter-SemiBold', letterSpacing: 0.42, textTransform: 'uppercase' } satisfies TextStyle,
});

// CSS-угол (0 = снизу-вверх по часовой стрелке) → start/end точки для expo-linear-gradient
function angleToPoints(deg: number) {
  const rad = (deg - 90) * (Math.PI / 180);
  const x = Math.cos(rad), y = Math.sin(rad);
  return { start: { x: 0.5 - x / 2, y: 0.5 - y / 2 }, end: { x: 0.5 + x / 2, y: 0.5 + y / 2 } };
}

export const BookCover: React.FC<Props> = ({ book, w = 78, h = 108 }) => {
  const { start, end } = angleToPoints(book.angle ?? 160);
  return (
    <View style={[local.wrap, { width: w, height: h }]}>
      {/* I10: spread в mutable массив, чтобы избавиться от `as any` cast.
          expo-linear-gradient требует mutable [string, string, ...string[]]. */}
      <LinearGradient
        colors={[...book.gradient] as [string, string, ...string[]]}
        start={start}
        end={end}
        style={local.gradient}
      />
      <View style={local.spine} />
      <Text style={local.title} numberOfLines={3}>{book.title}</Text>
      <Text style={local.author} numberOfLines={1}>{book.author}</Text>
    </View>
  );
};
