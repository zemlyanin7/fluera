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

// Семантические токены конвертированы из oklch в sRGB hex/rgba: iOS native
// ShadowTree color-parser в RN 0.81 не понимает oklch и валит native exception
// "Value is undefined, expected a number" при применении стилей.
// Конверсия: oklch → OKLab → linear sRGB → gamma → 8-bit (Björn Ottosson formula).
export const semanticBase = {
  accent: '#CB6440', accentSoft: 'rgba(203,100,64,0.12)',
  accentLine: 'rgba(203,100,64,0.35)',
  known: '#85A27F', knownSoft: 'rgba(133,162,127,0.18)',
  learning: '#E4AC59', learningSoft: 'rgba(228,172,89,0.22)',
  newSoft: 'rgba(203,100,64,0.18)',
};

export const semanticDark = {
  accent: '#E4896A', accentSoft: 'rgba(228,137,106,0.18)',
  accentLine: 'rgba(228,137,106,0.35)',
  known: '#94B68C', knownSoft: 'rgba(148,182,140,0.22)',
  learning: '#F5B75B', learningSoft: 'rgba(245,183,91,0.25)',
  newSoft: 'rgba(228,137,106,0.22)',
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
