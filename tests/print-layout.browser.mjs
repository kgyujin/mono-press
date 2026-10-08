/**
 * Print regression: real Mermaid SVGs must fit and remain on one PDF page.
 * Run with PLAYWRIGHT_MODULE pointing to an installed playwright module when
 * it is not installed locally. Requires Chromium and Poppler's pdftotext.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { SHARED_PRINT_CSS } from '../lib/print-styles.ts';
import { EXPORT_DOCUMENT_CSS } from '../lib/export.ts';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const outputDirectory = process.env.PRINT_QA_DIR || join(tmpdir(), 'monopress-print-regression');
const appCss = (await readFile(new URL('../app/globals.css', import.meta.url), 'utf8')) + SHARED_PRINT_CSS;
const scenarios = [
  { name: 'tall', direction: 'TD', count: 16, spacer: 0 },
  { name: 'wide', direction: 'LR', count: 10, spacer: 0 },
  { name: 'page-boundary', direction: 'TD', count: 4, spacer: 210 },
  { name: 'small', direction: 'TD', count: 2, spacer: 0 },
];

test('app and standalone print keep complete diagrams within one A4 page', async () => {
  await mkdir(outputDirectory, { recursive: true });
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });
  try {
    for (const [mode, css] of [['app', appCss], ['standalone', EXPORT_DOCUMENT_CSS]]) {
      for (const scenario of scenarios) {
        const page = await browser.newPage();
        const nodes = Array.from({ length: scenario.count }, (_, index) => `N${index}[NODE${String(index).padStart(2, '0')}]`);
        const diagram = `flowchart ${scenario.direction}\n${nodes.join(' --> ')}`;
        const body = `<div style="height:${scenario.spacer}mm"></div><div class="diagram-shell"><div class="diagram-label">Mermaid diagram</div><div class="mermaid">${diagram}</div></div><p>AFTER_DIAGRAM</p>`;
        await page.setContent(`<style>${css}</style>${mode === 'app' ? `<div class="app-shell"><div class="workspace-layout"><main class="main-area"><div class="editor-preview-grid"><section class="preview-panel"><article class="article-preview">${body}</article></section></div></main></div></div>` : `<main class="document">${body}</main>`}`);
        await page.addScriptTag({ path: 'node_modules/mermaid/dist/mermaid.min.js' });
        await page.evaluate(async () => {
          window.mermaid.initialize({ startOnLoad: false, theme: 'base' });
          await window.mermaid.run();
          await document.fonts.ready;
        });
        const screenHeight = await page.locator('.mermaid svg').evaluate(svg => svg.getBoundingClientRect().height);
        await page.emulateMedia({ media: 'print' });
        const dimensions = await page.locator('.diagram-shell').evaluate(shell => {
          const svg = shell.querySelector('svg');
          return { shell: shell.getBoundingClientRect().height, svg: svg.getBoundingClientRect().height };
        });
        assert.ok(dimensions.svg <= 220 * 96 / 25.4 + 1, `${mode}/${scenario.name}: SVG exceeds print height: ${dimensions.svg}`);
        assert.ok(dimensions.shell <= 253 * 96 / 25.4, `${mode}/${scenario.name}: shell exceeds A4 content height`);
        if (scenario.name === 'tall') assert.ok(screenHeight > dimensions.svg, 'only print should shrink tall diagrams');
        const pdfPath = join(outputDirectory, `${mode}-${scenario.name}.pdf`);
        await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true });
        const pages = execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8' }).split('\f');
        const diagramPages = pages.filter(content => /NODE\d+/.test(content));
        assert.equal(diagramPages.length, 1, `${mode}/${scenario.name}: diagram split across pages`);
        for (let index = 0; index < scenario.count; index++) {
          assert.ok(diagramPages[0].includes(`NODE${String(index).padStart(2, '0')}`), `${mode}/${scenario.name}: missing node ${index}`);
        }
        assert.ok(pages.some(content => content.includes('AFTER_DIAGRAM')), 'following content must survive');
        if (scenario.name === 'page-boundary') assert.ok(!pages[0].includes('NODE00'), 'diagram should move to the next page');
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
});

test('app and standalone share print typography and element spacing', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const title = '<section class="print-title-block"><span class="print-title-kicker">mono-press / DOCUMENT</span><h1>Title</h1><p>notes.md</p></section>';
  const body = '<h1>Heading</h1><h2>Section</h2><h3>Subsection</h3><p>Text <strong>bold</strong> <a href="#">link</a> <code>inline</code></p><ul><li>Bullet</li></ul><ol><li>Number</li></ol><blockquote>Quote</blockquote><pre><code>code</code></pre><table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Cell</td></tr></tbody></table><figure class="document-figure"><img src="data:image/svg+xml,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" width=\"10\" height=\"10\"/%3E"><figcaption>Image</figcaption></figure><div class="diagram-shell"><div class="diagram-label"><span class="diagram-label__dot"></span>Mermaid</div><div class="mermaid"><svg></svg></div></div><hr>';
  const snapshots = [];
  try {
    for (const [mode, css] of [['app', appCss], ['standalone', EXPORT_DOCUMENT_CSS]]) {
      const page = await browser.newPage();
      await page.setContent(`<style>${css}</style>${mode === 'app' ? `${title}<article class="article-preview">${body}</article>` : `<main class="document">${title}${body}</main>`}`);
      await page.emulateMedia({ media: 'print' });
      snapshots.push(await page.evaluate(() => {
        const root = document.querySelector('.article-preview, .document');
        const selectors = ['h1', 'h2', 'h3', 'p', 'strong', 'a', 'p code', 'ul', 'ol', 'li', 'blockquote', 'pre', 'pre code', 'table', 'th', 'td', 'figure', 'img', 'figcaption', '.diagram-shell', '.diagram-label', '.diagram-label__dot', 'hr'];
        const properties = ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'color', 'background-color', 'margin-top', 'margin-bottom', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'border-top-width', 'border-top-color', 'border-radius', 'list-style-type', 'box-sizing'];
        const readStyle = (element) => {
          const style = getComputedStyle(element);
          return Object.fromEntries(properties.map(property => [property, style.getPropertyValue(property)]));
        };
        return Object.fromEntries([
          ...selectors.map(selector => [selector, readStyle(root.querySelector(['h1', 'h2', 'h3', 'p'].includes(selector) ? `:scope > ${selector}` : selector))]),
          ['title h1', readStyle(document.querySelector('.print-title-block h1'))],
          ['title p', readStyle(document.querySelector('.print-title-block p'))],
        ]);
      }));
      await page.close();
    }
    assert.deepEqual(snapshots[0], snapshots[1]);
  } finally {
    await browser.close();
  }
});
