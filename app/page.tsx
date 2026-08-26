'use client';

/**
 * 작성자: Git 이력 참조
 * 작성목적: mono-press의 파일·폴더 기반 Markdown 편집·미리보기·내보내기 화면을 제공한다.
 * 작성일: 2026-08-26
 * 변경사항 내역:
 * - 2026-08-26 | 제품 첫 버전 | 로컬 작업 공간과 HTML/PDF 내보내기 구현
 * - 2026-08-26 | 단일 문서 입력 지원 | Markdown 파일만 선택하는 입력 경로 추가
 * - 2026-08-26 | PDF 출력 개선 | 인쇄용 문서 크롬과 페이지 나눔 보강
 */

import mermaid from 'mermaid';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';

import { createStandaloneHtml, downloadTextFile } from '@/lib/export';
import { getDocumentTitle, renderMarkdown } from '@/lib/markdown';
import {
  findMissingAssetReferences,
  formatBytes,
  normalizeImportedFiles,
  type ImportedFile,
  type WorkspaceFile,
} from '@/lib/workspace';

const DEMO_MARKDOWN = `# mono-press로 문서 출판하기

Markdown 파일 하나를 바로 열거나 문서 폴더를 선택하면 이미지와 다이어그램의 상대 경로를 자동으로 연결합니다. 작성한 Markdown은 화면에서 바로 읽기 좋은 문서로 바뀌고, 그대로 HTML이나 PDF로 내보낼 수 있습니다.

![mono-press mark](./assets/mono-mark.svg)

## 작업 폴더를 기준으로 정리

파일 하나가 아니라 **문서와 자산이 함께 있는 폴더**를 불러옵니다. 이 방식은 README, 기술 문서, 리서치 리포트처럼 이미지가 많은 파일을 옮겨도 링크가 깨질 가능성을 줄여줍니다.

| 구성 요소 | 처리 방식 |
| --- | --- |
| Markdown | 제목, 표, 코드, 체크리스트를 의미 있는 HTML로 변환 |
| 이미지 | 문서 위치를 기준으로 상대 경로 자동 해석 |
| Mermaid | mono-press 전용 흑백 스타일로 통일 |
| PDF | A4 인쇄 레이아웃과 페이지 나눔 규칙 적용 |

## 변환 흐름

\`\`\`mermaid
flowchart LR
  folder[문서 폴더 선택] --> scan[파일 구조 스캔]
  scan --> resolve[상대 경로 연결]
  resolve --> preview[HTML 미리보기]
  preview --> export[HTML · PDF 내보내기]
\`\`\`

> 브라우저에서 파일을 선택한 뒤 모든 처리는 현재 기기 안에서 진행됩니다. 문서 원본은 업로드하지 않습니다.

## 시작하기

1. Markdown 파일 하나를 열거나, 이미지가 들어 있는 상위 폴더를 선택합니다.
2. 폴더를 열었다면 왼쪽 파일 트리에서 문서를 고릅니다.
3. 필요한 내용을 편집하고 오른쪽 미리보기를 확인합니다.
4. HTML 또는 PDF 버튼으로 저장합니다.

\`\`\`bash
npm run dev
\`\`\`
`;

const DEMO_MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120" role="img" aria-label="mono-press mark"><rect width="320" height="120" rx="18" fill="#f0f0ee"/><path d="M48 27h62v20H70v14h34v19H70v13h40v20H48z" fill="#171717"/><path d="M131 27h22v66h38v20h-60z" fill="#171717"/><path d="M211 27h22v66h38v20h-60z" fill="#171717"/><path d="M289 27h-18v86h18z" fill="#171717"/></svg>`;

const INITIAL_WORKSPACE: WorkspaceFile[] = normalizeImportedFiles([
  {
    file: new File([DEMO_MARK], 'mono-mark.svg', { type: 'image/svg+xml' }),
    path: 'mono-press-demo/assets/mono-mark.svg',
  },
  {
    file: new File([DEMO_MARKDOWN], 'guide.md', { type: 'text/markdown' }),
    path: 'mono-press-demo/guide.md',
  },
]);

