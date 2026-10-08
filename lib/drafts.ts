/**
 * 작성자: Git 이력 참조
 * 작성목적: 작업 공간별 초안과 파일을 하나의 IndexedDB 트랜잭션으로 보존한다.
 * 작성일: 2026-10-08
 * 주의사항: 원본 파일에는 쓰지 않으며 다른 탭의 변경을 덮어쓰지 않는다.
 */
import type { WorkspaceFile } from './workspace';

export interface DraftWorkspace {
  workspaceId: string;
  revision: number;
  workspaceFiles: WorkspaceFile[];
  workspaceName: string;
  selectedDocumentPath: string;
  drafts: Record<string, string>;
  markdown: string;
}

export interface DraftWorkspaceSummary {
  workspaceId: string;
  workspaceName: string;
  selectedDocumentPath: string;
  updatedAt: number;
  revision: number;
}

type StoredWorkspace = DraftWorkspace & { updatedAt: number };
let databasePromise: Promise<IDBDatabase> | undefined;

export class DraftConflictError extends Error {
  constructor() {
    super('다른 탭에서 이 작업 공간을 변경했습니다. 현재 편집을 새 사본으로 저장하거나 저장된 내용을 다시 열어 주세요.');
    this.name = 'DraftConflictError';
  }
}

/** 파일 이름만 같은 서로 다른 작업 공간이 초안을 공유하지 않도록 메타데이터를 포함한다. */
export async function createWorkspaceId(workspaceName: string, files: WorkspaceFile[]): Promise<string> {
  const identity = JSON.stringify([workspaceName, files.map(({ path, file }) =>
    [path, file.size, file.lastModified]).sort((left, right) => String(left[0]).localeCompare(String(right[0])))]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function openDatabase(): Promise<IDBDatabase> {
  databasePromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('mono-press-drafts', 2);
    request.onupgradeneeded = () => {
      const database = request.result;
      const snapshots = database.createObjectStore('snapshots', { keyPath: 'workspaceId' });
      // Upgrade requests share the version-change transaction, so the old files and
      // document become one snapshot without losing a partially migrated database.
      if (database.objectStoreNames.contains('workspace')) {
        const oldStore = request.transaction!.objectStore('workspace');
        const files = oldStore.get('files');
        const document = oldStore.get('document');
        document.onsuccess = () => {
          if (files.result && document.result) snapshots.put({
            ...document.result,
            workspaceFiles: files.result,
            workspaceId: 'legacy-workspace',
            revision: 1,
            updatedAt: Date.now(),
          });
        };
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        databasePromise = undefined;
      };
      resolve(request.result);
    };
    request.onerror = () => { databasePromise = undefined; reject(request.error); };
    request.onblocked = () => { databasePromise = undefined; reject(new Error('다른 탭을 닫은 뒤 저장을 다시 시도해 주세요.')); };
  });
  return databasePromise;
}

export async function saveDraftWorkspace(snapshot: DraftWorkspace): Promise<number> {
  // Capture now: edits while IndexedDB opens must not mutate the pending snapshot.
  const captured = { ...snapshot, drafts: { ...snapshot.drafts }, workspaceFiles: [...snapshot.workspaceFiles] };
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('snapshots', 'readwrite');
    const store = transaction.objectStore('snapshots');
    let conflict: DraftConflictError | undefined;
    const existing = store.get(captured.workspaceId);
    const revision = captured.revision + 1;
    existing.onsuccess = () => {
      if ((existing.result?.revision ?? 0) !== captured.revision) {
        conflict = new DraftConflictError();
        transaction.abort();
        return;
      }
      store.put({ ...captured, revision, updatedAt: Date.now() } satisfies StoredWorkspace);
    };
    transaction.oncomplete = () => resolve(revision);
    transaction.onabort = () => reject(conflict ?? transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function loadDraftWorkspace(workspaceId?: string): Promise<DraftWorkspace | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('snapshots', 'readonly');
    const store = transaction.objectStore('snapshots');
    const request = workspaceId ? store.get(workspaceId) : store.getAll();
    transaction.oncomplete = () => {
      const snapshot = workspaceId ? request.result : (request.result as StoredWorkspace[])
        .sort((left, right) => right.updatedAt - left.updatedAt)[0];
      resolve(snapshot ?? null);
    };
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function listDraftWorkspaces(): Promise<DraftWorkspaceSummary[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('snapshots', 'readonly');
    const request = transaction.objectStore('snapshots').openCursor();
    const summaries: DraftWorkspaceSummary[] = [];
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const { workspaceId, workspaceName, selectedDocumentPath, updatedAt, revision } = cursor.value as StoredWorkspace;
      summaries.push({ workspaceId, workspaceName, selectedDocumentPath, updatedAt, revision });
      cursor.continue();
    };
    transaction.oncomplete = () => resolve(summaries.sort((left, right) => right.updatedAt - left.updatedAt));
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function deleteDraftWorkspace(workspaceId: string): Promise<void> {
  await mutateStoredWorkspaces(workspaceId);
}

export async function clearDraftWorkspaces(): Promise<void> {
  await mutateStoredWorkspaces();
}

async function mutateStoredWorkspaces(workspaceId?: string): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const stores = ['snapshots', ...(database.objectStoreNames.contains('workspace') ? ['workspace'] : [])];
    const transaction = database.transaction(stores, 'readwrite');
    const snapshots = transaction.objectStore('snapshots');
    if (workspaceId) snapshots.delete(workspaceId);
    else snapshots.clear();
    // Do not retain hidden copies of files after the user deletes saved data.
    if (!workspaceId || workspaceId === 'legacy-workspace') {
      if (stores.includes('workspace')) transaction.objectStore('workspace').clear();
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
