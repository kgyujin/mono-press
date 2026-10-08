import assert from 'node:assert/strict';
import test from 'node:test';
import { waitForPreviewAssets } from '../lib/preview-ready.ts';

function previewWith(images: unknown[], fonts: Promise<unknown> = Promise.resolve()) {
  return { querySelectorAll: () => images, ownerDocument: { fonts: { ready: fonts } } } as unknown as HTMLElement;
}

test('waits for image decoding and font loading before printing', async () => {
  let decoded = false;
  let releaseFonts!: () => void;
  const fontLoading = new Promise<void>((resolve) => { releaseFonts = resolve; });
  const image = { complete: true, naturalWidth: 100, loading: 'lazy', decode: async () => { decoded = true; } };
  let ready = false;
  const preparation = waitForPreviewAssets(previewWith([image], fontLoading)).then(() => { ready = true; });
  await Promise.resolve();
  assert.equal(decoded, true);
  assert.equal(image.loading, 'eager');
  assert.equal(ready, false);
  releaseFonts();
  await preparation;
  assert.equal(ready, true);
});

test('rejects broken images instead of silently printing missing content', async () => {
  const image = { complete: true, naturalWidth: 0, loading: 'lazy' };
  await assert.rejects(waitForPreviewAssets(previewWith([image])), /이미지를 불러오지/);
});

test('bounds the wait and removes listeners when a resource never loads', async () => {
  const listeners = new Map<string, unknown>();
  const image = {
    complete: false,
    loading: 'lazy',
    addEventListener: (event: string, listener: unknown) => listeners.set(event, listener),
    removeEventListener: (event: string) => listeners.delete(event),
  };
  await assert.rejects(waitForPreviewAssets(previewWith([image]), 5), /초과/);
  assert.equal(listeners.size, 0);
});
