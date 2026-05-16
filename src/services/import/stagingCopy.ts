// Копирование импортируемого файла в books/_tmp/{uuid}.{ext}.
// См. spec §7.1 шаг 2.
import * as FileSystem from 'expo-file-system/legacy';
import type { ImportFile } from './types';

function uuidV4(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function extOf(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.epub')) return 'epub';
  if (lower.endsWith('.fb2')) return 'fb2';
  return 'bin';
}

export async function stagingCopy(file: ImportFile): Promise<string> {
  const tmpDir = `${FileSystem.documentDirectory}books/_tmp/`;
  await FileSystem.makeDirectoryAsync(tmpDir, { intermediates: true }).catch(() => {});
  const target = `${tmpDir}${uuidV4()}.${extOf(file.name)}`;
  await FileSystem.copyAsync({ from: file.uri, to: target });
  return target;
}
