// Small formatting helpers.

export function fmtTime(sec: number): string {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** "1:02:03" or "9:52" → seconds. */
export function parseClock(s: string): number | null {
  const m = s.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

export const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;
export const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

export const safeFilename = (s: string) =>
  s.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'transcript';
