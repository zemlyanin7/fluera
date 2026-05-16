// Best-effort backup-exclusion. iOS: должен установить
// NSURLIsExcludedFromBackupKey=true чтобы Time Machine / iCloud не
// синкало ~440MB модель. Android: настраивается через manifest
// <full-backup-content> (см. CLAUDE.md security).
//
// expo-file-system SDK 54 НЕ экспортирует setItemValueAsync — exclusion
// требует custom native module или upgrade на v2 API. В v1 — placeholder
// + TODO для будущей интеграции.
import { Platform } from 'react-native';

export async function excludeFromBackup(path: string): Promise<void> {
  if (Platform.OS !== 'ios') return;
  // TODO(v2): integrate expo-file-system v2 setItemValueAsync OR
  // custom native module setting NSURLIsExcludedFromBackupKey.
  // Без этого модель попадает в iCloud backup (~440MB лишнего трафика
  // на user'а на каждый device sync).
  if (__DEV__) console.log('[backup] would exclude', path);
}
