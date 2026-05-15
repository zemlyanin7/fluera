// Playground — showcase всех 12 UI-примитивов + 25 иконок.
// Доступен только в __DEV__ (см. (playground)/_layout.tsx).
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import {
  PhoneShell,
  Headline,
  SectionLabel,
  Button,
  Pill,
  Card,
  IconBtn,
  Hairline,
  BookCover,
  Stat,
  ProgressBar,
} from '@/components/ui';
import * as Icons from '@/components/icons';

const ICON_LIST: [string, React.ComponentType<{ size?: number }>][] = [
  ['ChevronLeft', Icons.IcChevronLeft],
  ['ChevronRight', Icons.IcChevronRight],
  ['ChevronDown', Icons.IcChevronDown],
  ['Close', Icons.IcClose],
  ['Search', Icons.IcSearch],
  ['Plus', Icons.IcPlus],
  ['Book', Icons.IcBook],
  ['Library', Icons.IcLibrary],
  ['Sparkle', Icons.IcSparkle],
  ['Flame', Icons.IcFlame],
  ['Graph', Icons.IcGraph],
  ['Cards', Icons.IcCards],
  ['Play', Icons.IcPlay],
  ['Volume', Icons.IcVolume],
  ['Bookmark', Icons.IcBookmark],
  ['Star', Icons.IcStar],
  ['Heart', Icons.IcHeart],
  ['Check', Icons.IcCheck],
  ['ArrowRight', Icons.IcArrowRight],
  ['Globe', Icons.IcGlobe],
  ['FontSize', Icons.IcFontSize],
  ['Moon', Icons.IcMoon],
  ['More', Icons.IcMore],
  ['Layers', Icons.IcLayers],
  ['Settings', Icons.IcSettings],
];

const styles = StyleSheet.create((theme) => ({
  content: { padding: 22, gap: 22 },
  section: { gap: 10 },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  iconCell: { width: 64, alignItems: 'center', gap: 4 },
  iconLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 10,
    color: theme.ink3,
    textAlign: 'center',
  },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
}));

export default function Playground() {
  return (
    <PhoneShell>
      <ScrollView contentContainerStyle={styles.content}>
        <Headline level={1}>Playground</Headline>

        <View style={styles.section}>
          <SectionLabel>Headlines</SectionLabel>
          <Headline level={1}>H1 Source Serif 4</Headline>
          <Headline level={2}>H2 Source Serif 4</Headline>
          <Headline level={3}>H3 Inter SemiBold</Headline>
        </View>

        <View style={styles.section}>
          <SectionLabel>Buttons</SectionLabel>
          <View style={styles.row}>
            <Button variant="primary" onPress={() => {}}>
              Primary
            </Button>
            <Button variant="accent" onPress={() => {}}>
              Accent
            </Button>
            <Button variant="ghost" onPress={() => {}}>
              Ghost
            </Button>
          </View>
          <Button block onPress={() => {}}>
            Block Primary
          </Button>
        </View>

        <View style={styles.section}>
          <SectionLabel>Pills</SectionLabel>
          <View style={styles.row}>
            <Pill>EN</Pill>
            <Pill tone="accent">14-day streak</Pill>
            <Pill tone="known">Finished</Pill>
            <Pill tone="learning">Learning</Pill>
          </View>
        </View>

        <View style={styles.section}>
          <SectionLabel>Card + Stat + ProgressBar</SectionLabel>
          <Card>
            <Stat num={428} label="Words learned" delta="+12" />
          </Card>
          <ProgressBar value={0.4} tone="accent" />
        </View>

        <Hairline />

        <View style={styles.section}>
          <SectionLabel>IconBtn</SectionLabel>
          <View style={styles.row}>
            <IconBtn onPress={() => {}}>
              <Icons.IcSearch size={18} />
            </IconBtn>
            <IconBtn onPress={() => {}} solid>
              <Icons.IcPlus size={18} />
            </IconBtn>
            <IconBtn onPress={() => {}} accent>
              <Icons.IcHeart size={18} />
            </IconBtn>
          </View>
        </View>

        <View style={styles.section}>
          <SectionLabel>BookCover</SectionLabel>
          <View style={styles.row}>
            <BookCover
              book={{
                title: 'The Garden of Forking Paths',
                author: 'J. L. Borges',
                gradient: ['#C0392B', '#5C1810'],
              }}
              w={78}
              h={108}
            />
            <BookCover
              book={{
                title: 'Hojas en el Viento',
                author: 'Ana Lima',
                gradient: ['#E5B85F', '#7B5C18'],
              }}
              w={78}
              h={108}
            />
            <BookCover
              book={{
                title: 'Une saison à Lyon',
                author: 'Marc Duval',
                gradient: ['#3F5B8F', '#0F2143'],
              }}
              w={78}
              h={108}
            />
          </View>
        </View>

        <View style={styles.section}>
          <SectionLabel>All 25 icons</SectionLabel>
          <View style={styles.iconGrid}>
            {ICON_LIST.map(([name, Ic]) => (
              <View key={name} style={styles.iconCell}>
                <Ic size={22} />
                <Text style={styles.iconLabel}>{name}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </PhoneShell>
  );
}
