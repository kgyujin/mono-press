import assert from 'node:assert/strict';
import test from 'node:test';

import { getCodeLanguageLabel, highlightCode } from '../lib/code-highlight.ts';

test('highlights recognized language syntax with semantic token classes', () => {
  const highlighted = highlightCode('const answer: number = 42;', 'typescript');

  assert.equal(highlighted.languageLabel, 'typescript');
  assert.equal(highlighted.languageClassName, 'hljs language-typescript');
  assert.match(highlighted.html, /class="hljs-keyword">const<\/span>/);
  assert.match(highlighted.html, /class="hljs-number">42<\/span>/);
});

test('normalizes common aliases and preserves unknown code safely', () => {
  const python = highlightCode('# comment\nprint("mono")', 'py');
  const csharp = highlightCode('var value = 1;', 'cs');
  const javascript = highlightCode('<script>alert("x")</script>', 'javascript');
  const unknown = highlightCode('<script>alert("x")</script>', 'custom-lang');

  assert.equal(python.languageClassName, 'hljs language-python');
  assert.match(python.html, /class="hljs-comment"># comment<\/span>/);
  assert.match(python.html, /class="hljs-string">&quot;mono&quot;<\/span>/);
  assert.equal(csharp.languageClassName, 'hljs language-csharp');
  assert.doesNotMatch(javascript.html, /<script>/);
  assert.equal(unknown.languageClassName, 'language-custom-lang');
  assert.equal(unknown.html, '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
});

test('uses the first fenced-code token as the language label', () => {
  assert.equal(getCodeLanguageLabel('typescript title=example'), 'typescript');
  assert.equal(getCodeLanguageLabel(''), undefined);
  assert.equal(getCodeLanguageLabel(undefined), undefined);
});
