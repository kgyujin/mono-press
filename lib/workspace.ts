/**
 * 작성자: Git 이력 참조
 * 작성목적: 로컬 문서 폴더의 파일을 mono-press 작업 공간으로 정규화한다.
 * 작성일: 2026-08-26
 * 변경사항 내역:
 * - 2026-08-26 | 폴더 기반 문서 변환 | 상대 경로 해석과 파일 분류 추가
 */

export type WorkspaceFileKind = 'markdown' | 'image' | 'diagram' | 'other';

export interface WorkspaceFile {
  path: string;
  name: string;
  file: File;
  kind: WorkspaceFileKind;
}

export interface ImportedFile {
  file: File;
  path: string;
}

const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown', 'mdx']);
const IMAGE_EXTENSIONS = new Set([
  'avif',
  'gif',
  'jpeg',
  'jpg',
  'png',
  'svg',
  'webp',
]);
const DIAGRAM_EXTENSIONS = new Set(['mmd', 'mermaid']);

export function normalizeWorkspacePath(path: string): string {
  const normalized = path.replaceAll('\\', '/').replace(/^\.\//, '');
  const segments: string[] = [];

  normalized.split('/').forEach((segment) => {
    if (!segment || segment === '.') return;
    if (segment === '..') {
      segments.pop();
      return;
    }
    segments.push(segment);
  });

  return segments.join('/');
}

export function getExtension(path: string): string {
  const name = path.split('/').pop() ?? path;
  const dotIndex = name.lastIndexOf('.');
  return dotIndex > -1 ? name.slice(dotIndex + 1).toLowerCase() : '';
}

export function classifyWorkspaceFile(path: string): WorkspaceFileKind {
  const extension = getExtension(path);
  if (MARKDOWN_EXTENSIONS.has(extension)) return 'markdown';
  if (IMAGE_EXTENSIONS.has(extension)) return 'image';
  if (DIAGRAM_EXTENSIONS.has(extension)) return 'diagram';
  return 'other';
}

function getFileName(path: string): string {
  return path.split('/').pop() ?? path;
}

function stripCommonRoot(paths: string[]): string[] {
  if (paths.length === 0) return paths;

  const firstSegments = new Set(paths.map((path) => path.split('/')[0]));
  const canStripRoot =
    firstSegments.size === 1 && paths.every((path) => path.includes('/'));

  if (!canStripRoot) return paths;
  return paths.map((path) => path.split('/').slice(1).join('/'));
}

export function normalizeImportedFiles(files: ImportedFile[]): WorkspaceFile[] {
  const normalizedPaths = stripCommonRoot(
    files.map(({ path, file }) => normalizeWorkspacePath(path || file.name)),
  );

  return files
    .map(({ file }, index) => {
      const path = normalizedPaths[index] || file.name;
      return {
        path,
        name: getFileName(path),
        file,
        kind: classifyWorkspaceFile(path),
      } satisfies WorkspaceFile;
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

export function getDirectoryPath(path: string): string {
  const segments = path.split('/');
  segments.pop();
  return segments.join('/');
}

function isExternalReference(reference: string): boolean {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(reference);
}

export function resolveWorkspaceReference(
  documentPath: string,
  reference: string,
): string | null {
  const trimmed = reference.trim();
  if (!trimmed || isExternalReference(trimmed)) return null;

  const [pathPart] = trimmed.split(/[?#]/, 1);
  const baseSegments = getDirectoryPath(documentPath).split('/').filter(Boolean);
  const referenceSegments = pathPart.replace(/^\//, '').split('/');
  const segments = [...baseSegments];

  referenceSegments.forEach((segment) => {
    if (!segment || segment === '.') return;
    if (segment === '..') {
      if (segments.length > 0) segments.pop();
      return;
    }
    segments.push(segment);
  });

  return normalizeWorkspacePath(segments.join('/')) || null;
}

export function findMissingAssetReferences(
  markdown: string,
  documentPath: string,
  files: WorkspaceFile[],
): string[] {
  const knownPaths = new Set(files.map((file) => file.path));
  const references = Array.from(
    markdown.matchAll(/!\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))/g),
  )
    .map((match) => match[1] ?? match[2])
    .map((reference) => resolveWorkspaceReference(documentPath, reference))
    .filter((reference): reference is string => Boolean(reference));

  return Array.from(new Set(references.filter((reference) => !knownPaths.has(reference))));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
