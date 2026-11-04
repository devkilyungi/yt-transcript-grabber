'use client';

import { Icon } from '@/components/Sprite';

export default function Error({ retry }: { error: Error; retry: () => void }) {
  return (
    <main className="main" id="main">
      <div className="notice" data-tone="bad" role="alert">
        <Icon name="warn" />
        <div>
          <strong>Something broke on this page</strong>
          <p>Your highlights and notes are safe; they’re stored separately.</p>
          <button className="btn sm" type="button" onClick={retry}><Icon name="refresh" />Try again</button>
        </div>
      </div>
    </main>
  );
}