type DirectoryFileHandle = {
  kind: 'file';
  name: string;
  getFile: () => Promise<File>;
};

type DirectoryHandle = {
  kind: 'directory';
  name: string;
  values: () => AsyncIterableIterator<DirectoryFileHandle | DirectoryHandle>;
};

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: () => Promise<DirectoryHandle>;
};

function MarkIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className="mark-icon"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      fill="none"
    >
      <path d="M4 4h8v4H8v3h4v4H8v5H4V4Z" fill="currentColor" />
      <path d="M13 4h4v12h3v4h-7V4Z" fill="currentColor" />
    </svg>
  );
}

function FolderIcon({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" height={size} viewBox="0 0 24 24" width={size} fill="none">
      <path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h4l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.8 9h16.4" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function FileIcon({ kind, size = 16 }: { kind: WorkspaceFile['kind']; size?: number }) {
  if (kind === 'image') {
    return (
      <svg aria-hidden="true" height={size} viewBox="0 0 24 24" width={size} fill="none">
        <rect x="3.5" y="4" width="17" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="8.5" cy="9" r="1.5" fill="currentColor" />
        <path d="m5.5 17 4.1-4 2.5 2.3 2.1-2.1 4.3 3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (kind === 'diagram') {
    return (
      <svg aria-hidden="true" height={size} viewBox="0 0 24 24" width={size} fill="none">
        <rect x="3.5" y="4" width="7" height="5" rx="1.4" stroke="currentColor" strokeWidth="1.5" />
        <rect x="13.5" y="15" width="7" height="5" rx="1.4" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10.5 6.5h3a2 2 0 0 1 2 2v6.5M13.5 17.5h-3a2 2 0 0 1-2-2V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" height={size} viewBox="0 0 24 24" width={size} fill="none">
      <path d="M6 3.5h8l4 4V20H6V3.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 3.5V8h4M8.5 12h7M8.5 15.5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ArrowUpIcon({ size = 15 }: { size?: number }) {
  return (
    <svg aria-hidden="true" height={size} viewBox="0 0 24 24" width={size} fill="none">
      <path d="M12 17V7M7.5 11.5 12 7l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DownloadIcon({ size = 15 }: { size?: number }) {
  return (
    <svg aria-hidden="true" height={size} viewBox="0 0 24 24" width={size} fill="none">
      <path d="M12 4v10M8 11l4 4 4-4M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg aria-hidden="true" height={size} viewBox="0 0 24 24" width={size} fill="none">
      <path d="m5 12.5 4.2 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AlertIcon({ size = 15 }: { size?: number }) {
  return (
    <svg aria-hidden="true" height={size} viewBox="0 0 24 24" width={size} fill="none">
      <path d="m12 4 8 15H4L12 4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 9v4M12 16.3v.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ size = 13 }: { size?: number }) {
  return (
    <svg aria-hidden="true" height={size} viewBox="0 0 24 24" width={size} fill="none">
      <path d="m8 10 4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparkIcon({ size = 15 }: { size?: number }) {
  return (
    <svg aria-hidden="true" height={size} viewBox="0 0 24 24" width={size} fill="none">
      <path d="M12 3.5 13.8 10l6.2 2-6.2 2L12 20.5 10.2 14l-6.2-2 6.2-2L12 3.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function collectFileEntries(
  directory: DirectoryHandle,
  prefix = '',
): Promise<ImportedFile[]> {
  return (async () => {
    const entries: ImportedFile[] = [];
    for await (const entry of directory.values()) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.kind === 'file') {
        entries.push({ file: await entry.getFile(), path });
      } else {
        entries.push(...(await collectFileEntries(entry, path)));
      }
    }
    return entries;
  })();
}

function getFolderNameFromPath(path: string): string {
  return path.split('/')[0] || 'workspace';
}

function groupWorkspaceFiles(files: WorkspaceFile[]): Array<{ label: string; files: WorkspaceFile[] }> {
  const markdown = files.filter((file) => file.kind === 'markdown');
  const assets = files.filter((file) => file.kind !== 'markdown');
  return [
    { label: 'DOCUMENTS', files: markdown },
    { label: 'ASSETS', files: assets },
  ].filter((group) => group.files.length > 0);
}

export default function Home() {
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFile[]>(INITIAL_WORKSPACE);
  const [workspaceName, setWorkspaceName] = useState('mono-press-demo');
  const [selectedDocumentPath, setSelectedDocumentPath] = useState('guide.md');
  const [markdown, setMarkdown] = useState(DEMO_MARKDOWN);
  const [activeView, setActiveView] = useState<'split' | 'preview'>('split');
  const [notice, setNotice] = useState('Demo workspace loaded');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Safari and Firefox do not expose the directory picker method, so the
    // webkitdirectory input remains the compatibility fallback.
    folderInputRef.current?.setAttribute('webkitdirectory', '');
    folderInputRef.current?.setAttribute('directory', '');
  }, []);

  const selectedDocument = useMemo(
    () => workspaceFiles.find((file) => file.path === selectedDocumentPath),
    [selectedDocumentPath, workspaceFiles],
  );
  const documentTitle = useMemo(
    () => getDocumentTitle(markdown, selectedDocument?.name ?? 'Untitled document'),
    [markdown, selectedDocument?.name],
  );

  useEffect(() => {
    const root = document.documentElement;
    const toCssString = (value: string) => JSON.stringify(value.replace(/[\r\n]+/g, ' ').trim());
    root.style.setProperty('--print-document-title', toCssString(documentTitle));
    root.style.setProperty('--print-document-name', toCssString(selectedDocument?.name ?? 'Untitled.md'));

    return () => {
      root.style.removeProperty('--print-document-title');
      root.style.removeProperty('--print-document-name');
    };
  }, [documentTitle, selectedDocument?.name]);

  const hasDocumentHeading = useMemo(() => /^#\s+.+$/m.test(markdown), [markdown]);
  const missingReferences = useMemo(
    () => findMissingAssetReferences(markdown, selectedDocumentPath, workspaceFiles),
    [markdown, selectedDocumentPath, workspaceFiles],
  );
  const groupedFiles = useMemo(() => groupWorkspaceFiles(workspaceFiles), [workspaceFiles]);
  const imageCount = workspaceFiles.filter((file) => file.kind === 'image').length;
  const diagramCount =
    workspaceFiles.filter((file) => file.kind === 'diagram').length +
    (markdown.match(/```mermaid/gi)?.length ?? 0);
  const totalSize = workspaceFiles.reduce((sum, file) => sum + file.file.size, 0);

  const assetRecords = useMemo(() => {
    const urls = new Map<string, string>();
    const files = new Map<string, File>();
    if (typeof window === 'undefined') return { files, urls };

    workspaceFiles
      .filter((file) => file.kind === 'image')
      .forEach((file) => {
        const url = URL.createObjectURL(file.file);
        urls.set(file.path, url);
        files.set(url, file.file);
      });

    return { files, urls };
  }, [workspaceFiles]);

  useEffect(() => {
    return () => {
      assetRecords.urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [assetRecords]);

  const assetUrls = assetRecords.urls;
  const assetUrlToFile = assetRecords.files;

  const renderedHtml = useMemo(
    () => renderMarkdown(markdown, { assetUrls, documentPath: selectedDocumentPath }),
    [assetUrls, markdown, selectedDocumentPath],
  );

  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;

    preview.innerHTML = renderedHtml;
    const diagrams = Array.from(preview.querySelectorAll<HTMLElement>('.mermaid'));
    if (diagrams.length === 0) return;

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      themeVariables: {
        background: '#ffffff',
        primaryColor: '#ffffff',
        primaryBorderColor: '#171717',
        primaryTextColor: '#171717',
        lineColor: '#171717',
        secondaryColor: '#f0f0ee',
        tertiaryColor: '#ffffff',
        edgeLabelBackground: '#ffffff',
        fontFamily: 'SFMono-Regular, Consolas, monospace',
        fontSize: '13px',
      },
    });

    void mermaid.run({ nodes: diagrams }).catch(() => {
      diagrams.forEach((diagram) => {
        diagram.classList.add('mermaid-error');
      });
    });
  }, [renderedHtml]);

  const loadWorkspace = useCallback(async (importedFiles: ImportedFile[], name: string) => {
    const normalizedFiles = normalizeImportedFiles(importedFiles);
    const firstDocument = normalizedFiles.find((file) => file.kind === 'markdown');

    if (!firstDocument) {
      setNotice('Markdown 파일을 찾지 못했습니다');
      return;
    }

    setWorkspaceFiles(normalizedFiles);
    setWorkspaceName(name || getFolderNameFromPath(firstDocument.path));
    setSelectedDocumentPath(firstDocument.path);
    setMarkdown(await firstDocument.file.text());
    setNotice(`${normalizedFiles.length} ${normalizedFiles.length === 1 ? 'file' : 'files'} connected`);
  }, []);

  const handleChooseFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInput = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      await loadWorkspace([{ file, path: file.name }], 'Single document');
      event.target.value = '';
    },
    [loadWorkspace],
  );

  const handleChooseFolder = useCallback(async () => {
    const directoryPicker = window as DirectoryPickerWindow;
    if (directoryPicker.showDirectoryPicker) {
      try {
        const directory = await directoryPicker.showDirectoryPicker();
        const entries = await collectFileEntries(directory);
        await loadWorkspace(entries, directory.name);
      } catch (error) {
        if ((error as DOMException).name !== 'AbortError') {
          setNotice('폴더를 불러오지 못했습니다');
        }
      }
      return;
    }

    folderInputRef.current?.click();
  }, [loadWorkspace]);

  const handleFolderInput = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []).map((file) => ({
        file,
        path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
      }));
      if (files.length === 0) return;
      await loadWorkspace(files, getFolderNameFromPath(files[0].path));
      event.target.value = '';
    },
    [loadWorkspace],
  );

  const handleDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      const files = Array.from(event.dataTransfer.files).map((file) => ({
        file,
        path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
      }));
      if (files.length === 0) return;
      await loadWorkspace(files, getFolderNameFromPath(files[0].path));
    },
    [loadWorkspace],
  );

  const handleSelectDocument = useCallback(async (file: WorkspaceFile) => {
    if (file.kind !== 'markdown') return;
    setSelectedDocumentPath(file.path);
    setMarkdown(await file.file.text());
    setNotice(`${file.name} selected`);
  }, []);

  const handleExportHtml = useCallback(async () => {
    const body = previewRef.current?.innerHTML ?? renderedHtml;
    const html = await createStandaloneHtml({
      assetUrlToFile,
      body,
      documentName: selectedDocument?.name,
      documentTitle,
      workspaceFiles,
    });
    downloadTextFile(
      html,
      `${documentTitle.toLowerCase().replace(/[^a-z0-9가-힣]+/gi, '-').replace(/^-|-$/g, '') || 'document'}.html`,
      'text/html;charset=utf-8',
    );
    setNotice('Standalone HTML downloaded');
  }, [assetUrlToFile, documentTitle, renderedHtml, selectedDocument?.name, workspaceFiles]);

  const handleExportPdf = useCallback(() => {
    const previousTitle = document.title;
    document.title = `${documentTitle} · mono-press`;
    window.print();
    window.setTimeout(() => {
      document.title = previousTitle;
    }, 1000);
    setNotice('Print dialog opened — choose Save as PDF');
  }, [documentTitle]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        handleExportPdf();
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [handleExportPdf]);

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget === event.target) setIsDragging(false);
  }, []);

  return (
    <main
      className={`app-shell${isDragging ? ' is-dragging' : ''}`}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        accept=".md,.markdown,.mdx,text/markdown"
        aria-label="문서 파일 선택"
        className="visually-hidden"
        onChange={handleFileInput}
        type="file"
      />
      <input
        ref={folderInputRef}
        aria-label="문서 폴더 선택"
        className="visually-hidden"
        multiple
        onChange={handleFolderInput}
        type="file"
      />

      <header className="topbar">
        <div aria-label="mono-press (MonoPress)" className="brand-lockup">
          <span className="brand-mark"><MarkIcon size={22} /></span>
          <span className="brand-name">mono-press</span>
          <span className="brand-version">BETA</span>
        </div>
        <div className="topbar-status">
          <span className="status-dot" />
          <span>Local workspace</span>
        </div>
        <div className="topbar-open-actions">
          <button className="ghost-button topbar-open-button" onClick={handleChooseFile} type="button">
            <FileIcon kind="markdown" size={15} />
            <span>Open file</span>
          </button>
          <button className="ghost-button topbar-open-button" onClick={handleChooseFolder} type="button">
            <FolderIcon size={15} />
            <span>Open folder</span>
          </button>
        </div>
      </header>

      <div className="workspace-layout">
        <aside className="sidebar" aria-label="Workspace files">
          <div className="sidebar-heading">
            <div>
              <span className="eyebrow">WORKSPACE</span>
              <h1>{workspaceName}</h1>
            </div>
            <button aria-label="폴더 다시 선택" className="icon-button" onClick={handleChooseFolder} type="button">
              <FolderIcon size={16} />
            </button>
          </div>

          <div className="workspace-meta">
            <span><CheckIcon size={13} /> {workspaceFiles.length} files</span>
            <span>{formatBytes(totalSize)}</span>
          </div>

          <nav className="file-tree" aria-label="문서 파일 목록">
            {groupedFiles.map((group) => (
              <div className="file-group" key={group.label}>
                <div className="file-group-label">{group.label}<span>{group.files.length}</span></div>
                {group.files.map((file) => (
                  <button
                    className={`file-row${file.path === selectedDocumentPath ? ' is-selected' : ''}`}
                    key={file.path}
                    onClick={() => handleSelectDocument(file)}
                    type="button"
                  >
                    <FileIcon kind={file.kind} size={15} />
                    <span className="file-row-name">{file.name}</span>
                    {file.path === selectedDocumentPath ? <span className="file-row-active"><CheckIcon size={12} /></span> : null}
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="privacy-note">
              <span className="privacy-note-icon"><SparkIcon size={14} /></span>
              <div><strong>Private by default</strong><span>Files stay in your browser.</span></div>
            </div>
            <p className="build-note">mono-press / 0.1.0</p>
          </div>
        </aside>

        <section className="main-area" aria-label="문서 작업 공간">
          <div className="document-toolbar">
            <div className="document-breadcrumb">
              <span>{workspaceName}</span><span className="breadcrumb-separator">/</span><strong>{selectedDocument?.name ?? 'Untitled.md'}</strong>
            </div>
            <div className="toolbar-actions">
              <div className="view-switcher" role="group" aria-label="보기 방식">
                <button className={activeView === 'split' ? 'is-active' : ''} onClick={() => setActiveView('split')} type="button">Split</button>
                <button className={activeView === 'preview' ? 'is-active' : ''} onClick={() => setActiveView('preview')} type="button">Preview</button>
              </div>
              <button className="outline-button" onClick={handleExportHtml} type="button"><ArrowUpIcon size={14} /> HTML</button>
              <button aria-label="PDF로 저장하기" className="primary-button" onClick={handleExportPdf} title="Print / Save as PDF" type="button"><DownloadIcon size={14} /> PDF</button>
            </div>
          </div>

          <div className="document-heading-row">
            <div>
              <div className="document-kicker"><span className="document-live-dot" /> Live document</div>
              <h2>{documentTitle}</h2>
            </div>
            <div className="document-heading-meta">
              <span><span className="mini-icon"><FileIcon kind="image" size={13} /></span>{imageCount} images</span>
              <span><span className="mini-icon"><FileIcon kind="diagram" size={13} /></span>{diagramCount} diagrams</span>
            </div>
          </div>

          <div className={`editor-preview-grid view-${activeView}`}>
            <section className="editor-panel" aria-label="Markdown 편집기">
              <div className="panel-label-row">
                <div className="panel-label"><span className="panel-label-number">01</span><span>Markdown source</span></div>
                <span className="panel-meta">{markdown.split('\n').length} lines</span>
              </div>
              <textarea
                aria-label="Markdown source"
                className="markdown-editor"
                onChange={(event) => {
                  setMarkdown(event.target.value);
                  setNotice('Local draft updated');
                }}
                spellCheck={false}
                value={markdown}
              />
              <div className="editor-footer"><span>Markdown + GFM</span><span>Autosaved locally</span></div>
            </section>

            <section className="preview-panel" aria-label="HTML 문서 미리보기">
              <div className="panel-label-row preview-label-row">
                <div className="panel-label"><span className="panel-label-number">02</span><span>Published preview</span></div>
                <span className="preview-format"><span className="status-dot" /> HTML</span>
              </div>
              {!hasDocumentHeading ? (
                <section className="print-title-block">
                  <span className="print-title-kicker">mono-press / DOCUMENT</span>
                  <h1>{documentTitle}</h1>
                  <p>{selectedDocument?.name ?? 'Untitled.md'}</p>
                </section>
              ) : null}
              <article className="article-preview" ref={previewRef} />
              <div className="preview-footer"><span>Paper / A4</span><span>Monochrome system</span></div>
            </section>
          </div>

          <div className="status-bar" role="status" aria-live="polite">
            <div className="status-message"><span className={`status-message-dot${missingReferences.length ? ' is-warning' : ''}`} />{notice}</div>
            <div className="status-links">
              {missingReferences.length ? <span className="warning-link"><AlertIcon size={13} /> {missingReferences.length} missing asset{missingReferences.length > 1 ? 's' : ''}</span> : <span><CheckIcon size={13} /> All references resolved</span>}
              <span className="status-shortcut"><span className="shortcut-key">⌘</span><span className="shortcut-key">P</span> save PDF</span>
            </div>
          </div>
        </section>

        <aside className="inspector" aria-label="문서 설정">
          <div className="inspector-section">
            <div className="inspector-title-row"><span className="eyebrow">DOCUMENT PROFILE</span><ChevronIcon size={14} /></div>
            <div className="profile-card">
              <div className="profile-card-top"><span className="profile-symbol"><MarkIcon size={18} /></span><span className="profile-badge">ACTIVE</span></div>
              <strong>Mono paper</strong>
              <span>A quiet, print-ready document system.</span>
            </div>
          </div>

          <div className="inspector-section settings-section">
            <div className="inspector-title-row"><span className="eyebrow">OUTPUT SETTINGS</span><span className="settings-count">3</span></div>
            <div className="setting-row"><div><span className="setting-name">Page size</span><span className="setting-description">Print layout</span></div><strong>A4</strong></div>
            <div className="setting-row"><div><span className="setting-name">Typeface</span><span className="setting-description">Sans / system</span></div><strong>Neutral</strong></div>
            <div className="setting-row"><div><span className="setting-name">Diagrams</span><span className="setting-description">Mermaid theme</span></div><strong>Mono</strong></div>
          </div>

          <div className="inspector-section export-card">
            <div className="export-card-icon"><DownloadIcon size={17} /></div>
            <div><strong>Ready to publish</strong><span>Clean HTML and PDF exports include your local assets.</span></div>
            <button onClick={handleExportHtml} type="button">Download HTML <ArrowUpIcon size={13} /></button>
          </div>

          <div className="drop-hint"><span className="drop-hint-icon"><FolderIcon size={14} /></span><span><strong>Tip</strong> Drop a Markdown file or document folder anywhere on this window.</span></div>
        </aside>
      </div>

      <div className="drag-overlay" aria-hidden="true">
        <div className="drag-overlay-card"><span className="drag-overlay-icon"><FolderIcon size={25} /></span><strong>Drop a Markdown file or folder</strong><span>Folder assets will be linked automatically.</span></div>
      </div>
    </main>
  );
}
