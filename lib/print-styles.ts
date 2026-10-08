/**
 * 작성자: Git 이력 참조
 * 작성목적: 앱과 내보낸 HTML의 A4 인쇄 스타일을 동일하게 유지한다.
 * 작성일: 2026-10-08
 * 변경사항 내역:
 * - 2026-10-08 | 출력 정합성 개선 | 공통 인쇄 스타일 및 출력 리소스 준비 지원
 */
export const SHARED_PRINT_CSS = `
  @page {
    size: A4;
    margin: 22mm 17mm;
    @top-left { color: #707070; content: var(--print-document-title); font: 8px/1.3 "SFMono-Regular", Consolas, monospace; }
    @top-right { color: #707070; content: "mono-press / PDF"; font: 8px/1.3 "SFMono-Regular", Consolas, monospace; }
    @bottom-left { color: #707070; content: var(--print-document-name); font: 8px/1.3 "SFMono-Regular", Consolas, monospace; }
    @bottom-right { color: #707070; content: "mono-press · page " counter(page); font: 8px/1.3 "SFMono-Regular", Consolas, monospace; }
  }
  @media print {
    html, body { background: #fff; }
    :is(.article-preview, .document) { max-width: none; padding: 0; }
    .print-title-block { border-bottom: 1px solid #dedede; display: block; margin: 0 0 25px; padding: 0 0 17px; break-after: avoid-page; page-break-after: avoid; }
    .print-title-kicker { color: #707070; display: block; font: 8px/1.3 "SFMono-Regular", Consolas, monospace; letter-spacing: .1em; margin-bottom: 11px; }
    .print-title-block h1 { font-size: 28px; letter-spacing: -.055em; line-height: 1.15; margin: 0; }
    .print-title-block p { color: #707070; font: 9px/1.4 "SFMono-Regular", Consolas, monospace; margin: 8px 0 0; }
    :is(.article-preview, .document) { -webkit-print-color-adjust: exact; print-color-adjust: exact; color: #292925; font-size: 12px; line-height: 1.62; }
    :is(.article-preview, .document) p, :is(.article-preview, .document) ul, :is(.article-preview, .document) ol, :is(.article-preview, .document) blockquote { color: #292925; line-height: 1.62; }
    :is(.article-preview, .document) pre { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #f2f2ef !important; border: 1px solid #d5d5cf; border-radius: 6px; color: #171717 !important; overflow: visible; padding: 11px 13px; white-space: pre-wrap; overflow-wrap: anywhere; word-break: normal; }
    :is(.article-preview, .document) pre[data-language] { padding-top: 27px; }
    :is(.article-preview, .document) pre[data-language]::before { color: #858585; }
    :is(.article-preview, .document) pre code { color: inherit; }
    :is(.article-preview, .document) pre .hljs-comment, :is(.article-preview, .document) pre .hljs-quote { color: #777; }
    :is(.article-preview, .document) pre .hljs-keyword, :is(.article-preview, .document) pre .hljs-selector-tag, :is(.article-preview, .document) pre .hljs-literal, :is(.article-preview, .document) pre .hljs-type { color: #292929; }
    :is(.article-preview, .document) pre .hljs-string, :is(.article-preview, .document) pre .hljs-doctag, :is(.article-preview, .document) pre .hljs-regexp, :is(.article-preview, .document) pre .hljs-template-tag { color: #555; }
    :is(.article-preview, .document) pre .hljs-number, :is(.article-preview, .document) pre .hljs-symbol, :is(.article-preview, .document) pre .hljs-bullet, :is(.article-preview, .document) pre .hljs-built_in, :is(.article-preview, .document) pre .hljs-punctuation, :is(.article-preview, .document) pre .hljs-operator { color: #686868; }
    :is(.article-preview, .document) pre .hljs-title, :is(.article-preview, .document) pre .hljs-title.class_, :is(.article-preview, .document) pre .hljs-title.function_, :is(.article-preview, .document) pre .hljs-section { color: #171717; }
    :is(.article-preview, .document) pre .hljs-attr, :is(.article-preview, .document) pre .hljs-attribute, :is(.article-preview, .document) pre .hljs-variable, :is(.article-preview, .document) pre .hljs-template-variable, :is(.article-preview, .document) pre .hljs-params { color: #444; }
    :is(.article-preview, .document) pre .hljs-meta, :is(.article-preview, .document) pre .hljs-tag, :is(.article-preview, .document) pre .hljs-name, :is(.article-preview, .document) pre .hljs-selector-class, :is(.article-preview, .document) pre .hljs-selector-id, :is(.article-preview, .document) pre .hljs-selector-pseudo, :is(.article-preview, .document) pre .hljs-selector-attr { color: #5e5e5e; }
    :is(.article-preview, .document) pre .hljs-subst { color: #333; }
    :is(.article-preview, .document) pre .hljs-addition { color: #333; }
    :is(.article-preview, .document) pre .hljs-deletion { color: #767676; }
    :is(.article-preview, .document) :not(pre) > code { color: #292925; }
    :is(.article-preview, .document) table { font-size: 11px; }
    :is(.article-preview, .document) img { max-height: 220mm; }
    :is(.article-preview, .document) .diagram-shell { overflow: visible; }
    :is(.article-preview, .document) .mermaid { display: block; min-width: 0; overflow: visible; padding: 12px 0 4px; }
    /* A4 content height is 253mm; reserve room for the label, padding and borders.
       Block layout avoids flex fragmentation when a diagram moves to the next page. */
    :is(.article-preview, .document) .mermaid svg { display: block; width: 100%; height: auto; max-width: 100%; max-height: 220mm; margin: 0 auto; }
    :is(.article-preview, .document) table { break-inside: auto; page-break-inside: auto; }
    :is(.article-preview, .document) thead { display: table-header-group; }
    :is(.article-preview, .document) tr { break-inside: avoid; page-break-inside: avoid; }
    :is(.article-preview, .document) { font-family: Inter, Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    :is(.article-preview, .document) h1, :is(.article-preview, .document) h2, :is(.article-preview, .document) h3 { letter-spacing: -.055em; line-height: 1.15; color: #171717; }
    :is(.article-preview, .document) h1 { font-size: 32px; margin: 0 0 20px; }
    :is(.article-preview, .document) h2 { font-size: 20px; margin: 40px 0 14px; padding-top: 17px; border-top: 1px solid #dedede; }
    :is(.article-preview, .document) h3 { font-size: 15px; margin: 28px 0 9px; }
    :is(.article-preview, .document) p, :is(.article-preview, .document) ul, :is(.article-preview, .document) ol, :is(.article-preview, .document) blockquote { font-size: 12px; margin: 0 0 16px; orphans: 3; widows: 3; }
    :is(.article-preview, .document) table { width: 100%; border-collapse: collapse; margin: 23px 0; }
    :is(.article-preview, .document) th, :is(.article-preview, .document) td { border-bottom: 1px solid #dedede; padding: 10px 8px; text-align: left; }
    :is(.article-preview, .document) th { border-top: 1px solid #171717; font-weight: 700; }
    :is(.article-preview, .document) pre, :is(.article-preview, .document) code { font-family: "SFMono-Regular", Consolas, monospace; }
    :is(.article-preview, .document) pre { font-size: 11px; line-height: 1.6; margin: 22px 0; }
    :is(.article-preview, .document) code { font-size: .9em; }
    :is(.article-preview, .document) blockquote { border-left: 2px solid #171717; padding-left: 16px; }
    :is(.article-preview, .document) figure { margin: 25px 0; text-align: center; }
    :is(.article-preview, .document) img { height: auto; max-width: 100%; object-fit: contain; }
    :is(.article-preview, .document) figcaption { color: #707070; font: 10px "SFMono-Regular", Consolas, monospace; margin-top: 8px; }
    :is(.article-preview, .document) .diagram-shell { border: 1px solid #dedede; border-radius: 7px; margin: 25px 0; padding: 11px 14px 12px; }
    :is(.article-preview, .document) pre, :is(.article-preview, .document) .diagram-shell, :is(.article-preview, .document) figure, :is(.article-preview, .document) blockquote { break-inside: avoid-page; page-break-inside: avoid; }
    :is(.article-preview, .document), :is(.article-preview, .document) * { box-sizing: border-box; }
    :is(.article-preview, .document) { margin: 0; min-height: 0; overflow: visible; }
    :is(.article-preview, .document) h1, :is(.article-preview, .document) h2, :is(.article-preview, .document) h3 { font-weight: 700; }
    :is(.article-preview, .document) ul { list-style: disc; padding-left: 20px; }
    :is(.article-preview, .document) ol { list-style: decimal; padding-left: 20px; }
    :is(.article-preview, .document) li { margin: 5px 0; }
    :is(.article-preview, .document) strong { font-weight: 700; color: #171717; }
    :is(.article-preview, .document) a { color: #171717; text-decoration: underline; text-underline-offset: 3px; }
    :is(.article-preview, .document) th, :is(.article-preview, .document) td { color: #292925; }
    :is(.article-preview, .document) :not(pre) > code { background: #f0f0ed; border-radius: 3px; padding: 3px 5px; font: 11px/1.62 "SFMono-Regular", Consolas, monospace; }
    :is(.article-preview, .document) .document-figure img { border: 1px solid #ecece8; border-radius: 7px; max-height: 220mm; }
    :is(.article-preview, .document) .diagram-label { color: #707070; font: 9px/1.2 "SFMono-Regular", Consolas, monospace; letter-spacing: .1em; text-transform: uppercase; }
    :is(.article-preview, .document) .diagram-label__dot { background: #171717; border-radius: 50%; display: inline-block; height: 5px; width: 5px; margin-right: 6px; vertical-align: 1px; }
    :is(.article-preview, .document) hr { border: 0; border-top: 1px solid #dedede; margin: 30px 0; }
    :is(.print-title-block, .document .print-title-block) h1 { font: 700 28px/1.15 Inter, Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; letter-spacing: -.055em; margin: 0; color: #171717; }
    :is(.print-title-block, .document .print-title-block) p { color: #707070; font: 9px/1.4 "SFMono-Regular", Consolas, monospace; margin: 8px 0 0; }
    .export-dependency-note { display: none; }
  }
`;
