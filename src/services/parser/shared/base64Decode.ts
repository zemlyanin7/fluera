// React Native runtime (Hermes) предоставляет глобальный atob/btoa с SDK 49+.
// Возвращает Uint8Array из base64-string (с возможными whitespace).
// Используется для FB2 <binary> декодирования.
export function base64Decode(input: string): Uint8Array {
  const clean = input.replace(/[\s\r\n]+/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) {
    throw new Error('Invalid base64 input');
  }
  const binary = atob(clean);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}
