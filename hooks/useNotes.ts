'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Note } from '@/lib/types';
import { store } from '@/lib/browser';
import { type Anchor, notesKey, uid } from '@/lib/notes';

export type NotesApi = ReturnType<typeof useNotes>;

/** One video's highlights & notes, persisted per video in localStorage. */
export function useNotes(videoId: string) {
  const [notes, setNotes] = useState<Note[]>([]);
  const latest = useRef(notes);

  useEffect(() => {
    latest.current = store.get(notesKey(videoId), []);
    setNotes(latest.current);
  }, [videoId]);

  const actions = useMemo(() => {
    const commit = (next: Note[]) => {
      latest.current = next;
      setNotes(next);
      store.set(notesKey(videoId), next);
    };
    return {
      /** Highlight `anchor`, or return the highlight already there. */
      add(anchor: Anchor): Note {
        const existing = latest.current.find(n => n.start === anchor.start && n.offset === anchor.offset && n.quote === anchor.quote);
        if (existing) return existing;
        const note: Note = { id: uid(), ...anchor, note: '', at: Date.now() };
        commit([...latest.current, note].sort((a, b) => a.start - b.start || a.offset - b.offset));
        return note;
      },
      setText(id: string, text: string) {
        commit(latest.current.map(n => (n.id === id ? { ...n, note: text } : n)));
      },
      remove(id: string) {
        commit(latest.current.filter(n => n.id !== id));
      },
    };
  }, [videoId]);

  return { notes, ...actions };
}
