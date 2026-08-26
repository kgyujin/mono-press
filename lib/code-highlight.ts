/**
 * 작성자: Git 이력 참조
 * 작성목적: Markdown fenced code block을 지정 언어에 맞춰 강조한다.
 * 작성일: 2026-08-26
 * 변경사항 내역:
 * - 2026-08-26 | 코드 문법 강조 | 선택 언어 모듈과 안전한 plain-text fallback 추가
 */

import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

const HIGHLIGHT_LANGUAGES = {
  bash,
  c,
  cpp,
  csharp,
  css,
  diff,
  go,
  java,
  javascript,
  json,
  markdown,
  python,
  rust,
  sql,
  typescript,
  xml,
  yaml,
};

Object.entries(HIGHLIGHT_LANGUAGES).forEach(([languageName, languageDefinition]) => {
  hljs.registerLanguage(languageName, languageDefinition);
});

const LANGUAGE_ALIASES: Record<string, string> = {
  'c#': 'csharp',
  'c++': 'cpp',
  cs: 'csharp',
  console: 'bash',
  html: 'xml',
  js: 'javascript',
  jsx: 'javascript',
  md: 'markdown',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  terminal: 'bash',
  ts: 'typescript',
  tsx: 'typescript',
  yml: 'yaml',
  zsh: 'bash',
};

export interface HighlightedCode {
  html: string;
  languageClassName?: string;
  languageLabel?: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function getCodeLanguageLabel(language: string | undefined): string | undefined {
  const label = language?.trim().split(/\s+/)[0];
  return label || undefined;
}

function getLanguageKey(languageLabel: string | undefined): string | undefined {
  if (!languageLabel) return undefined;
  const normalized = languageLabel.toLowerCase().replace(/^language-/, '');
  return LANGUAGE_ALIASES[normalized] ?? (hljs.getLanguage(normalized) ? normalized : undefined);
}

function getLanguageClassName(languageKey: string | undefined, languageLabel: string | undefined): string | undefined {
  if (!languageLabel) return undefined;
  const className = languageKey ?? languageLabel.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  return `${languageKey ? 'hljs ' : ''}language-${className}`;
}

export function highlightCode(source: string, language: string | undefined): HighlightedCode {
  const languageLabel = getCodeLanguageLabel(language);
  const languageKey = getLanguageKey(languageLabel);
  const languageClassName = getLanguageClassName(languageKey, languageLabel);

  if (!languageKey) {
    return {
      html: escapeHtml(source),
      languageClassName,
      languageLabel,
    };
  }

  try {
    return {
      html: hljs.highlight(source, {
        ignoreIllegals: true,
        language: languageKey,
      }).value,
      languageClassName,
      languageLabel,
    };
  } catch {
    // A malformed grammar should never make the whole document disappear.
    return {
      html: escapeHtml(source),
      languageClassName,
      languageLabel,
    };
  }
}
