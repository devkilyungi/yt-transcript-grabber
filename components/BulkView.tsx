'use client';

import { type ReactNode, useEffect, useRef, useSyncExternalStore } from 'react';
import type { BulkItem, BulkItemState, BulkQueue } from '@/lib/bulk';
import type { Prefs, Transcript } from '@/lib/types';
import { buildParagraphs, bulkPrompt, type ExportContext, jsonRecord, markdown, plainText } from '@/lib/transcript';
import { fmtTime, plural, safeFilename } from '@/lib/format';
import { downloadFile } from '@/lib/browser';
import { roll } from '@/lib/house/roll.js';
import { CopyButton, Downloads, type Format } from './Controls';
import { Icon } from './Sprite';

const PILL: Record<BulkItemState, { tone?: string; icon?: string; label: string; state: string }> = {
  queued: { label: 'Queued', state: 'queued' },
  loading: { tone: 'accent', label: 'Fetching', state: 'running' },
  done: { tone: 'good', icon: 'check', label: 'Done', state: 'done' },
  error: { tone: 'bad', icon: 'x', label: 'Failed', state: 'failed' },
};

const DOWNLOADS: Format[] = [
  { fmt: 'md', label: 'Markdown (.md)' },
  { fmt: 'txt', label: 'Text (.txt)' },
  { fmt: 'json', label: 'JSON' },
];

export function BulkView({ queue, prefs, form, onOpen }: {
  queue: BulkQueue;
  prefs: Prefs;
  /** The link box, shown until a playlist is open. */
  form: ReactNode;
  onOpen: (id: string, data: Transcript) => void;
}) {
  useSyncExternalStore(queue.subscribe, queue.getVersion, queue.getVersion);
  const s = queue.state;

  const done = s.items.filter(i => i.state === 'done');
  const failed = s.items.filter(i => i.state === 'error');
  const left = s.items.filter(i => i.state === 'queued' || i.state === 'loading').length;
  const n = s.items.length;
  const pct = n ? Math.round(((done.length + failed.length) / n) * 100) : 0;
  const wait = s.resumeAt ? Math.max(0, Math.ceil((s.resumeAt - Date.now()) / 1000)) : 0;

  const meter = useRef<HTMLDivElement>(null);
  useEffect(() => { meter.current?.style.setProperty('--v', String(pct)); }, [pct]);
  const countdown = useRef<HTMLSpanElement>(null);
  useEffect(() => { if (countdown.current) roll(countdown.current, String(wait)); }, [wait]);

  /* ---------- Exports: every finished transcript in one file ---------- */

  const ctxFor = (item: BulkItem): ExportContext => ({
    data: item.data!,
    paras: buildParagraphs(item.data!.snippets, { hideTags: prefs.tags }),
    ts: prefs.ts,
    hideTags: prefs.tags,
  });
  const combined = (fn: (ctx: ExportContext) => string) => done.map(i => fn(ctxFor(i))).join('\n\n---\n\n');
  const name = () => safeFilename(s.title || 'Transcripts');

  const download = (fmt: string) => {
    if (fmt === 'json') {
      const json = JSON.stringify({ title: s.title, videos: done.map(i => jsonRecord(ctxFor(i))) }, null, 2) + '\n';
      return downloadFile(json, `${name()}.json`, 'application/json');
    }
    const md = fmt === 'md';
    downloadFile(combined(md ? markdown : plainText) + '\n', `${name()}.${fmt}`, md ? 'text/markdown' : 'text/plain');
  };

  const sub = (item: BulkItem) =>
    item.state === 'done' ? `${plural(item.words ?? 0, 'word')} · ${item.data!.language}`
    : item.state === 'error' ? item.error
    : item.state === 'loading' ? 'Fetching transcript…'
    : item.duration ? fmtTime(item.duration) : 'Waiting';

  return (
    <section className="page-enter">
      <div className="hero">
        <h1>A whole playlist.</h1>
        <p className="lede">Every video’s transcript, two at a time. Leave the app open; you can pause and pick up where you left off.</p>
        {!s.key && form}
      </div>

      {!s.key && (
        <div className="empty">
          <Icon name="inbox" />
          <strong>Nothing queued yet</strong>
          <p>Paste a playlist link, or several video links at once, and they line up here.</p>
        </div>
      )}

      {s.blocked && (
        <div className="notice" data-tone="warn" role="status">
          <Icon name="warn" />
          <div>
            <strong>YouTube asked us to slow down</strong>
            {s.resumeAt
              ? <p>Resuming in <span ref={countdown} className="countdown" /> s. Nothing to do; finished transcripts are kept.</p>
              : <p>Paused. Resume in a few minutes; finished transcripts are kept.</p>}
          </div>
        </div>
      )}

      {!!s.key && (
        <section className="stack" aria-labelledby="pl-h">
          <div className="card-head">
            <div>
              <h2 id="pl-h">{s.title}</h2>
              {s.sub && <p className="muted">{s.sub}</p>}
            </div>
            <div className="row">
              {left > 0 && (
                <button className="btn sm" type="button" onClick={queue.togglePause}>
                  <Icon name={s.paused ? 'play' : 'pause'} />{s.paused ? 'Resume' : 'Pause'}
                </button>
              )}
              {failed.length > 0 && !left && (
                <button className="btn sm" type="button" onClick={() => queue.retry(failed)}><Icon name="refresh" />Retry failed</button>
              )}
            </div>
          </div>

          <div className="meter-row">
            <div className="row">
              <span><span className="num">{done.length}</span> of <span className="num">{n}</span> done{failed.length > 0 && <> · <span className="num">{failed.length}</span> failed</>}{s.paused && !s.blocked && ' · paused'}</span>
              <span className="num muted">{pct}%</span>
            </div>
            <div ref={meter} className="meter" role="progressbar" aria-label="Playlist progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i /></div>
          </div>

          <div className="row">
            <CopyButton className="btn primary" label="Copy all for summary" disabled={!done.length}
              getText={() => bulkPrompt(done.length) + combined(markdown)} message={`Copied ${plural(done.length, 'transcript')} with a summary prompt`} />
            <CopyButton label="Copy all" disabled={!done.length} getText={() => combined(markdown)} message={`Copied ${plural(done.length, 'transcript')}`} />
            <Downloads formats={DOWNLOADS} onPick={download} disabled={!done.length} label="Download all" />
          </div>

          <ol className="queue">
            {s.items.map((item, i) => {
              const pill = PILL[item.state];
              return (
                <li key={item.id} data-state={pill.state}>
                  <span className="num">{i + 1}</span>
                  <span className="title">{item.data?.title || item.title || item.id}<small>{sub(item)}</small></span>
                  <span className="pill" data-tone={pill.tone}>{pill.icon && <Icon name={pill.icon} />}{pill.label}</span>
                  {item.state === 'done' && <button className="btn sm ghost" type="button" onClick={() => onOpen(item.id, item.data!)}>Open</button>}
                  {item.state === 'error' && <button className="btn sm ghost" type="button" onClick={() => queue.retry([item])}>Retry</button>}
                  {item.state !== 'done' && item.state !== 'error' && <span />}
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </section>
  );
}
