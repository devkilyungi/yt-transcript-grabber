// Shapes shared by the API routes and the client.

export type Snippet = { start: number; duration: number; text: string };

export type Track = { code: string; name: string; generated: boolean };
export type TranslationLanguage = { code: string; name: string };
export type Translation = TranslationLanguage & { onDevice?: boolean };

export type Transcript = {
  videoId: string;
  title: string;
  author: string;
  language: string;
  languageCode: string;
  isGenerated: boolean;
  translation: Translation | null;
  languages: Track[];
  translationLanguages: TranslationLanguage[];
  snippets: Snippet[];
};

export type Chapter = { start: number; title: string };

export type PlaylistVideo = { id: string; title: string; duration: number | null };
export type Playlist = { id: string; title: string; author: string; total: number; videos: PlaylistVideo[] };

export type ErrorBody = { error: string; code: string; detail: string };

export type Note = { id: string; start: number; offset: number; quote: string; note: string; at: number };

export type Prefs = { ts: boolean; tags: boolean; follow: boolean };

export type Paragraph = { start: number; text: string; chapter: Chapter | null };
