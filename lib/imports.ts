/**
 * 작성자: Git 이력 참조
 * 작성목적: 폴더 선택과 드롭에서 문서에 필요한 파일만 제한된 용량으로 가져온다.
 * 작성일: 2026-10-08
 * 주의사항: 숨김·빌드 디렉터리는 파일 내용을 읽기 전에 제외한다.
 */
import type { ImportedFile } from './workspace';

export const MAX_IMPORT_BYTES = 50 * 1024 * 1024;
export const MAX_IMPORT_FILES = 1000;

const EXCLUDED_DIRECTORIES = new Set(['node_modules', 'dist', 'build', 'coverage', 'vendor', '__pycache__']);
const ALLOWED_EXTENSIONS = /\.(?:md|markdown|mdx|avif|gif|jpe?g|png|svg|webp|mmd|mermaid)$/i;

function isAllowedDirectoryPath(path: string): boolean {
  return path.replaceAll('\\', '/').split('/').filter(Boolean).every(
    (segment) => !segment.startsWith('.') && !EXCLUDED_DIRECTORIES.has(segment.toLowerCase()),
  );
}

export function isAllowedImportPath(path: string): boolean {
  return isAllowedDirectoryPath(path) && ALLOWED_EXTENSIONS.test(path);
}

function appendWithinLimits(files: ImportedFile[], imported: ImportedFile, totalBytes: number): number {
  if (files.length >= MAX_IMPORT_FILES) {
    throw new Error(`한 번에 ${MAX_IMPORT_FILES}개 이하의 파일만 가져올 수 있습니다.`);
  }
  if (totalBytes + imported.file.size > MAX_IMPORT_BYTES) {
    throw new Error('가져올 파일의 전체 용량은 50 MB 이하여야 합니다.');
  }
  files.push(imported);
  return totalBytes + imported.file.size;
}

export function filterImportedFiles(importedFiles: ImportedFile[]): { files: ImportedFile[]; rejectedCount: number } {
  const files: ImportedFile[] = [];
  let totalBytes = 0;
  let rejectedCount = 0;
  for (const imported of importedFiles) {
    if (!isAllowedImportPath(imported.path || imported.file.name)) {
      rejectedCount += 1;
      continue;
    }
    totalBytes = appendWithinLimits(files, imported, totalBytes);
  }
  return { files, rejectedCount };
}

export interface ImportFileHandle {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
}

export interface ImportDirectoryHandle {
  kind: 'directory';
  name: string;
  values(): AsyncIterableIterator<ImportFileHandle | ImportDirectoryHandle>;
}

export async function collectDirectoryFiles(handle: ImportDirectoryHandle, prefix = ''): Promise<ImportedFile[]> {
  const files: ImportedFile[] = [];
  let totalBytes = 0;
  async function visit(directory: ImportDirectoryHandle, parentPath: string): Promise<void> {
    for await (const child of directory.values()) {
      const path = parentPath ? `${parentPath}/${child.name}` : child.name;
      if (child.kind === 'directory') {
        if (isAllowedDirectoryPath(path)) await visit(child, path);
      } else if (isAllowedImportPath(path)) {
        // Count is checked before getFile, avoiding extra reads once the limit is reached.
        if (files.length >= MAX_IMPORT_FILES) throw new Error(`한 번에 ${MAX_IMPORT_FILES}개 이하의 파일만 가져올 수 있습니다.`);
        totalBytes = appendWithinLimits(files, { file: await child.getFile(), path }, totalBytes);
      }
    }
  }
  if (!prefix || isAllowedDirectoryPath(prefix)) await visit(handle, prefix);
  return files;
}

interface DroppedEntry {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
  file?: (success: (file: File) => void, failure: (error: DOMException) => void) => void;
  createReader?: () => { readEntries(success: (entries: DroppedEntry[]) => void, failure: (error: DOMException) => void): void };
}

export async function collectDroppedFiles(transfer: DataTransfer): Promise<ImportedFile[]> {
  const files: ImportedFile[] = [];
  let totalBytes = 0;
  const entries = Array.from(transfer.items ?? []).filter((item) => item.kind === 'file').map(
    (item) => (item as DataTransferItem & { webkitGetAsEntry?: () => DroppedEntry | null }).webkitGetAsEntry?.() ?? null,
  );
  if (!entries.some(Boolean)) {
    return filterImportedFiles(Array.from(transfer.files).map((file) => ({ file, path: file.webkitRelativePath || file.name }))).files;
  }
  async function visit(entry: DroppedEntry, parentPath: string): Promise<void> {
    const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;
    if (entry.isDirectory && entry.createReader && isAllowedDirectoryPath(path)) {
      const reader = entry.createReader();
      // Chromium returns directory entries in batches; an empty batch marks completion.
      while (true) {
        const children = await new Promise<DroppedEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
        if (children.length === 0) break;
        for (const child of children) await visit(child, path);
      }
    } else if (entry.isFile && entry.file && isAllowedImportPath(path)) {
      if (files.length >= MAX_IMPORT_FILES) throw new Error(`한 번에 ${MAX_IMPORT_FILES}개 이하의 파일만 가져올 수 있습니다.`);
      const file = await new Promise<File>((resolve, reject) => entry.file!(resolve, reject));
      totalBytes = appendWithinLimits(files, { file, path }, totalBytes);
    }
  }
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (entry) await visit(entry, '');
    else {
      const file = Array.from(transfer.items).filter((item) => item.kind === 'file')[index].getAsFile();
      if (file && isAllowedImportPath(file.name)) totalBytes = appendWithinLimits(files, { file, path: file.name }, totalBytes);
    }
  }
  return files;
}
