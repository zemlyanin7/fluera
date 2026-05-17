import { StyleSheet } from 'react-native-unistyles';
import { palettes, semanticBase, semanticDark, sizes } from './tokens';
import { useSettingsStore } from '@/stores/settingsStore';

const lightTheme = { ...palettes.light, ...semanticBase, sizes };
const sepiaTheme = { ...palettes.sepia, ...semanticBase, sizes };
const darkTheme  = { ...palettes.dark,  ...semanticDark, sizes };

const appThemes = { light: lightTheme, sepia: sepiaTheme, dark: darkTheme };
const breakpoints = { xs: 0, sm: 360, md: 400, lg: 720 } as const;

type AppThemes = typeof appThemes;
type AppBreakpoints = typeof breakpoints;

declare module 'react-native-unistyles' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface UnistylesThemes extends AppThemes {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface UnistylesBreakpoints extends AppBreakpoints {}
}

// C6: читаем themeId синхронно из стора, чтобы избежать cold-start flash при
// persisted theme=sepia/dark. Пока persistence (#2 Data layer) не подключён,
// стор возвращает DEFAULT_SETTINGS.themeId = 'light' — поведение совпадает
// с прежним хардкодом. После подключения middleware (persist) — заработает
// автоматически без правок здесь.
const initialTheme = useSettingsStore.getState().themeId;

StyleSheet.configure({
  themes: appThemes,
  breakpoints,
  settings: { initialTheme, adaptiveThemes: false },
});

export { appThemes };
