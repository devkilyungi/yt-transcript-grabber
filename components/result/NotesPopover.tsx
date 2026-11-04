'use client';

import { type KeyboardEvent, type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { NotesApi } from '@/hooks/useNotes';
import { type Anchor, selectionTarget } from '@/lib/notes';
import { copyText } from '@/lib/browser';
import { Icon } from '../Sprite';

type Pop =
  | { mode: 'tools'; anchor: Anchor | null; rect: DOMRect }
  | { mode: 'editor'; noteId: string; draft: string };

/**
 * Select text in the reader to highlight it, attach a note, or copy it.
 * Clicking a highlight opens its note for editing.
 */
export function NotesPopover({ readerRef, notes }: { readerRef: RefObject<HTMLElement | null>; notes: NotesApi }) {
  const [pop, setPop] = useState<Pop | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const opener = useRef<HTMLElement | null>(null); // focus goes back here when the editor closes

  // Listeners below read the latest values through this ref.
  const latest = useRef({ pop, notes });
  useLayoutEffect(() => { latest.current = { pop, notes }; });

  const editing = pop?.mode === 'editor' ? notes.notes.find(n => n.id === pop.noteId) : undefined;

  /** Close, saving the note being edited. */
  const close = () => {
    const { pop, notes: api } = latest.current;
    if (pop?.mode === 'editor') {
      const note = api.notes.find(n => n.id === pop.noteId);
      const text = pop.draft.trim();
      if (note && text !== note.note) api.setText(note.id, text);
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
    }
    setPop(null);
  };
  const closeRef = useRef(close);
  useLayoutEffect(() => { closeRef.current = close; });

  const openEditor = (noteId: string) => {
    const note = latest.current.notes.notes.find(n => n.id === noteId);
    opener.current = document.activeElement as HTMLElement | null;
    setPop({ mode: 'editor', noteId, draft: note?.note ?? '' });
  };

  // Place above the selection (or the highlight being edited), or below when there's no room.
  // Typing in the editor doesn't move it, so key the effect on what it's anchored to.
  const anchoredTo = !pop ? null : pop.mode === 'tools' ? pop.rect : pop.noteId;
  useLayoutEffect(() => {
    const el = popRef.current;
    if (!pop || !el) return;
    const rect = pop.mode === 'tools' ? pop.rect
      : (readerRef.current?.querySelector(`mark[data-note="${pop.noteId}"]`) ?? readerRef.current)?.getBoundingClientRect();
    if (!rect) return;
    const below = rect.top < el.offsetHeight + 90; // the sticky header lives up there
    const half = el.offsetWidth / 2;
    const x = Math.min(Math.max(rect.left + rect.width / 2, half + 8), innerWidth - half - 8);
    // Placed through the CSSOM: the CSP has no unsafe-inline for style attributes, and transform leaves the entrance's translate alone.
    el.style.left = `${x + scrollX}px`;
    el.style.top = `${(below ? rect.bottom : rect.top) + scrollY}px`;
    el.style.transform = below ? 'translate(-50%, 8px)' : 'translate(-50%, calc(-100% - 8px))';
  }, [anchoredTo, readerRef]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (pop?.mode === 'editor') textRef.current?.focus(); }, [pop?.mode]);

  useEffect(() => {
    const reader = readerRef.current;
    if (!reader) return;

    const checkSelection = () => setTimeout(() => {
      if (latest.current.pop?.mode === 'editor') return;
      const target = selectionTarget(reader);
      if (target) setPop({ mode: 'tools', anchor: target.anchor, rect: target.range.getBoundingClientRect() });
      else if (!popRef.current?.contains(document.activeElement)) closeRef.current();
    }, 0);
    const onKeyUp = (e: globalThis.KeyboardEvent) => { if (e.shiftKey) checkSelection(); };
    const onClick = (e: MouseEvent) => {
      const mark = (e.target as Element).closest<HTMLElement>('mark.hl');
      if (mark && getSelection()?.isCollapsed) openEditor(mark.dataset.note!);
    };
    const onDocDown = (e: PointerEvent) => {
      const t = e.target as Element;
      if (latest.current.pop && !popRef.current?.contains(t) && !t.closest('mark.hl')) closeRef.current();
    };
    const onDocKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape' && latest.current.pop) closeRef.current(); };

    reader.addEventListener('pointerup', checkSelection);
    reader.addEventListener('keyup', onKeyUp);
    reader.addEventListener('click', onClick);
    document.addEventListener('pointerdown', onDocDown);
    document.addEventListener('keydown', onDocKey);
    return () => {
      reader.removeEventListener('pointerup', checkSelection);
      reader.removeEventListener('keyup', onKeyUp);
      reader.removeEventListener('click', onClick);
      document.removeEventListener('pointerdown', onDocDown);
      document.removeEventListener('keydown', onDocKey);
    };
  }, [readerRef]);

  const clearSelection = () => getSelection()?.removeAllRanges();

  const highlight = (anchor: Anchor) => { notes.add(anchor); clearSelection(); setPop(null); };
  const addNote = (anchor: Anchor) => { const n = notes.add(anchor); clearSelection(); openEditor(n.id); };
  const copy = () => { copyText(getSelection()?.toString().trim() ?? '', 'Copied'); setPop(null); };
  const remove = (id: string) => { notes.remove(id); setPop(null); };

  const editorKeys = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); close(); }
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
  };

  return (
    <div ref={popRef} className={pop?.mode === 'editor' ? 'note-card' : 'pop'} role={pop?.mode === 'tools' ? 'toolbar' : undefined}
      aria-label={pop?.mode === 'tools' ? 'Selection' : undefined} hidden={!pop || (pop.mode === 'editor' && !editing)}>
      {pop?.mode === 'tools' && (
        <>
          {pop.anchor && <>
            <button className="btn sm ghost" type="button" onClick={() => highlight(pop.anchor!)}><Icon name="pen" />Highlight</button>
            <button className="btn sm ghost" type="button" onClick={() => addNote(pop.anchor!)}><Icon name="note" />Note</button>
          </>}
          <button className="btn sm ghost" type="button" onClick={copy}><Icon name="copy" />Copy</button>
        </>
      )}
      {pop?.mode === 'editor' && editing && (
        <>
          <label className="label" htmlFor="note">Note</label>
          <textarea ref={textRef} id="note" value={pop.draft} placeholder="Add a note…" onKeyDown={editorKeys}
            onChange={e => setPop({ ...pop, draft: e.target.value })} />
          <div className="row">
            <button className="btn sm primary" type="button" onClick={close}>Save note</button>
            <button className="btn sm ghost" type="button" onClick={() => setPop(null)}>Cancel</button>
            <button className="btn sm ghost" type="button" onClick={() => remove(editing.id)}><Icon name="trash" />Remove highlight</button>
          </div>
        </>
      )}
    </div>
  );
}
