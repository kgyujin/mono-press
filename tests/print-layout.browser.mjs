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
import { EXPORT_DOCUMENT_CSS } from '../lib/export.ts';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const outputDirectory = process.env.PRINT_QA_DIR || join(tmpdir(), 'monopress-print-regression');
const appCss = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');
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
