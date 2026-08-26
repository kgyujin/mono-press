/**
 * 작성자: Git 이력 참조
 * 작성목적: Markdown을 mono-press의 안전한 HTML 조각으로 변환한다.
 * 작성일: 2026-08-26
 * 변경사항 내역:
 * - 2026-08-26 | 문서 렌더링 | 이미지 상대 경로와 Mermaid 코드 블록 지원
 * - 2026-08-26 | 코드 문법 강조 | 지정 언어별 highlight.js 결과를 문서 HTML에 연결
 */

import DOMPurify from 'dompurify';
import { marked } from 'marked';

import { getCodeLanguageLabel, highlightCode } from './code-highlight';
import { resolveWorkspaceReference } from './workspace';

export interface RenderMarkdownOptions {
  assetUrls: Map<string, string>;
  documentPath: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll('`', '&#096;');
}

function safeTitle(title: string | null | undefined): string {
  return title ? ` title="${escapeAttribute(title)}"` : '';
}

function isExternalLink(href: string): boolean {
  return /^(?:https?:|mailto:|tel:|#|\/\/)/i.test(href);
}

export function renderMarkdown(
  source: string,
  options: RenderMarkdownOptions,
): string {
  const renderer = new marked.Renderer();

  renderer.image = ({ href, title, text }) => {
    const resolvedPath = resolveWorkspaceReference(options.documentPath, href);
    const assetUrl = resolvedPath ? options.assetUrls.get(resolvedPath) : undefined;
    const altText = escapeAttribute(text || '문서 이미지');

    if (!assetUrl) {
      const missingPath = escapeHtml(resolvedPath ?? href);
      return `<div class="asset-missing" role="note"><span class="asset-missing__icon">!</span><div><strong>이미지를 찾을 수 없습니다</strong><code>${missingPath}</code></div></div>`;
    }

    const caption = text
      ? `<figcaption>${escapeHtml(text)}</figcaption>`
      : '';
    return `<figure class="document-figure"><img src="${escapeAttribute(assetUrl)}" alt="${altText}"${safeTitle(title)} loading="lazy" />${caption}</figure>`;
  };

  renderer.link = ({ href, title, text }) => {
    const resolvedPath = resolveWorkspaceReference(options.documentPath, href);
    const workspaceUrl = resolvedPath ? options.assetUrls.get(resolvedPath) : undefined;
    const targetHref = workspaceUrl ?? href;
    const externalAttributes = isExternalLink(href)
      ? ' target="_blank" rel="noreferrer"'
      : '';

    return `<a href="${escapeAttribute(targetHref)}"${safeTitle(title)}${externalAttributes}>${text}</a>`;
  };

  renderer.code = ({ text, lang }) => {
    const languageLabel = getCodeLanguageLabel(lang);
    if (languageLabel?.toLowerCase() === 'mermaid') {
      return `<div class="diagram-shell"><div class="diagram-label"><span class="diagram-label__dot"></span>Mermaid diagram</div><div class="mermaid">${escapeHtml(text)}</div></div>`;
    }

    const highlightedCode = highlightCode(text, languageLabel);
    const languageAttribute = languageLabel
      ? ` data-language="${escapeAttribute(languageLabel)}"`
      : '';
    const languageClass = highlightedCode.languageClassName
      ? ` class="${highlightedCode.languageClassName}"`
      : '';
    return `<pre${languageAttribute}><code${languageClass}>${highlightedCode.html}</code></pre>`;
  };

  const html = marked.parse(source, {
    gfm: true,
    breaks: true,
    renderer,
  }) as string;

  // The first render can happen on the server in Next-compatible runtimes.
  // Local files are only available in the browser, so sanitize there after
  // hydration while keeping the server render deterministic.
  if (typeof window === 'undefined') return html;

  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['target', 'rel', 'loading', 'data-language'],
    ALLOW_UNKNOWN_PROTOCOLS: false,
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto|tel|blob):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
  });
}

export function getDocumentTitle(markdown: string, fallback: string): string {
  const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return heading || fallback.replace(/\.(?:md|markdown|mdx)$/i, '');
}
