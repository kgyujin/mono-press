/**
 * 작성자: Git 이력 참조
 * 작성목적: 문서 초안과 연결된 로컬 파일을 IndexedDB에 보존한다.
 * 작성일: 2026-10-08
 * 주의사항: 원본 파일에는 쓰지 않으며 저장 실패는 호출자에게 전달한다.
 */
import type { WorkspaceFile } from './workspace';

export interface DraftWorkspace {
  workspaceFiles: WorkspaceFile[];
  workspaceName: string;
  selectedDocumentPath: string;
  drafts: Record<string, string>;
  markdown: string;
}

let databasePromise: Promise<IDBDatabase> | undefined;
let saveQueue: Promise<void> = Promise.resolve();
let savedFiles: WorkspaceFile[] | undefined;

function openDatabase(): Promise<IDBDatabase> {
  databasePromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('mono-press-drafts', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('workspace');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return databasePromise;
}

export function saveDraftWorkspace(snapshot: DraftWorkspace): Promise<void> {
  // Keep the file cache consistent even when workspaces change during a pending write.
  saveQueue = saveQueue.catch(() => {}).then(() => persistDraftWorkspace(snapshot));
  return saveQueue;
}

async function persistDraftWorkspace(snapshot: DraftWorkspace): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('workspace', 'readwrite');
    const store = transaction.objectStore('workspace');
    const { workspaceFiles, ...documentState } = snapshot;
    // Images can be large: only clone file blobs when the imported workspace changes.
    if (savedFiles !== workspaceFiles) store.put(workspaceFiles, 'files');
    store.put(documentState, 'document');
    transaction.oncomplete = () => {
      savedFiles = workspaceFiles;
      resolve();
    };
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function loadDraftWorkspace(): Promise<DraftWorkspace | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('workspace', 'readonly');
    const store = transaction.objectStore('workspace');
    const files = store.get('files');
    const documentState = store.get('document');
    transaction.oncomplete = () => resolve(files.result && documentState.result
      ? { ...documentState.result, workspaceFiles: files.result }
      : null);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
