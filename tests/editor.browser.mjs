/** Real browser regressions for local drafts, image paths and render-before-export. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';

const port = 3187;
const url = `http://127.0.0.1:${port}`;

test('drafts survive switching/reload and immediate export contains rendered diagrams', async () => {
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(port)], { stdio: 'pipe' });
  let logs = '';
  server.stdout.on('data', chunk => { logs += chunk; });
  server.stderr.on('data', chunk => { logs += chunk; });
  let browser;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      if (server.exitCode !== null) throw new Error(logs);
      try { if ((await fetch(url)).ok) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert.ok(ready, `Server failed to start: ${logs}`);
    browser = await chromium.launch({ channel: 'chrome' });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url);
    page.setDefaultTimeout(15000);
    const editor = page.getByRole('textbox', { name: 'Markdown source' });
    await editor.waitFor();
    await page.waitForFunction(() => !document.querySelector('textarea').disabled);
    await page.evaluate(() => {
      const transfer = new DataTransfer();
      transfer.items.add(new File(['# Original'], 'guide.md', { type: 'text/markdown' }));
      transfer.items.add(new File(['# Other'], 'other.md', { type: 'text/markdown' }));
      transfer.items.add(new File(['<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>'], 'my chart.svg', { type: 'image/svg+xml' }));
      document.querySelector('.app-shell').dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
    });
    await page.waitForFunction(() => document.querySelector('textarea').value === '# Original');
    await editor.fill('# Saved draft\n\nLocal changes\n\n![chart](my%20chart.svg)');
    await page.getByText('Saved locally', { exact: true }).waitFor();
    await page.locator('button').filter({ hasText: 'other.md' }).first().click();
    await page.waitForFunction(() => document.querySelector('textarea').value === '# Other');
    await page.locator('button').filter({ hasText: 'guide.md' }).first().click();
    await page.waitForFunction(() => document.querySelector('textarea').value.startsWith('# Saved draft'));
    assert.equal(await editor.inputValue(), '# Saved draft\n\nLocal changes\n\n![chart](my%20chart.svg)');
    await page.getByText('Saved locally', { exact: true }).waitFor();
    await page.reload();
    await page.waitForFunction(() => !document.querySelector('textarea').disabled);
    assert.equal(await editor.inputValue(), '# Saved draft\n\nLocal changes\n\n![chart](my%20chart.svg)');

    await page.waitForFunction(() => { const img = document.querySelector('.article-preview img'); return img?.complete && img.naturalWidth > 0; });

    await editor.fill('# Linked asset\n\n![chart](my%20chart.svg)\n\n[Original](my%20chart.svg)');
    let downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: 'HTML', exact: true }).click();
    let exported = await readFile(await (await downloaded).path(), 'utf8');
    assert.match(exported, /href="data:image\/svg\+xml/);
    assert.doesNotMatch(exported, /(?:href|src)="blob:/);
    const standalone = await context.newPage();
    await standalone.setContent(exported);
    const assetDownload = standalone.waitForEvent('download');
    await standalone.getByRole('link', { name: 'Original' }).click();
    assert.equal((await assetDownload).suggestedFilename(), 'my chart.svg');
    await standalone.close();
    downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Markdown', exact: true }).click();
    assert.equal(await readFile(await (await downloaded).path(), 'utf8'), await editor.inputValue());
    await page.getByText('Saved locally', { exact: true }).waitFor();
    const previousId = await page.locator('#recent-workspace option').evaluateAll(options => options.find(option => option.textContent.startsWith('guide.md ·')).value);
    await page.locator('input[type=file]').first().setInputFiles({ name: 'b.md', mimeType: 'text/markdown', buffer: Buffer.from('# Workspace B') });
    await page.waitForFunction(() => document.querySelector('textarea').value === '# Workspace B');
    await page.getByText('Saved locally', { exact: true }).waitFor();
    await page.setViewportSize({ width: 600, height: 800 });
    assert.equal(await page.locator('#recent-workspace').isVisible(), true);
    await page.locator('#recent-workspace').selectOption(previousId);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForFunction(() => document.querySelector('textarea').value.startsWith('# Linked asset'));
    await page.getByText('Saved locally', { exact: true }).waitFor();

    // Both pages share browser storage, but carry independent revisions.
    const sibling = await page.context().newPage();
    await sibling.goto(url);
    await sibling.waitForFunction(() => !document.querySelector('textarea').disabled);
    await sibling.locator('#recent-workspace').selectOption(previousId);
    await page.getByRole('textbox', { name: 'Markdown source' }).fill('# First tab saved');
    await page.getByText('Saved locally', { exact: true }).waitFor();
    await sibling.getByRole('textbox', { name: 'Markdown source' }).fill('# Stale tab changes');
    await sibling.getByText(/다른 탭에서 수정했습니다/).waitFor();
    assert.equal(await sibling.getByRole('textbox', { name: 'Markdown source' }).inputValue(), '# Stale tab changes');
    await sibling.close();

    await page.route('https://images.example.test/chart.svg', async route => {
      await new Promise(resolve => setTimeout(resolve, 100));
      await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>' });
    });
    await editor.fill('# Remote image\n\n![remote](https://images.example.test/chart.svg)');
    downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: 'HTML', exact: true }).click();
    exported = await readFile(await (await downloaded).path(), 'utf8');
    assert.match(exported, /https:\/\/images.example.test\/chart.svg/);
    assert.match(exported, /export-dependency-note/);

    const diagram = '# Export draft\n\n```mermaid\nflowchart TD\nA[START] --> B[END]\n```';
    await editor.fill(diagram);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'HTML', exact: true }).click();
    const download = await downloadPromise;
    const html = await readFile(await download.path(), 'utf8');
    assert.match(html, /<svg/);
    assert.match(html, /START/);
    assert.match(html, /END/);
    assert.doesNotMatch(html, />flowchart TD/);

    await page.evaluate(() => { window.print = () => { window.printedDiagram = Boolean(document.querySelector('.article-preview svg')); }; });
    await editor.fill(diagram.replace('START', 'PDF_START'));
    await page.getByRole('button', { name: 'PDF로 저장하기' }).click();
    await page.waitForFunction(() => window.printedDiagram === true);

    await editor.fill('# Invalid\n\n```mermaid\nnot-a-valid-diagram\n```');
    await page.getByRole('button', { name: 'HTML', exact: true }).click();
    await page.getByText(/순서도 렌더링 실패 또는 문서 변경/).waitFor();

    const unavailableStorage = await browser.newPage();
    await unavailableStorage.addInitScript(() => { indexedDB.open = () => { throw new DOMException('Blocked', 'SecurityError'); }; });
    await unavailableStorage.goto(url);
    await unavailableStorage.getByText(/저장 실패 —/).waitFor();
    assert.equal(await unavailableStorage.getByRole('textbox', { name: 'Markdown source' }).isEnabled(), true);
    await unavailableStorage.close();

    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '저장된 초안 모두 삭제' }).click();
    await page.getByText(/저장된 초안 삭제됨/).waitFor();
    assert.equal(await page.locator('#recent-workspace option').count(), 1);
    await editor.fill('# Saved after deletion');
    await page.getByText('Saved locally', { exact: true }).waitFor();
  } finally {
    await browser?.close();
    server.kill('SIGTERM');
  }
});
