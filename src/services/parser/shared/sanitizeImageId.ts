// Защита от path traversal — см. spec §11.4.
// EPUB image href или FB2 binary id может содержать `../`, `\`, unicode —
// всё переписываем в `_`. Также гарантируем, что не начинается с '.' (no hidden files).
export function sanitizeImageId(id: string): string {
  if (id.length === 0) return '';
  const safe = id.replace(/[^a-zA-Z0-9_\-.]/g, '_');
  // Все ведущие точки переписываем в `_` — `..` или `.` в начале опасны.
  return safe.replace(/^\.+/, (m) => '_'.repeat(m.length));
}
