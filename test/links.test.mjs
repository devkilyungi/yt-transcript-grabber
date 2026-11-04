// Link parsing is the trust boundary for everything pasted into the app. Needs Node 22.18+ to import .ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { videoIdFrom, playlistIdFrom, videoIdsIn } from '../lib/links.ts';

const ID = 'jNQXAC9IVRw';
const LIST = 'PLabcdefghijklmnop';

test('videoIdFrom reads every link shape', () => {
  for (const link of [
    ID,
    `  ${ID}  `,
    `https://www.youtube.com/watch?v=${ID}`,
    `youtube.com/watch?v=${ID}&t=5s`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://music.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}?si=x`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    `https://www.youtube.com/live/${ID}`,
  ]) assert.equal(videoIdFrom(link), ID, link);
});

test('videoIdFrom refuses other hosts and bad ids', () => {
  for (const link of [
    '',
    'not a link',
    `https://evil.example/watch?v=${ID}`,
    `https://youtube.com.evil.example/watch?v=${ID}`,
    `https://notyoutu.be/${ID}`,
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/watch?v=<script>alert</script>',
  ]) assert.equal(videoIdFrom(link), null, link);
});

test('playlistIdFrom wants a playlist and no particular video', () => {
  assert.equal(playlistIdFrom(`https://www.youtube.com/playlist?list=${LIST}`), LIST);
  assert.equal(playlistIdFrom(`https://www.youtube.com/watch?v=${ID}&list=${LIST}`), null);
  assert.equal(playlistIdFrom(`https://evil.example/playlist?list=${LIST}`), null);
});

test('a bare playlist id counts only when asked, and never as a video id', () => {
  assert.equal(playlistIdFrom(LIST), null);
  assert.equal(playlistIdFrom(LIST, { bare: true }), LIST);
  assert.equal(playlistIdFrom(ID, { bare: true }), null);
});

test('videoIdsIn finds links in pasted text, once each', () => {
  const text = `first https://youtu.be/${ID}\nagain https://www.youtube.com/watch?v=${ID} and words`;
  assert.deepEqual(videoIdsIn(text), [ID]);
});
