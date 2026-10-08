/**
 * 작성자: Git 이력 참조
 * 작성목적: 미리보기 결과를 독립 실행 가능한 HTML 문서로 만든다.
 * 작성일: 2026-08-26
 * 변경사항 내역:
 * - 2026-08-26 | HTML 내보내기 | 이미지 data URL 내장과 인쇄 스타일 추가
 * - 2026-08-26 | PDF 출력 개선 | 인쇄 안전 색상과 문서 크롬 추가
 * - 2026-10-08 | 순서도 페이지 잘림 수정 | 인쇄 높이 제한과 블록 배치 적용
 */

import { SHARED_PRINT_CSS } from './print-styles.ts';

import type { WorkspaceFile } from './workspace';

export const EXPORT_DOCUMENT_CSS = `
  :root { --print-document-title: "mono-press"; --print-document-name: "Untitled.md"; color-scheme: light; font-family: Inter, Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #171717; background: #fff; }
  body { margin: 0; background: #fff; color: #171717; line-height: 1.75; }
  .document { max-width: 760px; margin: 0 auto; padding: 72px 28px 96px; }
  .print-title-block { display: none; }
  .document h1, .document h2, .document h3 { letter-spacing: -0.04em; line-height: 1.15; break-after: avoid-page; page-break-after: avoid; }
  .document h1 { font-size: 42px; margin: 0 0 28px; }
  .document h2 { font-size: 26px; margin: 52px 0 16px; padding-top: 22px; border-top: 1px solid #dedede; }
  .document h3 { font-size: 18px; margin: 32px 0 10px; }
  .document p, .document ul, .document ol, .document blockquote { margin: 0 0 18px; orphans: 3; widows: 3; }
  .document a { color: inherit; text-underline-offset: 3px; }
  .document img { max-width: 100%; height: auto; }
  .document figure { margin: 30px 0; text-align: center; break-inside: avoid-page; page-break-inside: avoid; }
  .document figcaption { color: #707070; font-size: 12px; margin-top: 9px; }
  .document pre { overflow: auto; background: #171717; color: #fff; border-radius: 10px; padding: 18px; font-size: 12px; line-height: 1.6; position: relative; break-inside: avoid-page; page-break-inside: avoid; }
  .document pre[data-language] { padding-top: 33px; }
  .document pre[data-language]::before { color: #959595; content: attr(data-language); font: 9px/1 "SFMono-Regular", Consolas, monospace; letter-spacing: .08em; position: absolute; right: 13px; text-transform: lowercase; top: 12px; }
  .document pre code.hljs { display: block; overflow-x: auto; }
  .document pre .hljs-comment, .document pre .hljs-quote { color: #959595; font-style: italic; }
  .document pre .hljs-keyword, .document pre .hljs-selector-tag, .document pre .hljs-literal, .document pre .hljs-type { color: #dedede; font-weight: 600; }
  .document pre .hljs-string, .document pre .hljs-doctag, .document pre .hljs-regexp, .document pre .hljs-template-tag { color: #c8c8c8; }
  .document pre .hljs-number, .document pre .hljs-symbol, .document pre .hljs-bullet, .document pre .hljs-built_in, .document pre .hljs-punctuation, .document pre .hljs-operator { color: #b5b5b5; }
  .document pre .hljs-title, .document pre .hljs-title.class_, .document pre .hljs-title.function_, .document pre .hljs-section { color: #fff; font-weight: 600; }
  .document pre .hljs-attr, .document pre .hljs-attribute, .document pre .hljs-variable, .document pre .hljs-template-variable, .document pre .hljs-params { color: #d4d4d4; }
  .document pre .hljs-meta, .document pre .hljs-tag, .document pre .hljs-name, .document pre .hljs-selector-class, .document pre .hljs-selector-id, .document pre .hljs-selector-pseudo, .document pre .hljs-selector-attr { color: #bdbdbd; }
  .document pre .hljs-subst { color: #eeeeee; }
  .document pre .hljs-addition { color: #d8d8d8; }
  .document pre .hljs-deletion { color: #9f9f9f; }
  .document code { font-family: "SFMono-Regular", Consolas, monospace; font-size: 0.9em; }
  .document :not(pre) > code { background: #f1f1ef; border-radius: 4px; padding: 2px 5px; }
  .document blockquote { border-left: 3px solid #171717; padding-left: 18px; color: #595959; break-inside: avoid-page; page-break-inside: avoid; }
  .document table { width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 13px; break-inside: auto; page-break-inside: auto; }
  .document thead { display: table-header-group; }
  .document tr { break-inside: avoid; page-break-inside: avoid; }
  .document th, .document td { border-bottom: 1px solid #dedede; padding: 10px 8px; text-align: left; }
  .document th { border-top: 1px solid #171717; font-weight: 700; }
  .diagram-shell { border: 1px solid #dedede; border-radius: 10px; margin: 28px 0; padding: 13px 17px 17px; break-inside: avoid-page; page-break-inside: avoid; }
  .diagram-label { color: #707070; font: 11px/1.2 "SFMono-Regular", Consolas, monospace; letter-spacing: .08em; text-transform: uppercase; }
  .diagram-label__dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #171717; margin-right: 7px; vertical-align: 1px; }
  .mermaid { display: flex; justify-content: center; overflow: auto; padding: 20px 0 8px; }
  .mermaid svg { max-width: 100%; height: auto; }
  .asset-missing { border: 1px dashed #9b9b9b; color: #595959; display: flex; gap: 10px; padding: 14px; }
  .asset-missing code { display: block; margin-top: 4px; font-size: 12px; }
  .asset-missing__icon { display: grid; place-items: center; flex: 0 0 20px; width: 20px; height: 20px; border: 1px solid #171717; border-radius: 50%; font-size: 12px; font-weight: 700; }
  ${SHARED_PRINT_CSS}
`;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

