// paperOverlay — полупрозрачный «бумажный» tint поверх BlurView (TabBar и т.п.).
// Отдельный rgba-токен, чтобы НЕ конкатенировать hex-suffix к paper —
// `${theme.paper}E0` сломается, если палитра переедет на oklch.
// Альфа ~30% оставляет BlurView видимым (см. I1).
export const palettes = {
  light: {
    paper: '#F5EFE4', paper2: '#EDE5D5',
    ink: '#1F1A14', ink2: '#564E42', ink3: '#8A8170',
    paperOverlay: 'rgba(245,239,228,0.30)',
  },
  sepia: {
    paper: '#ECDFC6', paper2: '#DBCBAA',
    ink: '#2A2117', ink2: '#5E513D', ink3: '#8E7E62',
    paperOverlay: 'rgba(236,223,198,0.30)',
  },
  dark: {
    paper: '#16130E', paper2: '#221E17',
    ink: '#EDE6D6', ink2: '#B5AB97', ink3: '#786E5C',
    paperOverlay: 'rgba(22,19,14,0.30)',
  },
} as const;

export const semanticBase = {
  accent: 'oklch(0.62 0.14 40)', accentSoft: 'oklch(0.62 0.14 40 / 0.12)',
  accentLine: 'oklch(0.62 0.14 40 / 0.35)',
  known: 'oklch(0.68 0.06 140)', knownSoft: 'oklch(0.68 0.06 140 / 0.18)',
  learning: 'oklch(0.78 0.12 75)', learningSoft: 'oklch(0.78 0.12 75 / 0.22)',
  newSoft: 'oklch(0.62 0.14 40 / 0.18)',
};

export const semanticDark = {
  accent: 'oklch(0.72 0.12 40)', accentSoft: 'oklch(0.72 0.12 40 / 0.18)',
  accentLine: 'oklch(0.72 0.12 40 / 0.35)',
  known: 'oklch(0.74 0.07 140)', knownSoft: 'oklch(0.74 0.07 140 / 0.22)',
  learning: 'oklch(0.82 0.13 75)', learningSoft: 'oklch(0.82 0.13 75 / 0.25)',
  newSoft: 'oklch(0.72 0.12 40 / 0.22)',
};

export const scriptTypography = {
  latin: { fontReading: 'SourceSerif4-Regular', fontReadingItalic: 'SourceSerif4-Italic',
           fontUi: 'Inter-Regular', fontMono: 'GeistMono-Regular',
           readingLeading: 1.65, readingLetterSpacing: -0.005, isRTL: false },
  cyrillic: { fontReading: 'Lora-Regular', fontReadingItalic: 'Lora-Italic',
              fontUi: 'Inter-Regular', fontMono: 'GeistMono-Regular',
              readingLeading: 1.6, readingLetterSpacing: 0, isRTL: false },
  cjk_jp: { fontReading: 'ShipporiMinchoB1-Regular', fontReadingItalic: 'ShipporiMinchoB1-Regular',
            fontUi: 'NotoSansJP-Regular', fontMono: 'GeistMono-Regular',
            readingLeading: 1.85, readingLetterSpacing: 0.02, isRTL: false },
  cjk_kr: { fontReading: 'NotoSerifKR-Regular', fontReadingItalic: 'NotoSerifKR-Regular',
            fontUi: 'NotoSansKR-Regular', fontMono: 'GeistMono-Regular',
            readingLeading: 1.75, readingLetterSpacing: 0, isRTL: false },
  arabic: { fontReading: 'Amiri-Regular', fontReadingItalic: 'Amiri-Italic',
            fontUi: 'NotoSansArabic-Regular', fontMono: 'GeistMono-Regular',
            readingLeading: 1.95, readingLetterSpacing: 0, isRTL: true },
  devanagari: { fontReading: 'TiroDevanagariHindi-Regular', fontReadingItalic: 'TiroDevanagariHindi-Italic',
                fontUi: 'NotoSansDevanagari-Regular', fontMono: 'GeistMono-Regular',
                readingLeading: 1.85, readingLetterSpacing: 0, isRTL: false },
} as const;

export const sizes = {
  readingDefault: 19, readingMin: 15, readingMax: 26,
  radii: { sm: 3, md: 12, lg: 14, xl: 18, xxl: 22, pill: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 22, xxl: 28 },
  iconBtn: 36, statusbarH: 54, tabbarH: 60,
} as const;

export type PaletteId = keyof typeof palettes;
export type ScriptTypographyId = keyof typeof scriptTypography;
