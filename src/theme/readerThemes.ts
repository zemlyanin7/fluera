export type ThemeGroup = 'light' | 'dark';

export interface ReaderThemeDefinition {
  id: string;
  nameKey: string;
  group: ThemeGroup;
  colors: {
    background: string;
    text: string;
    textSecondary: string;
    surface: string;
    border: string;
    topBarBg: string;
    popupBg: string;
  };
  preview: string;
}

const THEMES_LIST: ReaderThemeDefinition[] = [
  {
    id: 'white',
    nameKey: 'settings.themes.white',
    group: 'light',
    colors: {
      background: '#FFFFFF',
      text: '#1A1A2E',
      textSecondary: '#666666',
      surface: '#F5F5F5',
      border: '#E0E0E0',
      topBarBg: '#FFFFFF',
      popupBg: '#FFFFFF',
    },
    preview: '#FFFFFF',
  },
  {
    id: 'sepia',
    nameKey: 'settings.themes.sepia',
    group: 'light',
    colors: {
      background: '#FBF0D9',
      text: '#5F4B32',
      textSecondary: '#7A6952',
      surface: '#F0E6CF',
      border: '#D4C9B0',
      topBarBg: '#FBF0D9',
      popupBg: '#F5EACD',
    },
    preview: '#FBF0D9',
  },
  {
    id: 'parchment',
    nameKey: 'settings.themes.parchment',
    group: 'light',
    colors: {
      background: '#F5F1E8',
      text: '#3D3426',
      textSecondary: '#6B5D4E',
      surface: '#EDE8DD',
      border: '#DDD5C5',
      topBarBg: '#F5F1E8',
      popupBg: '#EFE9DE',
    },
    preview: '#F5F1E8',
  },
  {
    id: 'sage',
    nameKey: 'settings.themes.sage',
    group: 'light',
    colors: {
      background: '#E8EDDF',
      text: '#3D4A2E',
      textSecondary: '#5C6B4E',
      surface: '#DEE4D5',
      border: '#C8D0BE',
      topBarBg: '#E8EDDF',
      popupBg: '#E2E8D8',
    },
    preview: '#E8EDDF',
  },
  {
    id: 'dark',
    nameKey: 'settings.themes.dark',
    group: 'dark',
    colors: {
      background: '#1A1A2E',
      text: '#E0E0E0',
      textSecondary: '#AAAAAA',
      surface: '#252540',
      border: '#333355',
      topBarBg: '#1A1A2E',
      popupBg: '#252540',
    },
    preview: '#1A1A2E',
  },
  {
    id: 'amoled',
    nameKey: 'settings.themes.amoled',
    group: 'dark',
    colors: {
      background: '#000000',
      text: '#CCCCCC',
      textSecondary: '#888888',
      surface: '#111111',
      border: '#222222',
      topBarBg: '#000000',
      popupBg: '#111111',
    },
    preview: '#000000',
  },
  {
    id: 'coffee',
    nameKey: 'settings.themes.coffee',
    group: 'dark',
    colors: {
      background: '#2A2118',
      text: '#D4C4A8',
      textSecondary: '#A08B6F',
      surface: '#362C22',
      border: '#4A3D30',
      topBarBg: '#2A2118',
      popupBg: '#362C22',
    },
    preview: '#2A2118',
  },
  {
    id: 'graphite',
    nameKey: 'settings.themes.graphite',
    group: 'dark',
    colors: {
      background: '#262626',
      text: '#D0D0D0',
      textSecondary: '#999999',
      surface: '#333333',
      border: '#444444',
      topBarBg: '#262626',
      popupBg: '#333333',
    },
    preview: '#262626',
  },
];

export const READER_THEMES: Record<string, ReaderThemeDefinition> = {};
for (const theme of THEMES_LIST) {
  READER_THEMES[theme.id] = theme;
}

export const LIGHT_THEMES: ReaderThemeDefinition[] = THEMES_LIST.filter(
  (t) => t.group === 'light',
);
export const DARK_THEMES: ReaderThemeDefinition[] = THEMES_LIST.filter(
  (t) => t.group === 'dark',
);

export function getThemeById(id: string): ReaderThemeDefinition {
  return READER_THEMES[id] ?? READER_THEMES['white'];
}
