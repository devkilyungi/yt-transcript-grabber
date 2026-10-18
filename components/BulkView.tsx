'use client';

import { type CSSProperties, type KeyboardEvent, type MouseEvent, useSyncExternalStore } from 'react';
import type { BulkItem, BulkItemState, BulkQueue } from '@/lib/bulk';
import type { Prefs, Transcript } from '@/lib/types';
import { buildParagraphs, bulkPrompt, type ExportContext, jsonRecord, markdown, plainText } from '@/lib/transcript';
import { fmtTime, plural, safeFilename } from '@/lib/format';
import { thumbUrl } from '@/lib/links';
import { copyText, downloadFile } from '@/lib/browser';
import { DownloadMenu, type MenuEntry } from './DownloadMenu';
import { CopyIcon, DoneSwap, SparkleIcon } from './icons';

const STATUS: Record<BulkItemState, string> = { queued: 'Queued', loading: 'Fetching', done: 'Ready', error: 'Failed' };

const DOWNLOADS: MenuEntry[] = [
  { heading: 'One combined file' },
  { fmt: 'md', label: 'Markdown', ext: 'md' },
  { fmt: 'txt', label: 'Plain text', ext: 'txt' },
  { fmt: 'json', label: 'JSON', ext: 'json' },
];

export function BulkView({ queue, prefs, onOpen }: {
  queue: BulkQueue;
  prefs: Prefs;
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
  const status = s.blocked ? 'YouTube is limiting requests from this network. '
      + (s.resumeAt ? `Trying again in ${wait < 60 ? `${wait}s` : `${Math.floor(wait / 60)}m ${wait % 60}s`}.` : 'Paused; resume in a few minutes.')
    : !n ? ''
    : !left ? (failed.length ? `${done.length} ready, ${failed.length} failed` : `All ${plural(done.length, 'transcript')} ready`)
    : s.paused ? `Paused · ${done.length} of ${n} ready`
    : `${done.length} of ${n} ready` + (failed.length ? ` · ${failed.length} failed` : '');

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

  /* ---------- Rows ---------- */

  const open = (item: BulkItem) => { if (item.state === 'done') onOpen(item.id, item.data!); };
  const rowClick = (e: MouseEvent, item: BulkItem) => { if (!(e.target as Element).closest('button')) open(item); };
  const rowKey = (e: KeyboardEvent, item: BulkItem) => {
    if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    open(item);
  };
  const sub = (item: BulkItem) =>
    item.state === 'done' ? `${plural(item.words ?? 0, 'word')} · ${item.data!.language}`
    : item.state === 'error' ? item.error
    : item.state === 'loading' ? 'Fetching transcript…'
    : item.duration ? fmtTime(item.duration) : 'Waiting';

  return (
    <main className="bulk view">
      <div className="card bulk-head">
        <div className="eyebrow">{s.eyebrow}</div>
        <h2>{s.key ? s.title : 'Reading playlist…'}</h2>
        <div className="sub">{s.sub}</div>
        <div className="progress" role="progressbar" aria-label="Transcripts fetched" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div style={{ width: `${pct}%` }} />
        </div>
        <div className="bulk-status">
          <span>{status}</span>
          <span className="grow" />
          {failed.length > 0 && !left && <button className="btn ghost" type="button" onClick={() => queue.retry(failed)}>Retry failed</button>}
          {left > 0 && <button className="btn ghost" type="button" onClick={queue.togglePause}>{s.paused ? 'Resume' : 'Pause'}</button>}
        </div>
        <div className="bulk-actions">
          <button className="btn primary" type="button" disabled={!done.length}
            onClick={e => copyText(bulkPrompt(done.length) + combined(markdown), `Copied ${plural(done.length, 'transcript')} with a summary prompt`, e.currentTarget)}>
            <DoneSwap icon={SparkleIcon} />
            Copy all for summary
          </button>
          <button className="btn" type="button" disabled={!done.length}
            onClick={e => copyText(combined(markdown), `Copied ${plural(done.length, 'transcript')}`, e.currentTarget)}>
            <DoneSwap icon={CopyIcon} size={15} />
            Copy all
          </button>
          <DownloadMenu label="Download all" entries={DOWNLOADS} onPick={download} disabled={!done.length} down />
        </div>
      </div>

      <ol className="bulk-list">
        {s.items.map((item, i) => (
          <li key={item.id} className={`bulk-row ${item.state}`} style={{ '--i': i } as CSSProperties}
            tabIndex={item.state === 'done' ? 0 : -1} onClick={e => rowClick(e, item)} onKeyDown={e => rowKey(e, item)}>
            <span className="idx">{i + 1}</span>
            <div className="bthumb"><img src={thumbUrl(item.id)} alt="" loading="lazy" /></div>
            <div>
              <div className="bt">{item.data?.title || item.title || item.id}</div>
              <div className="bs">{sub(item)}</div>
            </div>
            <div className="end">
              <span className="status">{STATUS[item.state]}</span>
              {item.state === 'error' && <button className="btn ghost retry" type="button" onClick={() => queue.retry([item])}>Retry</button>}
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}
