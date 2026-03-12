import type { AcquisitionSample, Finger4 } from './types.ts';

export function statusMessageFromLine(line: string): string | null {
  const text = line.trim();
  if (!text) return null;

  if (text.startsWith('#')) {
    return text.slice(1).trim() || '#';
  }

  const lower = text.toLowerCase();
  if (lower.startsWith('err') || lower.startsWith('ok') || lower.includes('usage')) {
    return text;
  }
  return null;
}

export function parseSampleLine(line: string, fallbackTMs: number): AcquisitionSample | null {
  const text = line.trim();
  if (!text) return null;

  if (text.startsWith('{')) {
    try {
      const obj = JSON.parse(text);
      const values = obj.f;
      if (!Array.isArray(values) || values.length !== 4) return null;
      const parsed = values.map(Number) as Finger4;
      if (parsed.some(value => Number.isNaN(value))) return null;
      const tMs = typeof obj.t_ms === 'number' ? Math.floor(obj.t_ms) : Math.floor(fallbackTMs);
      return { tMs, values: parsed };
    } catch {
      return null;
    }
  }

  const parts = text.split(',');
  if (parts.length === 5) {
    const tMs = Math.floor(parseFloat(parts[0]));
    const values = [
      parseFloat(parts[1]),
      parseFloat(parts[2]),
      parseFloat(parts[3]),
      parseFloat(parts[4]),
    ] as Finger4;
    if (Number.isNaN(tMs) || values.some(value => Number.isNaN(value))) return null;
    return { tMs, values };
  }

  if (parts.length === 4) {
    const values = parts.map(part => parseFloat(part.trim())) as Finger4;
    if (values.some(value => Number.isNaN(value))) return null;
    return { tMs: Math.floor(fallbackTMs), values };
  }

  return null;
}
