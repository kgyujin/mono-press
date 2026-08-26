import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findMissingAssetReferences,
  normalizeImportedFiles,
  resolveWorkspaceReference,
} from '../lib/workspace.ts';

test('strips the selected folder name from imported relative paths', () => {
  const files = normalizeImportedFiles([
    { file: new File(['# Guide'], 'guide.md'), path: 'docs/guide.md' },
    { file: new File(['binary'], 'diagram.png'), path: 'docs/assets/diagram.png' },
  ]);

  assert.deepEqual(files.map((file) => file.path), ['assets/diagram.png', 'guide.md']);
});

test('keeps a standalone Markdown file addressable as a workspace document', () => {
  const [file] = normalizeImportedFiles([
    { file: new File(['# Guide'], 'guide.md'), path: 'guide.md' },
  ]);

  assert.equal(file.path, 'guide.md');
  assert.equal(file.name, 'guide.md');
  assert.equal(file.kind, 'markdown');
});

test('resolves references relative to the Markdown document directory', () => {
  assert.equal(
    resolveWorkspaceReference('chapters/intro.md', '../assets/diagram.png'),
    'assets/diagram.png',
  );
  assert.equal(
    resolveWorkspaceReference('guide.md', 'https://example.com/image.png'),
    null,
  );
});

test('reports image references that are outside the loaded workspace', () => {
  const files = normalizeImportedFiles([
    { file: new File(['# Guide'], 'guide.md'), path: 'guide.md' },
    { file: new File(['binary'], 'diagram.png'), path: 'assets/diagram.png' },
  ]);

  assert.deepEqual(
    findMissingAssetReferences(
      '![Existing](./assets/diagram.png)\n![Missing](./assets/missing.png)',
      'guide.md',
      files,
    ),
    ['assets/missing.png'],
  );
});
