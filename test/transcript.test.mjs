// Paragraph grouping: a lone ">>" caption must not leave an empty paragraph behind.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildParagraphs } from '../lib/transcript.ts';

test('a lone ">>" starts the next paragraph instead of an empty one', () => {
  const paras = buildParagraphs([
    { start: 0, duration: 4, text: 'first speaker talks' },
    { start: 5, duration: 0.5, text: '>>' },
    { start: 5.2, duration: 3, text: 'second speaker' },
  ]);
  assert.deepEqual(paras.map(p => p.text), ['First speaker talks', 'Second speaker']);
});
