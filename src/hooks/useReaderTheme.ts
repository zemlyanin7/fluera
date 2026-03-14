import { useColorScheme } from 'react-native';
import { useSettingsStore } from '../stores/settingsStore';
import { getThemeById } from '../theme/readerThemes';
import type { ReaderThemeDefinition } from '../theme/readerThemes';

/**
 * Single source of truth for the active reader theme.
 *
 * - autoTheme ON: follows system appearance (light → lightThemeId, dark → darkThemeId)
 * - autoTheme OFF: uses manualThemeId
 */
export function useReaderTheme(): ReaderThemeDefinition {
  const { autoTheme, lightThemeId, darkThemeId, manualThemeId } =
    useSettingsStore();
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null

  if (autoTheme) {
    const isDark = systemScheme === 'dark';
    return getThemeById(isDark ? darkThemeId : lightThemeId);
  }

  return getThemeById(manualThemeId);
}
