// CSV parser для false-friends seed files.
// Header: source_word,looks_like_native,actual_meaning,confidence,domain
// Handles quoted fields with embedded commas. Simple per-line parse — no embedded newlines.
import type { FalseFriendEntry } from './FalseFriendsDictionary';

export function parseFalseFriendsCsv(
  csv: string,
  sourceLang: string,
  targetLang: string,
): FalseFriendEntry[] {
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const out: FalseFriendEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i] ?? '');
    if (cols.length < 5) continue;
    const conf = (cols[3] === 'medium' ? 'medium' : 'high') as 'high' | 'medium';
    out.push({
      sourceLang,
      targetLang,
      sourceWord: cols[0] ?? '',
      looksLikeNative: cols[1] ?? '',
      actualMeaning: cols[2] ?? '',
      confidence: conf,
      domain: cols[4] || 'general',
    });
  }
  return out;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i] ?? '';
    if (c === '"') inQ = !inQ;
    else if (c === ',' && !inQ) {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}
