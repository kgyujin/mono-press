import assert from 'node:assert/strict';
import test from 'node:test';
import { collectDirectoryFiles, collectDroppedFiles, filterImportedFiles, isAllowedImportPath, MAX_IMPORT_BYTES, MAX_IMPORT_FILES } from '../lib/imports.ts';
import type { ImportDirectoryHandle, ImportFileHandle } from '../lib/imports.ts';

test('imports only document assets and excludes hidden and generated paths', () => {
  for (const path of ['docs/guide.md', 'docs/한글 이미지.PNG', 'flow.mmd']) assert.equal(isAllowedImportPath(path), true);
  for (const path of ['.env', '.git/guide.md', 'node_modules/a.md', 'docs/.private/a.png', 'dist/a.svg', '../a.md', 'data.csv']) assert.equal(isAllowedImportPath(path), false);
  const filtered = filterImportedFiles(['guide.md', '.secret.md', 'data.csv'].map((path) => ({ path, file: new File([''], path) })));
  assert.equal(filtered.files.length, 1);
  assert.equal(filtered.rejectedCount, 2);
});

test('rejects total size and file count overflow without a partial import', () => {
  assert.throws(() => filterImportedFiles([{ path: 'big.md', file: { size: MAX_IMPORT_BYTES + 1 } as File }]), /50 MB/);
  assert.throws(() => filterImportedFiles(Array.from({ length: MAX_IMPORT_FILES + 1 }, (_, index) => ({ path: `${index}.md`, file: new File([], `${index}.md`) }))), /1000/);
});

test('directory handles recurse while excluded directories and files are never read', async () => {
  const safeFile: ImportFileHandle = { kind: 'file', name: 'guide.md', getFile: async () => new File(['hello'], 'guide.md') };
  const directory: ImportDirectoryHandle = {
    kind: 'directory', name: 'docs',
    async *values() {
      yield { kind: 'directory', name: '.git', async *values() { throw new Error('must not read'); } } as ImportDirectoryHandle;
      yield { kind: 'file', name: '.env', getFile: async () => { throw new Error('must not read'); } } as ImportFileHandle;
      yield { kind: 'directory', name: 'chapter', async *values() { yield safeFile; } } as ImportDirectoryHandle;
    },
  };
  assert.deepEqual((await collectDirectoryFiles(directory)).map(({ path }) => path), ['chapter/guide.md']);
  assert.deepEqual((await collectDirectoryFiles(directory, 'docs')).map(({ path }) => path), ['docs/chapter/guide.md']);
});

test('folder drop reads all entry batches and preserves nested paths', async () => {
  let batchIndex = 0;
  const entry = {
    name: 'docs', isDirectory: true, isFile: false,
    createReader: () => ({ readEntries: (success: (entries: unknown[]) => void) => {
      const name = ['first.md', 'second.png'][batchIndex++];
      success(name ? [{ name, isDirectory: false, isFile: true, file: (callback: (file: File) => void) => callback(new File(['test'], name)) }] : []);
    } }),
  };
  const transfer = { items: [{ kind: 'file', webkitGetAsEntry: () => entry }], files: [] } as unknown as DataTransfer;
  assert.deepEqual((await collectDroppedFiles(transfer)).map(({ path }) => path), ['docs/first.md', 'docs/second.png']);
});

test('drop without entry API uses file list and filters unsafe files', async () => {
  const transfer = { items: [], files: [new File([''], 'guide.md'), new File(['secret'], '.env')] } as unknown as DataTransfer;
  assert.deepEqual((await collectDroppedFiles(transfer)).map(({ path }) => path), ['guide.md']);
});
