/** IndexedDB regression: migrate v1 atomically, isolate workspaces, reject stale tabs. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import { chromium } from 'playwright';

test('workspace snapshots migrate, isolate files, reject stale writes and delete saved data', async () => {
  const source = stripTypeScriptTypes(await readFile(new URL('../lib/drafts.ts', import.meta.url), 'utf8'));
  const server = createServer((request, response) => {
    response.setHeader('Content-Type', request.url === '/drafts.js' ? 'text/javascript' : 'text/html');
    response.end(request.url === '/drafts.js' ? source : '<!doctype html><title>Storage test</title>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome' });
    const context = await browser.newContext();
    const first = await context.newPage();
    await first.goto(origin);
    await first.evaluate(async () => {
      await new Promise((resolve, reject) => {
        const request = indexedDB.open('mono-press-drafts', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('workspace');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const tx = request.result.transaction('workspace', 'readwrite');
          const store = tx.objectStore('workspace');
          store.put([{ path: 'legacy.md', name: 'legacy.md', kind: 'markdown', file: new File(['old'], 'legacy.md') }], 'files');
          store.put({ workspaceName: 'Legacy', selectedDocumentPath: 'legacy.md', drafts: {}, markdown: 'old' }, 'document');
          tx.oncomplete = () => { request.result.close(); resolve(); };
        };
      });
      window.draftsApi = await import('/drafts.js');
    });
    assert.equal(await first.evaluate(async () => (await draftsApi.loadDraftWorkspace()).markdown), 'old');
    const second = await context.newPage();
    await second.goto(origin);
    await second.evaluate(async () => { window.draftsApi = await import('/drafts.js'); });
    await first.evaluate(async () => {
      const file = { path: 'a.md', name: 'a.md', kind: 'markdown', file: new File(['A'], 'a.md') };
      await draftsApi.saveDraftWorkspace({ workspaceId: 'A', revision: 0, workspaceName: 'A', selectedDocumentPath: 'a.md', workspaceFiles: [file], drafts: {}, markdown: 'A' });
      await draftsApi.saveDraftWorkspace({ workspaceId: 'B', revision: 0, workspaceName: 'B', selectedDocumentPath: 'b.md', workspaceFiles: [{ ...file, path: 'b.md', name: 'b.md', file: new File(['B'], 'b.md') }], drafts: {}, markdown: 'B' });
    });
    await second.evaluate(async () => { window.stale = await draftsApi.loadDraftWorkspace('A'); });
    await first.evaluate(async () => {
      const snapshot = await draftsApi.loadDraftWorkspace('A');
      await draftsApi.saveDraftWorkspace({ ...snapshot, markdown: 'A updated' });
    });
    assert.equal(await second.evaluate(async () => {
      try { await draftsApi.saveDraftWorkspace({ ...window.stale, markdown: 'stale overwrite' }); return 'saved'; }
      catch (error) { return error.name; }
    }), 'DraftConflictError');
    assert.deepEqual(await first.evaluate(async () => {
      const a = await draftsApi.loadDraftWorkspace('A');
      const b = await draftsApi.loadDraftWorkspace('B');
      return [a.markdown, a.workspaceFiles[0].path, b.markdown, b.workspaceFiles[0].path];
    }), ['A updated', 'a.md', 'B', 'b.md']);
    assert.equal(await first.evaluate(async () => (await draftsApi.listDraftWorkspaces()).length), 3);
    await first.evaluate(async () => { await draftsApi.deleteDraftWorkspace('B'); });
    assert.equal(await second.evaluate(async () => await draftsApi.loadDraftWorkspace('B')), null);
    await first.evaluate(async () => { await draftsApi.clearDraftWorkspaces(); });
    assert.equal(await second.evaluate(async () => (await draftsApi.listDraftWorkspaces()).length), 0);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
