// Minimal CSV parser для MWE seed CSVs. Handles unquoted fields + commas inside values.
// Simple line-by-line, не RFC 4180 full — наши CSV не содержат embedded newlines.
import type { MweEntry } from './MweDictionary';

export function parseMweCsv(csv: string): MweEntry[] {
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  // Skip header (lines[0])
  const out: MweEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i] ?? '');
    if (cols.length < 7) continue;
    out.push({
      phrase: cols[0] ?? '',
      translationEquivalent: cols[1] ?? '',
      literalGloss: cols[2] || null,
      mweType: cols[3] || null,
      gapPattern: cols[4] || null,
      domain: cols[5] || 'general',
    });
  }
  return out;
}

// Простой парсер с поддержкой quoted strings ("a, b" → одно поле).
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i] ?? '';
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}
