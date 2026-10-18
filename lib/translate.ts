// On-device translation fallback, for when YouTube rate-limits its translated tracks.
// Uses the browser's built-in Translator API (Chrome 138+), which runs entirely on this machine.

import type { Transcript, TranslationLanguage } from './types';

type Availability = 'unavailable' | 'downloadable' | 'downloading' | 'available';
type TranslatorInstance = { translate(text: string, o?: { signal?: AbortSignal }): Promise<string>; destroy(): void };
type TranslatorApi = {
  availability(o: { sourceLanguage: string; targetLanguage: string }): Promise<Availability>;
  create(o: {
    sourceLanguage: string;
    targetLanguage: string;
    signal?: AbortSignal;
    monitor?: (m: EventTarget) => void;
  }): Promise<TranslatorInstance>;
};
const translatorApi = () => (self as unknown as { Translator?: TranslatorApi }).Translator;

export const onDeviceAvailable = () => !!translatorApi();

// YouTube's caption codes → the BCP 47 tags the Translator API expects.
const ALIASES: Record<string, string> = { iw: 'he', 'zh-Hans': 'zh', 'zh-CN': 'zh', 'zh-TW': 'zh-Hant', 'zh-HK': 'zh-Hant', fil: 'tl' };
const AVAILABILITY_TIMEOUT_MS = 6000;
const tag = (code: string) => ALIASES[code] ?? (code.startsWith('zh') ? code : code.split('-')[0]);

export type Progress = (fraction: number, phase: 'download' | 'translate') => void;

/**
 * Translate every caption snippet of `data` into `target`.
 * Resolves to a copy of `data` shaped like a server translation, with `translation.onDevice` set.
 */
export async function translateOnDevice(
  data: Transcript,
  target: TranslationLanguage,
  { onProgress = () => {}, signal }: { onProgress?: Progress; signal?: AbortSignal } = {},
): Promise<Transcript> {
  const Translator = translatorApi()!;
  const sourceLanguage = tag(data.languageCode), targetLanguage = tag(target.code);
  // Some embedded Chromium builds expose the API but never answer; don't wait on them forever.
  const availability = await Promise.race([
    Translator.availability({ sourceLanguage, targetLanguage }),
    new Promise<Availability>(resolve => setTimeout(resolve, AVAILABILITY_TIMEOUT_MS, 'unavailable')),
  ]);
  if (availability === 'unavailable') {
    throw new Error(`YouTube is limiting translations right now, and this browser can’t translate ${data.language} to ${target.name} itself`);
  }

  const translator = await Translator.create({
    sourceLanguage, targetLanguage, signal,
    monitor: m => m.addEventListener('downloadprogress', e => onProgress((e as ProgressEvent).loaded, 'download')),
  });
  try {
    const snippets = [];
    const total = data.snippets.length;
    for (let i = 0; i < total; i++) {
      signal?.throwIfAborted();
      const sn = data.snippets[i];
      snippets.push({ ...sn, text: sn.text.trim() ? await translator.translate(sn.text, { signal }) : sn.text });
      if (i % 10 === 0) onProgress(i / total, 'translate');
    }
    onProgress(1, 'translate');
    return { ...data, translation: { code: target.code, name: target.name, onDevice: true }, snippets };
  } finally {
    translator.destroy();
  }
}
