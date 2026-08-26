/**
 * 작성자: Git 이력 참조
 * 작성목적: 미리보기 결과를 독립 실행 가능한 HTML 문서로 만든다.
 * 작성일: 2026-08-26
 * 변경사항 내역:
 * - 2026-08-26 | HTML 내보내기 | 이미지 data URL 내장과 인쇄 스타일 추가
 */

import type { WorkspaceFile } from './workspace';

export const EXPORT_DOCUMENT_CSS = `
  @page { size: A4; margin: 18mm 17mm 20mm; }
  :root { color-scheme: light; font-family: Inter, Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #171717; background: #fff; }
  body { margin: 0; background: #fff; color: #171717; line-height: 1.75; }
  .document { max-width: 760px; margin: 0 auto; padding: 72px 28px 96px; }
  .document h1, .document h2, .document h3 { letter-spacing: -0.04em; line-height: 1.15; break-after: avoid; }
  .document h1 { font-size: 42px; margin: 0 0 28px; }
  .document h2 { font-size: 26px; margin: 52px 0 16px; padding-top: 22px; border-top: 1px solid #dedede; }
  .document h3 { font-size: 18px; margin: 32px 0 10px; }
  .document p, .document ul, .document ol, .document blockquote { margin: 0 0 18px; }
  .document a { color: inherit; text-underline-offset: 3px; }
  .document img { max-width: 100%; height: auto; }
  .document figure { margin: 30px 0; text-align: center; }
  .document figcaption { color: #707070; font-size: 12px; margin-top: 9px; }
  .document pre { overflow: auto; background: #171717; color: #fff; border-radius: 10px; padding: 18px; font-size: 12px; line-height: 1.6; break-inside: avoid; }
  .document code { font-family: "SFMono-Regular", Consolas, monospace; font-size: 0.9em; }
  .document :not(pre) > code { background: #f1f1ef; border-radius: 4px; padding: 2px 5px; }
  .document blockquote { border-left: 3px solid #171717; padding-left: 18px; color: #595959; }
  .document table { width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 13px; }
  .document th, .document td { border-bottom: 1px solid #dedede; padding: 10px 8px; text-align: left; }
  .document th { border-top: 1px solid #171717; font-weight: 700; }
  .diagram-shell { border: 1px solid #dedede; border-radius: 10px; margin: 28px 0; padding: 13px 17px 17px; break-inside: avoid; }
  .diagram-label { color: #707070; font: 11px/1.2 "SFMono-Regular", Consolas, monospace; letter-spacing: .08em; text-transform: uppercase; }
  .diagram-label__dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #171717; margin-right: 7px; vertical-align: 1px; }
  .mermaid { display: flex; justify-content: center; overflow: auto; padding: 20px 0 8px; }
  .mermaid svg { max-width: 100%; height: auto; }
  .asset-missing { border: 1px dashed #9b9b9b; color: #595959; display: flex; gap: 10px; padding: 14px; }
  .asset-missing code { display: block; margin-top: 4px; font-size: 12px; }
  .asset-missing__icon { display: grid; place-items: center; flex: 0 0 20px; width: 20px; height: 20px; border: 1px solid #171717; border-radius: 50%; font-size: 12px; font-weight: 700; }
`;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

async function inlineImages(
  body: string,
  workspaceFiles: WorkspaceFile[],
  assetUrlToFile: Map<string, File>,
): Promise<string> {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = body;

  const images = Array.from(wrapper.querySelectorAll<HTMLImageElement>('img[src]'));
  await Promise.all(
    images.map(async (image) => {
      const sourceFile = assetUrlToFile.get(image.src);
      if (!sourceFile) return;
      image.src = await fileToDataUrl(sourceFile);
    }),
  );

  // Keep the argument explicit so future exporters can add attachments without
  // changing the public export contract.
  void workspaceFiles;
  return wrapper.innerHTML;
}

export async function createStandaloneHtml(options: {
  body: string;
  documentTitle: string;
  workspaceFiles: WorkspaceFile[];
  assetUrlToFile: Map<string, File>;
}): Promise<string> {
  const body = await inlineImages(
    options.body,
    options.workspaceFiles,
    options.assetUrlToFile,
  );

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${options.documentTitle.replaceAll('<', '&lt;').replaceAll('>', '&gt;')} · mono-press</title>
    <style>${EXPORT_DOCUMENT_CSS}</style>
  </head>
  <body>
    <main class="document">${body}</main>
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