async function inlineWorkspaceAssets(
  body: string,
  workspaceFiles: WorkspaceFile[],
  assetUrlToFile: Map<string, File>,
): Promise<string> {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = body;

  const dataUrls = new Map<File, Promise<string>>();
  const assets = Array.from(wrapper.querySelectorAll<HTMLElement>('img[src], a[href]'));
  await Promise.all(assets.map(async (asset) => {
    const attribute = asset.tagName === 'IMG' ? 'src' : 'href';
    const sourceFile = assetUrlToFile.get(asset.getAttribute(attribute) ?? '');
    if (!sourceFile) return;
    let encodedFile = dataUrls.get(sourceFile);
    if (!encodedFile) {
      encodedFile = fileToDataUrl(sourceFile);
      dataUrls.set(sourceFile, encodedFile);
    }
    asset.setAttribute(attribute, await encodedFile);
    // Browsers block top-level data URL navigation; download keeps original links usable.
    if (attribute === 'href') asset.setAttribute('download', sourceFile.name);
  }));

  // Keep the argument explicit so future exporters can add attachments without
  // changing the public export contract.
  void workspaceFiles;
  return wrapper.innerHTML;
}

export async function createStandaloneHtml(options: {
  body: string;
  documentName?: string;
  documentTitle: string;
  workspaceFiles: WorkspaceFile[];
  assetUrlToFile: Map<string, File>;
}): Promise<string> {
  const body = await inlineWorkspaceAssets(
    options.body,
    options.workspaceFiles,
    options.assetUrlToFile,
  );
  const exportedBody = document.createElement('div');
  exportedBody.innerHTML = body;
  const hasRemoteImages = Array.from(exportedBody.querySelectorAll('img[src]'))
    .some((image) => /^https:\/\//i.test(image.getAttribute('src') ?? ''));
  const dependencyNote = hasRemoteImages
    ? '<aside class="export-dependency-note" role="note">이 문서에는 외부 HTTPS 이미지가 있습니다. 이미지를 표시하려면 인터넷 연결과 원본 서버 접근이 필요합니다.</aside>'
    : '';
  const escapedTitle = escapeHtml(options.documentTitle);
  const printTitleValue = escapeHtml(JSON.stringify(options.documentTitle.replace(/[\r\n]+/g, ' ').trim()));
  const printDocumentNameValue = escapeHtml(JSON.stringify((options.documentName ?? options.documentTitle).replace(/[\r\n]+/g, ' ').trim()));
  const printTitleBlock = /<h1(?:\s|>)/i.test(body)
    ? ''
    : `<section class="print-title-block"><span class="print-title-kicker">mono-press / DOCUMENT</span><h1>${escapedTitle}</h1><p>${escapeHtml(options.documentName ?? 'Untitled.md')}</p></section>`;

  return `<!doctype html>
<html lang="ko" style="--print-document-title: ${printTitleValue}; --print-document-name: ${printDocumentNameValue};">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapedTitle} · mono-press</title>
    <style>${EXPORT_DOCUMENT_CSS}</style>
  </head>
  <body>
    <main class="document">${dependencyNote}${printTitleBlock}${body}</main>
  </body>
</html>`;
}

export function downloadTextFile(
  content: string,
  fileName: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
