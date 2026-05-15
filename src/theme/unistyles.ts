import { StyleSheet } from 'react-native-unistyles';
import { palettes, semanticBase, semanticDark, sizes } from './tokens';

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

StyleSheet.configure({
  themes: appThemes,
  breakpoints,
  settings: { initialTheme: 'light', adaptiveThemes: false },
});

export { appThemes };
